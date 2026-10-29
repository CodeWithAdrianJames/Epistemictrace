# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component, class or endpoint.
- Respect the system boundaries defined in `architecture-context.md`.
- Never hard-code SDI weights, caps, window, threshold, cooldown or reflection length in logic. Read them from configuration.
- Never commit real secrets, `.env` files or real student data. Test data uses obviously fake names and emails (`student1@example.test`).
- Do not add a dependency that is not in `architecture-context.md` → Stack. If a spec needs one, stop and add an open question.

## TypeScript

- `strict` mode stays on. Lint (`npm run lint`) and type checks (`npm run build`) must pass.
- Avoid `any`; use explicit interfaces or narrowly scoped types. Use `unknown` for untrusted input and narrow it.
- Use `interface` for object contracts and `type` for unions.
- Validate API responses at the `api/` boundary before the rest of the app trusts them.
- Formatting: 2-space indent, single quotes, no semicolons.
- Name files after their responsibility: `draftStore.ts`, `compareOutput.ts`, `ReflectionForm.tsx`.

## React

- Function components only.
- Components render; hooks and plain modules hold logic. A component never calls `fetch` directly — it uses `api/`.
- No global state library. Use component state, custom hooks and React context (auth only) **(Proposed — Q11)**.
- Effects that start timers, workers or listeners must clean them up on unmount.
- Long-running work (Python execution) never runs on the main thread.

## Java and Spring Boot

- Packages under `com.episteme.epistemictrace.<feature>`; tab indentation.
- Controllers are thin: parse and validate input (`@Valid` on request records), call one service method, map the result to a response DTO.
- Never return a JPA entity from a controller. Request and response DTOs are Java `record`s.
- Business rules live in services. The SDI engine (`sdi/`) and breaker transitions (`breaker/`) are plain Java classes with no Spring, JPA or clock dependencies; pass `Instant now` and configuration in as arguments.
- Configuration is bound with `@ConfigurationProperties` records and validated at startup.
- Use `java.time.Instant` for timestamps; store them as `timestamptz`.
- Do not pin versions that the Spring Boot parent already manages. In Spring Boot 4, some technologies (for example Flyway) and some test slices have their own starters — check the Spring Boot 4.1 reference and the existing `pom.xml` before adding a dependency, and do not guess artifact names.

## API

- All endpoints live under `/api`. Paths and payloads follow `architecture-context.md` → API Surface.
- Validate and parse request input before any logic runs.
- Check authentication, role and ownership before reading or changing data.
- Status codes: `200` read/update, `201` create, `204` no body, `400` invalid input, `401` no/invalid token, `403` wrong role or not the owner, `404` not found, `409` invalid state (for example, reflecting while not locked).
- Errors are `ProblemDetail` bodies. Validation errors add an `errors` map of field → message.
- Student-facing responses never include raw SDI values.
- CORS stays limited to `http://localhost:5173` until hosting is decided.

## Data and Storage

- All persistent data goes to PostgreSQL through Spring Data JPA.
- Schema changes go in a new migration file (`V<n>__<description>.sql`). Never edit a migration that has been merged.
- Write portable SQL that runs on PostgreSQL and on the test database (Q12).
- The only browser storage is the code draft (`localStorage`) and the token (`sessionStorage`).

## Testing

- Every spec lists its tests. A unit is not done until they pass locally.
- SDI engine and breaker transitions: deterministic JUnit tests with fixed timestamps. A seeded wheel-spinning sequence scores **above** 70; a steady-progress sequence scores **below** 70.
- Backend web layer: MockMvc tests for success, validation failure, `401`, `403` and `404` where they apply. Test classes are named `<Subject>Tests`.
- Frontend: Vitest unit tests for plain modules (runner wrapper, test checker, telemetry buffer, API client). Component tests only after Q12 is accepted.
- Code that cannot be tested automatically (the Pyodide worker in a real browser) is verified manually and the steps and result are attached to the Trello card as evidence.

## File Organization

- `frontend/src/app/` — router, guards, layout.
- `frontend/src/api/` — HTTP client and resource modules.
- `frontend/src/auth/` — auth state and auth pages.
- `frontend/src/features/<feature>/` — feature components, hooks and plain modules, with tests beside them (`*.test.ts`).
- `frontend/src/components/` — shared presentational components only.
- `frontend/src/styles/` — `tokens.css`, `global.css`.
- `backend/src/main/java/com/episteme/epistemictrace/<feature>/` — feature packages.
- `backend/src/main/resources/db/migration/` — migrations.
- `backend/src/test/java/com/episteme/epistemictrace/<feature>/` — tests mirroring main.

## Git and Review

- Branches: `feature/<issue#>-<name>` or `fix/<issue#>-<name>`; no direct pushes to `main`.
- Commits: `type: summary` (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`).
- One spec part per pull request. A PR touches either frontend or backend, not both, unless the spec says otherwise.
- Every PR is approved by someone other than the author. Member D (the professor) is never an assignee or reviewer.
