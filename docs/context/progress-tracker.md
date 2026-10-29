# Progress Tracker

Update this file whenever the current phase, active feature, open questions or implementation state changes.

## Current Phase

- Implementation started (Trello list 7 · Implement). Clarify and Plan continue for the remaining open questions.

## Current Goal

- Spec 01 is done. Spec 02 is in progress (Q17 accepted). Start `feature-specs/04-frontend-app-shell.md` once Q11 is accepted. Keep accepting or revising the remaining **Open Questions** through their CLR/PLN cards.

## Completed

- 00 Scaffold (before these specs)
  - `frontend/`: React 19 + TypeScript + Vite 8 starter page, Monaco package, Vitest, oxlint
  - `backend/`: Spring Boot 4.1, Java 21, package `com.episteme.epistemictrace`, `GET /api/health` → `{"status":"ok"}`, CORS for `http://localhost:5173`
  - `.env.example` with `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `VITE_API_URL`
  - `npm test` fails because no test exists yet (fixed by spec 04)
- 01 Backend database and security setup (IMP-01) — completed 2026-10-29, both parts on `main`
  - Part 1 (Persistence): merged as `d6f25c8` (PR #2, squash). Starters: `spring-boot-starter-data-jpa`, `spring-boot-starter-flyway`; plus `org.flywaydb:flyway-database-postgresql`, `org.postgresql:postgresql` (runtime); test: `spring-boot-starter-data-jpa-test`, `spring-boot-starter-flyway-test`, `com.h2database:h2`. Test config is `src/test/resources/application-test.properties`, activated with `@ActiveProfiles("test")`. Start-up against PostgreSQL verified (see Session Notes). Review caveat: merged by its author after a self-verified check, not approved by a second reviewer.
  - Part 2 (Security): merged as `84077f7` (PR #3, squash). Starters: `spring-boot-starter-security`, `spring-boot-starter-security-oauth2-resource-server` (the Boot 4 name; the old `spring-boot-starter-oauth2-resource-server` is still in the BOM but deprecated); `spring-boot-starter-validation` was already in the scaffold; test: `spring-boot-starter-security-test`, `spring-boot-starter-security-oauth2-resource-server-test`. Added `config/JwtProperties`, `config/JwtConfig`, `config/SecurityConfig`, `common/GlobalExceptionHandler`; `CorsConfig` moved from the root package to `config/` and now publishes a `corsConfigurationSource` bean (same rule: `/api/**`, origin `http://localhost:5173`, same methods, all headers, max age 1800 s) so Spring Security applies CORS before authentication. Start-up with a short or missing `JWT_SECRET` fails with "epistemictrace.jwt.secret (JWT_SECRET) must be at least 32 bytes when UTF-8 encoded" and does not print the value. Review caveat: see the manual review override in Session Notes.
  - All versions come from the Boot 4.1.2 parent (Spring Security 7.1.2, Nimbus JOSE 10.9.1). `./mvnw test` passes with no database, no `.env` and no `DB_*`/`JWT_SECRET` variables (16 tests, 0 failures, re-run on merged `main` at `84077f7`).
  - Still open from this spec: Q18 (`.env` loading).

## In Progress

- 02 Database tables (IMP-02)
  - Part 1 (`V1__users.sql` + `user.User` + `UserRepository`): merged as `c77317e` (PR #4, squash). `./mvnw test` passed on H2 (18 tests, 0 failures); start-up against PostgreSQL 18.6 verified (see Session Notes).
  - Part 2 (`V2__activities.sql` + `activity.Activity`, `activity.TestCase`, `activity.SdiConfig` + repositories): in progress on branch `feature/imp-02-part-2`. Code, `ActivityStatus`, `ActivityRepository`/`TestCaseRepository`/`SdiConfigRepository` and `ActivityRepositoryTests` written; `./mvnw test` passes locally on H2 (21 tests, 0 failures). Start-up against PostgreSQL 18.6 verified (see Session Notes). PR #5 opened; no review yet.
  - Part 3: not started.
- Spec 04 (gate Q11) is the other unblocked-by-dependency spec, but Q11 is still **Proposed**.

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
| Q3 | Student–instructor link; how instructor accounts are created (`PROJECT.md` Q3) | MVP: no courses. All students see all published activities. The activity's owner is the instructor for its sessions. Self-registration creates students only; instructors are created by a seed runner from `INSTRUCTOR_SEED_EMAIL`, `INSTRUCTOR_SEED_PASSWORD`, `INSTRUCTOR_SEED_NAME`. | CLR-03 (Noel) | Proposed |
| Q4 | Telemetry batch format, send timing, error signatures (`PROJECT.md` Q4) | As in `architecture-context.md` → Telemetry: `clientEventId` for idempotency, 2 s EDIT coalescing, batches ≤ 200 events, send every 10 s + after every RUN + on page leave (`keepalive`), signature `<Type>@<line>`. | CLR-04 (Noel) | Proposed |
| Q5 | REST API paths and payloads (`PROJECT.md` Q5) | `architecture-context.md` → API Surface plus the payloads in each spec; errors as `ProblemDetail`. | PLN-03 (Noel) | Proposed |
| Q6 | Consent text, what happens on decline, retention (`PROJECT.md` Q6) | Notice shown before the first session. Accept → `consent_accepted_at` set. Decline → student can still code and run tests, but no session, telemetry, SDI or breaker; a banner offers to accept later. Text and retention period: Jacob to write. | CLR-05 (Jacob) | Open (text, retention) / Proposed (behavior) |
| Q7 | Execution time limit (`PROJECT.md` Q7) | 3 s per test case, excluding interpreter start-up; one named constant in the runner config. Confirm by measuring typical student programs. | CLR-06 (Adrian) | Proposed |
| Q8 | Reflection minimum length; hidden-test display (`PROJECT.md` Q7) | Each field ≥ 20 characters after trimming, ≤ 2000 (server config `epistemictrace.reflection.*`). Hidden tests show name + status only; their data still reaches the browser, so they are not secret. | CLR-07 (Jacob) | Proposed |
| Q9 | Hosting and deployment (`PROJECT.md` Q8). Flyway and CI were accepted; see Architecture Decisions. | — | CLR-08 (Noel) | Open (hosting) |
| Q10 | Term dates, MVP demo date, pilot plan (`PROJECT.md` Q9) | — | CLR-09 (Jacob) | Open |
| Q11 | Frontend router, state management, styling, icons | React Router (`react-router`); no state library (React state + one auth context); CSS Modules with tokens in `styles/tokens.css`; no icon library; native `fetch` (no HTTP library). | PLN-07 (Jacob) | Proposed |
| Q14 | Pyodide loading and execution semantics | Pin one Pyodide version; load it inside a module worker from the official CDN `indexURL` for that version; each test runs in a fresh globals dict with the test input as stdin; output comparison as in `architecture-context.md`; stop the run at the first timeout. | PLN-05 (Adrian) | Proposed |
| Q15 | Does a refresh start a new session? (needed for "lock survives refresh") | No. Opening an activity resumes the latest session if it is not ended or ended < 30 min ago. | PLN-06 (Adrian) / SPC-04 (Noel) | Proposed |
| Q16 | Activity editing and status rules; field limits | DRAFT → PUBLISHED (needs ≥ 1 test case); DRAFT or PUBLISHED → ARCHIVED; ARCHIVED is read-only; no un-archive in MVP. Title 1–120 chars, statement 1–20 000, starter code ≤ 20 000, test input/expected ≤ 10 000 each, ≤ 50 tests per activity. | SPC-02 (Jacob) | Proposed |
| Q18 | How do `.env` values reach the backend? Spring Boot does not read `.env` files, so spec 01's check "the app starts with `.env` values" only works if the variables are exported in the shell first. | Either document "export the `.env` variables before `./mvnw spring-boot:run`", or add `spring.config.import=optional:file:../.env[.properties]` to `application.properties`. | Spec 01 owner (Noel) | Open |

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
