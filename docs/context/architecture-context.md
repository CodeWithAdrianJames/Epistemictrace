# Architecture Context

Items marked **(Proposed — Qn)** are not decided yet. They are written down so that specs can be precise, but a spec gated on `Qn` must not be implemented until `Qn` is marked **Accepted** in `progress-tracker.md`. When a proposal is accepted, remove its marker here and record the answer in `PROJECT.md`.

## Stack

| Layer          | Technology                                                       | Role                                                        | Status |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| Frontend       | React 19 + TypeScript + Vite 8                                   | Single-page app for students and instructors                | In repo |
| Editor         | Monaco via `@monaco-editor/react`                                | Python editor on the activity page                          | In repo |
| Code execution | Pyodide in a Web Worker                                          | Runs student Python in the browser with a time limit        | Decided, not added |
| Frontend tests | Vitest + Testing Library (`@testing-library/react`, `@testing-library/jest-dom`) on `jsdom`; oxlint (`--deny-warnings`) for linting | Unit and component tests; any lint warning fails | In repo |
| Backend        | Java 21 + Spring Boot 4.1 (Maven wrapper)                        | REST API under `/api`                                       | In repo |
| Auth           | Spring Security + JWT                                            | Stateless bearer-token auth and role checks                 | In repo |
| Database       | PostgreSQL via Spring Data JPA                                   | All persistent data                                         | In repo |
| Backend tests  | JUnit 5 + MockMvc; H2 in PostgreSQL mode as the test database    | Unit, web-layer and persistence tests                       | In repo |
| Migrations     | Flyway                                                           | Versioned schema changes                                    | In repo |
| Routing        | React Router (`react-router`)                                    | Client-side routes and role guards                          | In repo |
| Frontend state and styling | React state, custom hooks and one auth context (no state library); CSS Modules with tokens in `styles/tokens.css`; native `fetch`; no icon library | Keeps the client small | Decided (Q11) |
| CI             | GitHub Actions                                                   | Lint, build and tests on every PR                           | In repo |
| Hosting        | —                                                                | —                                                           | Not decided (Q9) |

No library or framework outside this table may be added without a team decision recorded in `PROJECT.md` §6.

## System Boundaries

### Frontend (`frontend/src`)

- `app/` — router, route guards, top-level layout. No business logic.
- `api/` — the one HTTP client (`apiFetch`) and one module per resource (`authApi`, `activitiesApi`, `sessionsApi`, …). The only place that calls `fetch`.
- `auth/` — auth state (current user, token storage) and the login/register/logout pages. Protected API calls go through `useProtectedRequest()`, which passes the provider's token to the `api/` function and on `401` logs out and redirects to `/login` (spec 07 R4).
- `features/activities/` — student activity list; instructor activity list and editor.
- `features/workspace/` — the activity page: layout, problem statement, editor, results panel.
- `features/runner/` — Pyodide worker, main-thread runner wrapper, test checker. No React.
- `features/telemetry/` — event buffer and session lifecycle. Runs only on the activity page.
- `features/breaker/` — locked-runner panel and reflection form.
- `features/history/` — student session history.
- `components/` — shared presentational components (Button, TextField, Panel, Badge). No API calls.
- `styles/` — design tokens and global CSS.

### Backend (`backend/src/main/java/com/episteme/epistemictrace`)

One package per feature. Each package owns its controller, service, repository, entity and DTOs.

- `config/` — security, CORS, JWT and configuration-properties classes.
- `common/` — error handling (`ProblemDetail`), shared validation helpers.
- `auth/` — register, login, current user.
- `user/` — `User` entity and repository, consent, instructor seeding.
- `activity/` — activities, test cases, SDI config rows.
- `session/` — coding sessions (start/resume, end).
- `telemetry/` — event batch ingestion.
- `sdi/` — signal extraction and the SDI engine. Plain Java, no Spring or JPA types.
- `breaker/` — circuit-breaker state transitions (plain Java) and their persistence.
- `reflection/` — reflection submission.
- `history/` — student session history read models.

