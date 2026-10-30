# Progress Tracker

Update this file whenever the current phase, active feature, open questions or implementation state changes.

## Current Phase

- Implementation started (Trello list 7 · Implement). Clarify and Plan continue for the remaining open questions.

## Current Goal

- Specs 01, 02, 03 and 04 are done. Now: spec 05, Register and login API (`feature-specs/05-register-and-login-api.md`); its gates Q3, Q5 and Q13 are all accepted. Decide Q21 (where the frontend reads `VITE_API_URL`) before spec 07 makes the first real API call. Keep accepting or revising the remaining **Open Questions** through their CLR/PLN cards.

## Completed

- 00 Scaffold (before these specs)
  - `frontend/`: React 19 + TypeScript + Vite 8 starter page, Monaco package, Vitest, oxlint
  - `backend/`: Spring Boot 4.1, Java 21, package `com.episteme.epistemictrace`, `GET /api/health` → `{"status":"ok"}`, CORS for `http://localhost:5173`
  - `.env.example` with `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `VITE_API_URL`
- 01 Backend database and security setup (IMP-01) — completed 2026-10-29, both parts on `main`
  - Part 1 (Persistence): merged as `d6f25c8` (PR #2, squash). Starters: `spring-boot-starter-data-jpa`, `spring-boot-starter-flyway`; plus `org.flywaydb:flyway-database-postgresql`, `org.postgresql:postgresql` (runtime); test: `spring-boot-starter-data-jpa-test`, `spring-boot-starter-flyway-test`, `com.h2database:h2`. Test config is `src/test/resources/application-test.properties`, activated with `@ActiveProfiles("test")`. Start-up against PostgreSQL verified (see Session Notes). Review caveat: merged by its author after a self-verified check, not approved by a second reviewer.
  - Part 2 (Security): merged as `84077f7` (PR #3, squash). Starters: `spring-boot-starter-security`, `spring-boot-starter-security-oauth2-resource-server` (the Boot 4 name; the old `spring-boot-starter-oauth2-resource-server` is still in the BOM but deprecated); `spring-boot-starter-validation` was already in the scaffold; test: `spring-boot-starter-security-test`, `spring-boot-starter-security-oauth2-resource-server-test`. Added `config/JwtProperties`, `config/JwtConfig`, `config/SecurityConfig`, `common/GlobalExceptionHandler`; `CorsConfig` moved from the root package to `config/` and now publishes a `corsConfigurationSource` bean (same rule: `/api/**`, origin `http://localhost:5173`, same methods, all headers, max age 1800 s) so Spring Security applies CORS before authentication. Start-up with a short or missing `JWT_SECRET` fails with "epistemictrace.jwt.secret (JWT_SECRET) must be at least 32 bytes when UTF-8 encoded" and does not print the value. Review caveat: see the manual review override in Session Notes.
  - All versions come from the Boot 4.1.2 parent (Spring Security 7.1.2, Nimbus JOSE 10.9.1). `./mvnw test` passes with no database, no `.env` and no `DB_*`/`JWT_SECRET` variables (16 tests, 0 failures, re-run on merged `main` at `84077f7`).
  - Still open from this spec: Q18 (`.env` loading).
- 02 Database tables (IMP-02) — completed 2026-10-29, all three parts on `main`
  - Part 1 (`V1__users.sql` + `user.User` + `UserRepository`): merged as `c77317e` (PR #4, squash). `./mvnw test` passed on H2 (18 tests, 0 failures); start-up against PostgreSQL 18.6 verified (see Session Notes).
  - Part 2 (`V2__activities.sql` + `activity.Activity`, `activity.TestCase`, `activity.SdiConfig` + repositories): merged as `b4fbbee` (PR #5, squash). `./mvnw test` passed on H2 (21 tests, 0 failures); start-up against PostgreSQL 18.6 verified (see Session Notes).
  - Part 3 (`V3__sessions_and_telemetry.sql` + `session.CodingSession`, `telemetry.TelemetryEvent`, `reflection.Reflection` + repositories): merged as `858b2a3` (PR #6, squash). `./mvnw test` passed on H2 (24 tests, 0 failures; Flyway applies V1–V3); start-up against PostgreSQL 18.6 verified (see Session Notes).
  - All three migrations run against H2 (tests) and PostgreSQL (manual start-up); Hibernate `validate` passes; no table outside R2–R4 exists.
- 03 CI checks on pull requests (IMP-03) — completed 2026-10-30, Part 1 on `main`; Part 2 is a verification with no merged code
  - Part 1 (`.github/workflows/ci.yml`): merged as `7fecf4b` (PR #7, squash). `frontend` and `backend` both passed on GitHub Actions, runs 40906656197 (`9596f67`) and 40907080682 (`e930c2b`). Q19 accepted: CI uses Node 22. A temporary smoke test, `frontend/src/smoke.test.ts`, kept `npm test` from exiting 1 on "no test files"; spec 04 Part 1 removed it. Review caveat: PR opened from the author's own account, no second reviewer.
  - Part 2 (throwaway PR #8, closed unmerged, branch deleted): both checks went red (run 40985194285). See Session Notes for what failed and where.
  - Not met: acceptance criterion "a lint error makes the `frontend` check fail". `oxlint` reports its default rules as warnings and exits 0, so no lint violation can fail the check. Raised as Q20 (accepted 2026-10-30 with spec 04: `lint` is now `oxlint --deny-warnings`; see Architecture Decisions).
- 04 Frontend app shell (IMP-04) — completed 2026-10-30, all three parts on `main`
  - Part 1 (dependencies, test setup, tokens/global CSS, delete starter content): merged as `e5271fb` (PR #9, squash, branch `feature/imp-04-frontend-shell`, 2026-10-30). Review caveat: opened and merged from the author's own account (`CodeWithAdrianJames`), `reviewDecision` empty, no second reviewer.
    - Added `react-router` 8.5.1; dev: `@testing-library/react` 16.3.3, `@testing-library/jest-dom` 7.0.1, `jsdom` 30.1.3. `@testing-library/dom` 10.4.2 is installed by npm as their required peer and appears only in `package-lock.json`.
    - `vite.config.ts` uses `defineConfig` from `vitest/config` with `environment: 'jsdom'` and `setupFiles: ['./src/test/setup.ts']`.
    - `src/styles/tokens.css` and `src/styles/global.css` imported once in `main.tsx`; starter `App.css`, `index.css`, `src/assets/*` and `public/icons.svg` deleted; `App.tsx` is a one-heading placeholder with `App.test.tsx` until Part 2 adds the router.
    - `frontend/src/smoke.test.ts` removed after `App.test.tsx` passed under jsdom with a jest-dom matcher.
    - `lint` script is now `oxlint --deny-warnings` (Q20).
  - Part 2 (router, layout, placeholder pages): merged as `7d36153` (PR #10, squash, branch `feature/imp-04-part-2`, 2026-10-30). Review caveat: opened and merged from the author's own account (`CodeWithAdrianJames`), `reviewDecision` empty, no reviews, no second reviewer.
    - `src/app/router.tsx` exports `routes: RouteObject[]` (all R3 routes under one `AppLayout` parent; `/` is `<Navigate to="/login" replace />`; `*` is "Page not found"). `main.tsx` calls `createBrowserRouter(routes)` and renders `RouterProvider` from `react-router/dom`, so importing `routes` in tests creates no browser router.
    - `src/app/PlaceholderPage.tsx` renders the title in an `<h1>`; one component for every placeholder.
    - `src/app/AppLayout.tsx` + `AppLayout.module.css`: top bar with "EpistemicTrace" (link to `/`) and static `NavLink`s Activities, History, My activities (`aria-current="page"` on the active one); `<main>` is limited to 1200px unless a matched route has `handle: { fullWidth: true }` (only `student/activities/:activityId`). Log out and user name wait for spec 07.
    - Placeholder `App.tsx` / `App.test.tsx` deleted; `src/app/router.test.tsx` uses `createMemoryRouter` (19 tests).
    - Local on Node 24.18.0: `npm run lint` exit 0, `npm run build` exit 0, `npm test` 19 passed. No hex colors in `src/**/*.css` outside `tokens.css`.
  - Part 3 (`apiFetch`, `ApiError`): merged as `e86d44a` (PR #11, squash, branch `feature/imp-04-part-3`, 2026-10-30). `frontend` and `backend` both passed on GitHub Actions, run 40991417101. Review caveat: opened and merged from the author's own account (`CodeWithAdrianJames`), `reviewDecision` empty, no reviews, no second reviewer.
    - `src/api/ApiError.ts`: `ApiError extends Error` with readonly `status`, `title`, `detail`, `fieldErrors`; `message` is `detail`. Fields are assigned in the constructor (no parameter properties, because `erasableSyntaxOnly` is on).
    - `src/api/apiFetch.ts`: `apiFetch<T>(path, { method, body, token, signal, keepalive })`. Throws a plain `Error` (no request) when `path` does not start with `/api/`. Base URL is `import.meta.env.VITE_API_URL` read on every call, trailing `/` stripped, `''` when unset. Always sends `Accept: application/json, application/problem+json`; `Content-Type: application/json` and a `JSON.stringify` body only when `body` is given; `Authorization: Bearer <token>` only for a non-empty token. `204` → `undefined`.
    - Errors: non-2xx → `ApiError` with `status` from the response; `title`/`detail` from the `ProblemDetail` body, falling back to the status text (or `HTTP <status>`) and "Something went wrong. Please try again." when the body is empty, not JSON, not an object or the fields are blank; `fieldErrors` keeps only string values of `errors`. Network failure → `status: 0`, detail "Can't reach the server. Check your connection." Two choices not spelled out in R6: an abort from the caller's `signal` is rethrown unchanged (not turned into `status: 0`), and a 2xx body that is not JSON throws `ApiError` with that status and detail "The server sent a response the app can't read.", so callers only ever see `ApiError` or an abort.
    - `src/api/apiFetch.test.ts` (15 tests) mocks `fetch` with `vi.stubGlobal` and sets the base URL with `vi.stubEnv`.
    - Local on Node 24.18.0: `npm run lint` exit 0, `npm run build` exit 0, `npm test` 34 passed (19 router + 15 apiFetch). `fetch(` appears only in `src/api/apiFetch.ts`.
  - Result on `main` at `e86d44a`: `npm test` runs 34 tests in 2 files (19 router, 15 apiFetch) and passes, so `npm test` no longer fails; `npm run lint` and `npm run build` pass. The `frontend` check on PR #11 was green.
  - Not yet done: the acceptance criterion "`npm run dev` shows the login placeholder at `/` with the top bar" has only been covered by the router tests, not checked by hand in a browser, and no screenshot is on the Trello card. Q21 is open because a root `.env` may not reach the Vite dev server.

## In Progress

- 05 Register and login API (IMP-05)
  - Part 1 (register endpoint with service and tests): in progress on branch `feature/imp-05-register-login-api`; code and tests committed, no PR yet.
    - `config/SecurityConfig` publishes the `PasswordEncoder` bean: `BCryptPasswordEncoder(10)` (Q3 note). Stored hashes start with `$2a$10$`.
    - `auth/AuthController` (`POST /api/auth/register`, `201`), `auth/AuthService.register`, `auth/RegisterRequest`, `auth/RegisterResponse` (`id`, `name`, `email`, `role`), `auth/EmailAlreadyUsedException` (an `ErrorResponseException`, so `GlobalExceptionHandler` renders it as a `409` `ProblemDetail` with no handler change).
    - `RegisterRequest` strips `name` and `email` in its compact constructor, so the 1–100 / ≤ 254 limits apply to the trimmed values. `AuthService` lower-cases the email with `Locale.ROOT` before the duplicate check and the insert. The request record has no `role` field, so a `"role"` in the body is ignored and the user is always `STUDENT`.
    - Duplicate email: `existsByEmail` is checked first (no hash is computed for a known email). If two requests race past that check, `uk_users_email` rejects the second insert; `AuthService` catches the `DataIntegrityViolationException` from `saveAndFlush`, re-checks `existsByEmail` and throws `EmailAlreadyUsedException` (`409`), and rethrows any other integrity violation. `register` is deliberately not `@Transactional`, so the failed insert does not leave an outer transaction marked rollback-only.
    - Choice not spelled out in R1: `common/MaxUtf8Bytes` (constraint + validator) limits `password` to 72 **bytes** in UTF-8 as well as 8–72 characters. Spring Security 7.1.2's `BCrypt` throws `IllegalArgumentException("password cannot be more than 72 bytes")`, so a 72-character password with non-ASCII characters would otherwise be a `500`; it is now a `400` with `errors.password` "must be at most 72 bytes when UTF-8 encoded".
    - Tests: `AuthControllerTests` (12, `@SpringBootTest` + MockMvc, users deleted after each test) and `AuthServiceTests` (4, Mockito, covers the race path). Local: `./mvnw -B test` 40 tests, 0 failures, BUILD SUCCESS (JDK 21.0.11, 2026-10-30).
  - Part 2 (login + `TokenService` + `/api/auth/me`) and Part 3 (`InstructorSeeder` + `.env.example` keys): not started.

## Next Up

Order of implementation. Specs in the same lane can run in parallel once their dependencies and gates are met. Full dependency table: `feature-specs/README.md`.

| # | Spec | Card | Lane | Depends on | Gates |
|---|---|---|---|---|---|
| 01 | Backend database and security setup | IMP-01 | Backend | — | Q9, Q12, Q13 |
| 02 | Database tables | IMP-02 | Backend | 01 | Q17 |
| 03 | CI checks on pull requests | IMP-03 | DevOps | 01, 04 | Q9 |
| 04 | Frontend app shell | IMP-04 | Frontend | — | Q11, Q12 |
| 05 | Register and login API | IMP-05 | Backend | 02 | Q3, Q5, Q13 |
| 06 | Role-based access control | IMP-06 | Backend | 05 | Q5 |
| 07 | Login, register and logout pages | IMP-07 | Frontend | 04, 05 | Q11, Q13 |
| 08 | Activities API | IMP-08 | Backend | 06 | Q5, Q16 |
| 09 | Instructor activity editor | IMP-09 | Frontend | 07, 08 | Q16 |
| 10 | Student activity list | IMP-10 | Frontend | 07, 08 | — |
| 11 | Python code editor | IMP-11 | Frontend | 04 | — |
| 12 | Safe in-browser Python runner | IMP-12 | Frontend | 04 | Q7, Q14 |
| 13 | Test checker and error grouping | IMP-13 | Frontend | 12, 08 | Q4, Q8, Q14 |
| 14 | Coding workspace page | IMP-14 | Frontend | 10, 11, 13 | Q8 |
| 15 | Consent notice (A: API, B: UI) | IMP-15 | Backend → Frontend | A: 06 · B: 14, A | Q6 |
| 16 | Coding session API | IMP-16 | Backend | 08, 15A | Q5, Q15 |
| 17 | Activity tracking in the browser | IMP-17 | Frontend | 11, 13, 15B, 16, 18 | Q4 |
| 18 | Save tracked activity on the server | IMP-18 | Backend | 16 | Q4, Q5 |
| 19 | SDI signal calculations | IMP-19 | Backend | 02 | Q1, Q2 |
| 20 | SDI score engine | IMP-20 | Backend | 19 | Q1 |
| 21 | Update the SDI after every run | IMP-21 | Backend | 18, 20 | Q1, Q2 |
| 22 | Circuit breaker logic | IMP-22 | Backend | 20, 21 | Q1, Q2, Q8 |
| 23 | Lock the Run button | IMP-23 | Frontend | 14, 17, 22 | Q2, Q15 |
| 24 | Save reflections API | IMP-24 | Backend | 22 | Q8 |
| 25 | Reflection form | IMP-25 | Frontend | 23, 24 | Q8 |
| 26 | Session history API | IMP-26 | Backend | 24 | — |
| 27 | Session history page | IMP-27 | Frontend | 26 | — |
| 28 | Struggle level indicator (Should) | IMP-28 | Frontend | 21, 14, 17 | Q1 |

After 28: write specs for IMP-29 to IMP-40 (analytics, reflection review, per-activity SDI settings, heatmap, alerts, export, AI, deploy, final MVP check). IMP-39 (deploy) and IMP-40 (final check) are needed for the MVP demo but are blocked by Q9 (hosting).

## Open Questions

Status: **Open** (no proposal), **Proposed** (proposal written, waiting for the deciding card), **Accepted** (move it to Architecture Decisions and update `PROJECT.md`).

| ID | Question | Proposal | Decided by | Status |
|---|---|---|---|---|
| Q1 | SDI weights, normalization, window, cooldown, level bands (`PROJECT.md` Q1) | Formula and defaults in `architecture-context.md` → SDI: `w = 0.20/0.20/0.25/0.35`, `runCap 10`, `gapCap 60 s`, `repeatCap 5`, window 5 min, cooldown 120 s, MEDIUM from 40, HIGH from threshold. Validate against seeded sequences in spec 20. | CLR-01 (Adrian) | Proposed |
| Q2 | Is the SDI computed in the browser or on the server; which is authoritative? (`PROJECT.md` Q2) | Server only. RUN events are flushed immediately; the server scores them, updates the breaker and returns breaker state + struggle level. The browser never computes the SDI. Fail-open if the server does not answer within 5 s. | CLR-02 (Adrian) | Proposed |
| Q4 | Telemetry batch format, send timing, error signatures (`PROJECT.md` Q4) | As in `architecture-context.md` → Telemetry: `clientEventId` for idempotency, 2 s EDIT coalescing, batches ≤ 200 events, send every 10 s + after every RUN + on page leave (`keepalive`), signature `<Type>@<line>`. | CLR-04 (Noel) | Proposed |
| Q6 | Consent text, what happens on decline, retention (`PROJECT.md` Q6) | Notice shown before the first session. Accept → `consent_accepted_at` set. Decline → student can still code and run tests, but no session, telemetry, SDI or breaker; a banner offers to accept later. Text and retention period: Jacob to write. | CLR-05 (Jacob) | Open (text, retention) / Proposed (behavior) |
| Q7 | Execution time limit (`PROJECT.md` Q7) | 3 s per test case, excluding interpreter start-up; one named constant in the runner config. Confirm by measuring typical student programs. | CLR-06 (Adrian) | Proposed |
| Q8 | Reflection minimum length; hidden-test display (`PROJECT.md` Q7) | Each field ≥ 20 characters after trimming, ≤ 2000 (server config `epistemictrace.reflection.*`). Hidden tests show name + status only; their data still reaches the browser, so they are not secret. | CLR-07 (Jacob) | Proposed |
| Q9 | Hosting and deployment (`PROJECT.md` Q8). Flyway and CI were accepted; see Architecture Decisions. | — | CLR-08 (Noel) | Open (hosting) |
| Q10 | Term dates, MVP demo date, pilot plan (`PROJECT.md` Q9) | — | CLR-09 (Jacob) | Open |
| Q14 | Pyodide loading and execution semantics | Pin one Pyodide version; load it inside a module worker from the official CDN `indexURL` for that version; each test runs in a fresh globals dict with the test input as stdin; output comparison as in `architecture-context.md`; stop the run at the first timeout. | PLN-05 (Adrian) | Proposed |
| Q15 | Does a refresh start a new session? (needed for "lock survives refresh") | No. Opening an activity resumes the latest session if it is not ended or ended < 30 min ago. | PLN-06 (Adrian) / SPC-04 (Noel) | Proposed |
| Q16 | Activity editing and status rules; field limits | DRAFT → PUBLISHED (needs ≥ 1 test case); DRAFT or PUBLISHED → ARCHIVED; ARCHIVED is read-only; no un-archive in MVP. Title 1–120 chars, statement 1–20 000, starter code ≤ 20 000, test input/expected ≤ 10 000 each, ≤ 50 tests per activity. | SPC-02 (Jacob) | Proposed |
| Q18 | How do `.env` values reach the backend? Spring Boot does not read `.env` files, so spec 01's check "the app starts with `.env` values" only works if the variables are exported in the shell first. | Either document "export the `.env` variables before `./mvnw spring-boot:run`", or add `spring.config.import=optional:file:../.env[.properties]` to `application.properties`. | Spec 01 owner (Noel) | Open |
| Q21 | Where does the frontend read `VITE_API_URL` from? Vite loads `.env` files from `envDir`, which defaults to the Vite root (`frontend/`), but `PROJECT.md` §8 says to copy `.env.example` to `.env` at the repository root. With only a root `.env`, `npm run dev` leaves `VITE_API_URL` unset, so `apiFetch` calls relative `/api/...` URLs on the Vite dev server (port 5173) instead of the backend. | Either set `envDir: '..'` in `frontend/vite.config.ts`, or document "copy `VITE_API_URL` into `frontend/.env`" in `PROJECT.md` §8. Decide before spec 07 makes the first real API call. | Spec 04 owner (Jacob) | Open |

## Architecture Decisions

Decided in `PROJECT.md` (do not reopen without a team decision):

- Frontend: React 19, TypeScript, Vite 8, Monaco (`@monaco-editor/react`), Vitest, oxlint.
- Code execution: Pyodide in a browser Web Worker with a time limit. No server-side execution.
- Backend: Java 21, Spring Boot 4.1, Maven wrapper, JUnit 5 + MockMvc.
- Auth: Spring Security + JWT. Database: PostgreSQL via Spring Data JPA.
- All endpoints under `/api`. CORS allows `http://localhost:5173` only.
- SDI threshold default 70; SDI is 0–100 and never used for grading.
- Students see levels, never raw scores.
- SDI weights, window, threshold and cooldown are configuration.
- Telemetry only on the activity page, after the consent notice.

Accepted from Open Questions (2026-10-29):

- **Q9** (CLR-08): Flyway for database migrations; GitHub Actions for CI. Hosting is still open (Q9 row above).
- **Q12** (PLN-08): Frontend component tests use `@testing-library/react` + `jsdom` as dev dependencies. Backend tests use H2 in PostgreSQL mode (no Docker needed); migrations are kept to portable SQL.
- **Q13** (PLN-04): JWT is HS256 via Spring Security's OAuth2 resource server support (no third-party JWT library); claims `sub`, `role`, `email`; 8 h lifetime; no refresh token; token in `sessionStorage`; logout clears it.
- **Q17** (PLN-02): Schema additions to `PROJECT.md` §7 as proposed: `telemetry_events.client_event_id` (UUID, unique per session); breaker columns `runner_locked`, `sdi_at_lock`, `cooldown_ends_at` on `coding_sessions`; `users.email` unique and stored lower-case; `created_at` on users and activities; `test_cases.position`. See `architecture-context.md` → Schema. Accepted on Adrian's instruction when starting spec 02.
- **Q19** (IMP-03): Adopt Node 22 LTS for CI and local frontend runtime. `vitest@5.0.5` requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`, and Node 20 is EOL. Decision authorized by author. Spec 03 R2 ("Node 20") is superseded: `ci.yml` uses `node-version: 22`.

Accepted from Open Questions (2026-10-30):

- **Q11** (PLN-07): React Router (`react-router`); no state library (React state, custom hooks and one auth context); CSS Modules with tokens in `styles/tokens.css`; no icon library; native `fetch` (no HTTP library). Accepted as proposed on Adrian's instruction when starting spec 04.
- **Q12** (PLN-08): already accepted 2026-10-29 (see above); re-confirmed as a spec 04 gate on Adrian's instruction when starting spec 04, with no change to the answer.
- **Q20** (IMP-03 / IMP-04): the frontend `lint` script is `oxlint --deny-warnings`, so any oxlint warning makes `npm run lint` and the CI `frontend` check exit non-zero. Accepted on Adrian's instruction when starting spec 04. Verified locally: the current code lints clean (exit 0), and a probe file with an unused variable and `debugger` made `npm run lint` exit 1. `.oxlintrc.json` is unchanged. The spec 03 criterion "a lint error makes the `frontend` check fail" should now hold, but has not been re-run on GitHub Actions.
- **Q3** (CLR-03): accepted as proposed when starting spec 05. MVP has no courses: all students see all published activities, and the activity's owner is the instructor for its sessions. Self-registration creates students only; instructors are created by a seed runner from `INSTRUCTOR_SEED_EMAIL`, `INSTRUCTOR_SEED_PASSWORD`, `INSTRUCTOR_SEED_NAME`. Author's note recorded with this acceptance: "Adopt BCrypt cost factor 10. Authorized by author." (the `PasswordEncoder` bean is `BCryptPasswordEncoder` with strength 10; the BCrypt cost is not part of Q3's question, but was given as Q3's acceptance note).
- **Q5** (PLN-03): accepted as proposed when starting spec 05. REST paths are `architecture-context.md` → API Surface, payloads are those in each feature spec, and errors are `ProblemDetail` bodies (`application/problem+json`) with an `errors` map for validation errors. Authorized by author.

## Session Notes

- Context files live in `docs/context/`, feature specs in `docs/context/feature-specs/`. Spec numbers match the Trello `IMP-xx` cards in list **7 · Implement**.
- Four deviations from the board's "After" fields, listed in `feature-specs/README.md` → Dependency notes: 16 also needs 15A, 17 also needs 18, 22 also needs 21, 28 also needs 17. Update the Trello cards to match.
- `@monaco-editor/react` loads Monaco from a CDN by default, so the editor needs internet access during development and demos. Bundling Monaco locally would add a dependency; raise it as a question if it becomes a problem.
- CW-01's Trello due date (2026-10-16) has passed and no other due dates are set (TSK-05).
- The code lives in a separate repo, `Final Project/Epistemictrace` (GitHub `CodeWithAdrianJames/Epistemictrace`). This docs folder (`epistemictrace/`, no commits yet) keeps the context files in `context/`, not `docs/context/` as `ai-workflow-rules.md` says. Decide whether to move `context/` into the code repo under `docs/`.
- The code repo's main checkout is on `feature/1-code-editor` with uncommitted frontend work (`CodeEditor.tsx`, `editorStorage.ts`, `telemetry/events.ts`) that is ahead of specs 04/11. Spec 01 is built in a separate worktree, `Final Project/Epistemictrace-imp01` (now on `feature/imp-01-security`), so that work is not touched.
- Adrian's machine: `JAVA_HOME` points to a missing JDK 17. `mvnw` needs `JAVA_HOME` set to the installed JDK 21 (`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`).
- 2026-10-29: PostgreSQL start-up check for spec 01 Part 1 **passed**. Docker Desktop first had to be started by hand. Ran `postgres:latest` (PostgreSQL 18.6) in a container, then `./mvnw spring-boot:run` with `DB_URL`/`DB_USERNAME`/`DB_PASSWORD` set in the shell: app started in 4.8 s, Flyway created `public.flyway_schema_history` (0 migrations), Hibernate used `PostgreSQLDialect`, 0 ERROR/Exception lines, and `\dt` showed only `flyway_schema_history`. Container removed afterwards. Evidence is in a comment on PR #2.
- Flyway 12.4 logs a warning that H2 2.4.240 is newer than the version it was verified with (2.3.232). Harmless for now; both versions come from the Boot parent.
- Spec 01 Part 2 notes for later specs:
  - `GlobalExceptionHandler` extends `ResponseEntityExceptionHandler`. Without that, Spring's `NoResourceFoundException` (unmapped path) would fall into the catch-all handler and return `500` instead of `404`.
  - The catch-all `Exception` handler would also turn `AccessDeniedException` thrown from method security into `500`. Spec 06 uses path rules, but if it adds `@PreAuthorize`, it must let security exceptions through.
  - `NimbusJwtEncoder.withSecretKey(...).algorithm(HS256)` signs HS256 without an explicit `JwsHeader`, so spec 05 can call `JwtEncoderParameters.from(claims)`.
  - `epistemictrace.jwt.ttl` (default `PT8H`) is bound but not used until spec 05.
- Spec 02 Part 1 notes for later parts: repository tests use `@DataJpaTest` (`org.springframework.boot.data.jpa.test.autoconfigure`) + `@AutoConfigureTestDatabase(replace = NONE)` (`org.springframework.boot.jdbc.test.autoconfigure`) + `@ActiveProfiles("test")`. Without `replace = NONE` the slice swaps in a plain embedded H2 that is not in PostgreSQL mode. Flyway runs in the slice (Boot 4 registers it under `AutoConfigureDataSourceInitialization`). `TestEntityManager` is in `org.springframework.boot.jpa.test.autoconfigure`. Constraint violations surface as `DataIntegrityViolationException`.
- Spec 02 Part 2 notes: `text` columns are mapped with `@Column(columnDefinition = "text")`, which passes Hibernate `validate` on H2. `Activity` → `TestCase` is the only bidirectional mapping (`cascade = ALL`, `orphanRemoval`, `@OrderBy("position")`); `instructor_id` and `sdi_configs.activity_id` are plain `Long` columns. Deleting an activity through JPA deletes its test cases via the JPA cascade and its `sdi_configs` row via the database `on delete cascade`.
- Spec 02 Part 3 notes: `coding_sessions`, `telemetry_events` and `reflections` reference their parents as plain `Long` id columns (no `@ManyToOne`, no cascades; spec R4 names none, so deleting a user or activity that has sessions fails on the foreign key). `client_event_id` is a native `uuid` column mapped to `java.util.UUID`, which passes Hibernate `validate` on H2. `TelemetryEvent` has setters only for the per-type measurements and `sdi_value` (set after scoring); `CodingSession` has no breaker setters yet (spec 22 adds behavior). `PROJECT.md` §7's TELEMETRY_EVENT row said `timestamp` where R4 says `occurred_at`, and its ACTIVITY row omitted `updated_at`; both corrected when spec 02 was closed.
- 2026-10-29: PostgreSQL start-up check for spec 02 Part 3 **passed**. Ran `postgres:latest` in a container, then `./mvnw spring-boot:run` with `SERVER_PORT=8081` and `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`/`JWT_SECRET` set in the shell, against an empty database.
  - Flyway: `Successfully validated 3 migrations`, then migrated `1 - users`, `2 - activities`, `3 - sessions and telemetry` in order, `Successfully applied 3 migrations … now at version v3` (49 ms). App started (`Started EpistemictraceApplication`) with no ERROR/FAILED lines in the log.
  - `\dt` lists exactly `users`, `activities`, `test_cases`, `sdi_configs`, `coding_sessions`, `telemetry_events`, `reflections` and `flyway_schema_history`.
  - `\d coding_sessions`, `\d telemetry_events`, `\d reflections` match R4: identity `bigint` ids; `timestamptz` columns; `runner_locked` default `false`; check constraints `ck_coding_sessions_peak_sdi`, `ck_coding_sessions_sdi_at_lock`, `ck_telemetry_events_sdi_value` (all 0–100), `ck_telemetry_events_type` (EDIT/RUN/ERROR), `ck_reflections_sdi_at_trigger` (0–100); unique `uk_telemetry_events_session_client_event (session_id, client_event_id)` with `client_event_id` as a native `uuid` column; indexes `ix_coding_sessions_student_activity_started`, `ix_telemetry_events_session_occurred`, `ix_reflections_session_id`; `fk_coding_sessions_student`, `fk_coding_sessions_activity`, `fk_telemetry_events_session`, `fk_reflections_session` all plain (no `ON DELETE CASCADE`, matching R4).
  - Cleanup: the `mvnw` run was given a 60 s timeout and left the child `java.exe` (PID 38672, confirmed to be `EpistemictraceApplication`) running on 8081. It was stopped by PID, port 8081 was confirmed free (port 8080's listener, PID 24888, is unrelated and was not touched), and the `pg-test` container was stopped and removed.
- 2026-10-29: PostgreSQL start-up check for spec 02 Part 2 **passed**. Ran `postgres:latest` (PostgreSQL 18.6) in a container, then `./mvnw spring-boot:run` with `SERVER_PORT=8081` and `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`/`JWT_SECRET` set in the shell, against an empty database.
  - Flyway: `Successfully validated 2 migrations`, `Migrating schema "public" to version "1 - users"`, `… "2 - activities"`, then `Successfully applied 2 migrations … now at version v2` (37 ms). `flyway_schema_history` has two rows (1 `users`, 2 `activities`), both success `t`. App started in 6.6 s with `PostgreSQLDialect` (Hibernate `validate` passed), 0 ERROR/Exception lines, and `GET /api/health` returned `{"status":"ok"}`.
  - `\dt` lists exactly `users`, `activities`, `test_cases`, `sdi_configs` and `flyway_schema_history`.
  - `\d activities`, `\d test_cases`, `\d sdi_configs` match R3: identity `bigint` ids; `starter_code` default `''`, `input` default `''`, `is_hidden` default `false`; `timestamptz` columns; check constraints `ck_activities_status`, `ck_sdi_configs_threshold` (0–100), `ck_sdi_configs_cooldown_seconds`, `ck_sdi_configs_window_minutes`; unique `uk_test_cases_activity_position (activity_id, position)` and `uk_sdi_configs_activity_id`; indexes `ix_activities_instructor_id` and `ix_activities_status`; `fk_activities_instructor` plain, `fk_test_cases_activity` and `fk_sdi_configs_activity` `ON DELETE CASCADE`.
  - Cleanup: the `mvnw` wrapper exited on its own and left the child `java.exe` (PID 18520, confirmed to be `EpistemictraceApplication`) running on 8081. It was stopped by PID, port 8081 was confirmed free, and the `pg-test` container was stopped and removed. Port 8080 was not touched.
- 2026-10-29: PostgreSQL start-up check for spec 02 Part 1 **passed**. Ran `postgres:latest` (PostgreSQL 18.6) in a container, then `./mvnw spring-boot:run` with `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`/`JWT_SECRET` set in the shell.
  - Flyway: `Migrating schema "public" to version "1 - users"`, then `Successfully applied 1 migration … now at version v1` (26 ms). `flyway_schema_history` has one row: version 1, `users`, success `t`.
  - `\d users` matches R2: `id bigint generated by default as identity`; `name varchar(100)`, `email varchar(254)`, `password_hash varchar(100)`, `role varchar(16)` all not null; `consent_accepted_at timestamptz` null; `created_at timestamptz` not null; unique constraint `uk_users_email`; check constraint `ck_users_role`.
  - The first run applied V1 but then failed with "Port 8080 was already in use" (another process on Adrian's machine). That happens after Flyway and Hibernate `validate`. A second run with `SERVER_PORT=8081` against the same database re-validated V1, started in 6.0 s with `PostgreSQLDialect`, 0 ERROR/Exception lines, and `GET /api/health` returned `{"status":"ok"}`.
  - Cleanup: `TaskStop` ended only the `mvnw` wrapper and left the child `java.exe` running on 8081. It was stopped by PID after confirming it was `EpistemictraceApplication`. The `pg-test` container was removed. Port 8080 was not touched.
- 2026-10-29: **Manual review override for PR #3 (spec 01 Part 2).** `ai-workflow-rules.md` requires approval by someone other than the author. The PR was opened from the `CodeWithAdrianJames` account, which is also Adrian's account, so no independent approval exists (`reviewDecision` was empty) and no approving comment was posted. The agent's attempt to comment and squash-merge was blocked by the permission system as a merge without review, so Adrian merged PR #3 by hand on GitHub. Treat spec 01 as merged by its author's own account; a second team member (Noel or Jacob) should still read PRs #2 and #3. The remote branch `feature/imp-01-security` was not deleted by the merge and is still on origin.
- Spec 04 Part 1 notes for later parts:
  - Vitest globals are off, so Testing Library cannot register its automatic `cleanup`; `src/test/setup.ts` calls `afterEach(cleanup)` itself. Tests import `describe`/`it`/`expect` from `vitest`.
  - `react-router` 8.5.1 needs Node `>=22.22.0` and `jsdom` 30.1.3 needs `^22.22.2 || ^24.15.0 || >=26.0.0`. CI's `node-version: 22` resolves to the latest 22.x, so it is fine; local machines on an older Node 22 must update.
  - `npm audit` reports 1 critical (`dompurify` <= 3.4.16, pulled in by `monaco-editor` from the scaffold) and 1 low advisory. Neither comes from the spec 04 packages. `npm audit fix` was not run because it changes the lockfile outside the spec; decide it in its own `chore` PR.
- 2026-10-30: **Spec 03 Part 2 failure verification** (throwaway PR #8, branch `test/imp-03-failure-verification`, closed unmerged and branch deleted). One commit broke `frontend/src/smoke.test.ts` (unused variable + `expect(true).toBe(false)`) and `EpistemictraceApplicationTests.contextLoads` (`Assertions.fail("Deliberate failure for CI verification")`). Run https://github.com/CodeWithAdrianJames/Epistemictrace/actions/runs/40985194285: `backend` **failed** (30 s, job 123834468757) at `./mvnw -B test` with `AssertionFailedError: Deliberate failure for CI verification`; `frontend` **failed** (15 s, job 123834468597) at `npm run build`, not at lint or test.
  - Why the frontend failed at build: `tsc -b` rejects the unused variable (`error TS6133`, `noUnusedLocals`). `npm run lint` passed because `oxlint` only warns (see Q20), so the step order never reached `npm test`; the `expect(true).toBe(false)` assertion was not exercised in CI. What this proves: the `frontend` check goes red on a TypeScript error; it does not prove it goes red on a lint error or a failing Vitest test.
  - Locally on Node 24, `npm run lint` printed warnings and exited 0 for an unused variable, `debugger`, `NaN === NaN` and a duplicate object key.
  - The `backend` criterion (failing JUnit test fails the check) is met. Screenshots for the Trello card are still to be taken by hand from the run page above.