Dependencies point inward: controller → service → repository. `sdi` and `breaker` logic classes take plain inputs and return plain outputs so they can be unit tested without Spring.

## Storage Model

- **PostgreSQL** holds everything persistent: users, activities, test cases, SDI configs, sessions, telemetry events, reflections.
- **Browser `localStorage`** holds only the student's unsaved code draft, keyed per user and activity: `epistemictrace:draft:{userId}:{activityId}`.
- **Browser `sessionStorage`** holds only the JWT.
- Nothing else is stored in the browser. Telemetry is never written to browser storage; unsent events live in memory only.
- Schema changes are made only through new migration files; an applied migration is never edited.

### Schema

The data model from `PROJECT.md` §7, with these additions:

- `telemetry_events.client_event_id` (UUID, unique per session) — makes batch retries idempotent.
- `coding_sessions.runner_locked`, `coding_sessions.sdi_at_lock`, `coding_sessions.cooldown_ends_at` — the circuit-breaker state, stored server-side so the lock survives a refresh.
- `users.email` unique (stored lower-case); `created_at` on users and activities; `test_cases.position` for display order.

`ALERT` and `DEBUGGING_PROMPT` tables are created later by their own (should/could) specs, not in the MVP.

## Auth and Ownership Model

- Stateless JWT bearer tokens, signed HS256 with `JWT_SECRET` (at least 32 bytes).
- Token claims: `sub` = user id, `role`, `email`; lifetime 8 hours; no refresh token. Logout clears the token in the browser.
- Passwords are hashed with BCrypt, cost factor 10.
- Public endpoints: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, and any `OPTIONS` request. Everything else under `/api` requires a valid token.
- The `role` claim maps to exactly one authority, `ROLE_STUDENT` or `ROLE_INSTRUCTOR`; a token without a valid `role` claim is rejected with `401`. A wrong role gets `403` with a `ProblemDetail` body, detail "You don't have access to this."; no or invalid token stays `401`. Controllers read the caller with `config/CurrentUser` (`id()`, `role()`) and pass the id to services.
- Path rules in `SecurityConfig`, first match wins: the public endpoints above; `/api/auth/me` requires any authenticated user; `/api/instructor/**` requires role `INSTRUCTOR`; `/api/activities/**`, `/api/sessions/**` and `/api/me/**` require role `STUDENT`; any other `/api/**` path is denied (`403` with a token, `401` without). Each `/x/**` pattern also matches `/x` itself but not `/xy`. Outside `/api` there are no endpoints; those paths only require authentication, so error dispatches to `/error` keep working.
- Self-registration creates `STUDENT` accounts only. Instructor accounts are created by a seed runner from environment variables (Q3).
- An instructor can read and change only activities they created.
- A student can read and write only their own sessions, events and reflections. Not found → `404`; exists but not owned → `403`.
- MVP has no course or enrollment link. A session's instructor is the instructor who owns its activity (Q3).

## Code Execution Model

- Student code runs **only** in a browser Web Worker running Pyodide. The server never executes student code.
- Pyodide is loaded inside the worker; how it is loaded (npm package vs CDN `indexURL`) is **(Proposed — Q14)**.
- One test case = one execution: the program runs with the test's `input` as stdin, in a fresh global namespace, and its stdout is compared to `expected_output` **(Proposed — Q14)**.
- Output comparison: convert `\r\n` to `\n`, strip trailing whitespace from each line, drop trailing empty lines, then compare exactly **(Proposed — Q14)**.
- Time limit per test case: 3 seconds, excluding interpreter start-up **(Proposed — Q7)**. On timeout the main thread terminates the worker, marks the test `timeout`, marks remaining tests `not_run`, and creates a fresh worker for the next run.
- Runs are sequential; a second run cannot start while one is in progress.
- Hidden tests are hidden from **display** only. Their data must reach the browser because execution is browser-only, so "hidden" is not "secret" **(Proposed — Q8)**.

## Telemetry, SDI and Circuit Breaker Model

### Telemetry (Proposed — Q4)

- Event fields: `clientEventId` (UUID v4), `type` (`EDIT` / `RUN` / `ERROR`), `occurredAt` (ISO-8601 UTC, client clock), plus `charsAdded`/`charsRemoved` (EDIT), `passedCount`/`totalCount` (RUN), `errorSignature` (ERROR).
- EDIT coalescing: Monaco emits a change on every keystroke; consecutive changes within 2 seconds become one EDIT event (sums of chars added/removed, `occurredAt` = last change).
- One run produces at most one ERROR event (the first runtime error or timeout) followed by exactly one RUN event with the same `occurredAt` order: ERROR first, then RUN.
- Error signature: `<ExceptionType>@<line>` using the last traceback line inside the student's code, `<ExceptionType>@?` when unknown, `Timeout@?` for timeouts. Failed assertions on output are not errors.
- Batches: `{ "events": [...] }`, at most 200 events. Sent every 10 seconds when the buffer is non-empty, immediately after every RUN, and on page leave with `fetch(..., { keepalive: true })`.
- Failed sends are retried with the same `clientEventId`s; the server ignores duplicates.
- Capture starts only on the activity page, only after consent, and stops when the page unmounts.

### SDI (Proposed — Q1, Q2)

- **Where:** computed on the server when a batch containing RUN events is ingested. The server value is authoritative. The browser never computes the SDI.
- **When:** once per RUN event, in `occurredAt` order, using that session's events with `occurredAt` in `[run.occurredAt − window, run.occurredAt]`.
- **Signals and normalization** (each normalized value is in `[0, 1]`):

| # | Signal | Raw value | Normalized |
|---|---|---|---|
| 1 | Test-run frequency | `runs` = RUN events in window | `min(runs / runCap, 1)` |
| 2 | Edit-to-run time | median `gap` over RUNs in window; `gap` = seconds since the last EDIT before that RUN, or since the previous RUN if no EDIT came after it, or `gapCap` if neither exists | `1 − min(medianGap / gapCap, 1)` |
| 3 | Repeated error signatures | `repeats` = ERROR events in window − distinct signatures among them | `min(repeats / repeatCap, 1)` |
| 4 | No-progress runs | RUNs in window whose `passedCount` ≤ the best `passedCount` of any earlier RUN in the session; the session's first RUN never counts | `noProgressRuns / runs` |

- **Score:** `round(100 × Σ wᵢ·nᵢ)`, clamped to `[0, 100]`.
- **Proposed defaults:** `w = (0.20, 0.20, 0.25, 0.35)`, `runCap = 10`, `gapCap = 60 s`, `repeatCap = 5`, window 5 minutes, cooldown 120 seconds, threshold 70.
- Weights and caps are application configuration (`epistemictrace.sdi.*`). Threshold, cooldown and window are per-activity rows in `sdi_configs`, created from configured defaults.
- **Recording:** `sdi_value` is saved on the RUN event; `coding_sessions.peak_sdi` = max of its RUN values.
- **Struggle level** shown to students (never the number): `LOW` if SDI < 40, `MEDIUM` if 40 ≤ SDI < threshold, `HIGH` if SDI ≥ threshold. The 40 boundary is configuration.

### Circuit Breaker (Proposed — Q1, Q2, Q15)

State is stored on the session and changed only by the server, using server time (`now`).

```
Unlocked ──(scored RUN with SDI ≥ threshold, not in cooldown)──► Locked
Locked ──(valid reflection)──► Cooldown (cooldown_ends_at = now + cooldown)
Cooldown ──(now ≥ cooldown_ends_at)──► Unlocked
```

- `onRunScored(sdi)`: if `cooldown_ends_at > now` → no change. Else if not locked and `sdi ≥ threshold` → lock, `sdi_at_lock = sdi`. Else no change.
- `onReflection()`: allowed only when locked → unlock, `cooldown_ends_at = now + cooldown`; the reflection stores `sdi_at_trigger = sdi_at_lock`.
- `view(now)`: `LOCKED` if locked; `COOLDOWN` if `cooldown_ends_at > now`; otherwise `UNLOCKED`.
- RUN events that arrive while locked are stored and scored but cannot change the state.
- During cooldown the runner works normally; the cooldown only blocks a new lock.
- The browser disables **Run tests** while the state is `LOCKED`. It also keeps **Run tests** disabled from the end of a run until the server answers that run's batch, for at most 5 seconds; if the server does not answer, the runner stays usable (fail-open) and a notice is shown.
- **Session resume:** opening an activity resumes the student's latest session for that activity if it has no `ended_at` or ended less than 30 minutes ago (`ended_at` is cleared); otherwise a new session starts. A refresh therefore keeps the session and its lock **(Proposed — Q15)**.

### AI Assistant (Could Have)

Not part of the MVP. If built: never returns a full solution, every response is logged, and it follows its own spec.

## API Surface (Q5)

All endpoints are under `/api` and exchange JSON. Errors use Spring's `ProblemDetail` (`application/problem+json`) with `status`, `title`, `detail` and, for validation errors, an `errors` map of field → message.

| Method | Path | Role | Spec |
|---|---|---|---|
| GET | `/api/health` | public | existing |
| POST | `/api/auth/register` | public | 05 |
| POST | `/api/auth/login` | public | 05 |
| GET | `/api/auth/me` | any | 05 |
| PUT | `/api/me/consent` | STUDENT | 15 |
| GET, POST | `/api/instructor/activities` | INSTRUCTOR | 08 |
| GET, PUT | `/api/instructor/activities/{id}` | INSTRUCTOR | 08 |
| POST | `/api/instructor/activities/{id}/publish` | INSTRUCTOR | 08 |
| POST | `/api/instructor/activities/{id}/archive` | INSTRUCTOR | 08 |
| GET, POST | `/api/instructor/activities/{id}/test-cases` | INSTRUCTOR | 08 |
| PUT, DELETE | `/api/instructor/activities/{id}/test-cases/{testCaseId}` | INSTRUCTOR | 08 |
| GET | `/api/activities` | STUDENT | 08 |
| GET | `/api/activities/{id}` | STUDENT | 08 |
| POST | `/api/sessions` | STUDENT | 16 |
| POST | `/api/sessions/{id}/end` | STUDENT | 16 |
| POST | `/api/sessions/{id}/events` | STUDENT | 18, 21, 22 |
| POST | `/api/sessions/{id}/reflections` | STUDENT | 24 |
| GET | `/api/me/sessions` | STUDENT | 26 |
| GET | `/api/me/sessions/{id}` | STUDENT | 26 |

Student-facing responses never contain `sdi_value`, `peak_sdi`, `sdi_at_lock` or `sdi_at_trigger`.

## Invariants

1. Student code runs only in a browser Web Worker, with a time limit that stops infinite loops.
2. Telemetry is captured only on the activity page, only after consent, and the server refuses to start a session for a student without consent.
3. A student can write only their own events; session data is visible only to that student and the activity's instructor.
4. The SDI is always 0–100 and is never used for grading or penalties.
5. Students see struggle levels (low/medium/high), never raw scores, and never punishing wording.
6. The editor stays usable while the runner is locked.
7. SDI weights, caps, window, threshold and cooldown are configuration, never hard-coded constants in logic.
8. No real secrets, `.env` files or real student data are committed.
9. The AI assistant, if built, never returns a full solution, and its responses are logged.
10. Controllers do not contain business logic; the SDI engine and breaker transitions are plain, deterministic, unit-tested code.
11. Every endpoint that reads or writes user data checks role and ownership before doing anything else.
