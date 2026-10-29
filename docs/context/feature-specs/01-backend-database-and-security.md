# 01 — Backend Database and Security Setup

- **Card:** IMP-01 (https://trello.com/c/tnFrxNV4) · **Feature:** PLT-01 foundation
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** — (repository scaffold)
- **Gates:** Q9 (Flyway), Q12 (H2 for tests), Q13 (JWT design)

## Goal

The backend connects to PostgreSQL through JPA, runs Flyway migrations on start-up, and protects every `/api` endpoint except health, register and login with JWT bearer authentication. No tables or business endpoints yet.

## In Scope

- Dependencies for JPA, the PostgreSQL driver, Flyway, Spring Security, the OAuth2 resource server (JWT), Bean Validation, and test support (H2, Spring Security test).
- Datasource and JWT settings read from environment variables.
- A test configuration that uses H2 in PostgreSQL mode.
- A `SecurityFilterChain` with the public/protected rules below.
- JWT encoder/decoder beans using `JWT_SECRET` (HS256).
- A global error handler that returns `ProblemDetail` bodies.

## Out of Scope

- Tables, entities and repositories (spec 02).
- Register/login endpoints and token issuing logic (spec 05).
- Role rules per path (spec 06).
- CI (spec 03).

## Requirements

- **R1** Add dependencies with versions managed by the Spring Boot 4.1 parent. Check the Spring Boot 4.1 reference for the correct starter names (Boot 4 has separate starters for Flyway and for some test slices). Do not pin managed versions.
- **R2** Main configuration reads: `spring.datasource.url=${DB_URL}`, `spring.datasource.username=${DB_USERNAME}`, `spring.datasource.password=${DB_PASSWORD}`, `spring.jpa.hibernate.ddl-auto=validate`, `spring.jpa.open-in-view=false`, and `epistemictrace.jwt.secret=${JWT_SECRET}`. Use the existing configuration file format (properties or YAML); do not add the other.
- **R3** Flyway migration location is `classpath:db/migration`. An empty directory with a `.gitkeep` is enough in this unit.
- **R4** Test configuration (`src/test/resources`, profile or test properties) uses H2 in PostgreSQL mode (`jdbc:h2:mem:epistemictrace;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH`) and a fake test secret of at least 32 bytes. Tests never need a real database or `.env`.
- **R5** `JwtProperties` record bound to `epistemictrace.jwt` with `secret` (required, at least 32 bytes when UTF-8 encoded) and `ttl` (default `PT8H`). Start-up fails with a clear message if the secret is missing or too short.
- **R6** Beans: a `JwtEncoder` and `JwtDecoder` from Spring Security's Nimbus support using an HS256 `SecretKeySpec` built from the secret. No third-party JWT library.
- **R7** `SecurityFilterChain`:
  - stateless sessions, CSRF disabled (bearer tokens, no cookies), HTTP Basic and form login disabled;
  - `permitAll`: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, and CORS preflight `OPTIONS /**`;
  - every other request: `authenticated()`;
  - JWT resource server enabled with the decoder from R6;
  - CORS keeps the existing rule (origin `http://localhost:5173` only) and applies before authentication.
- **R8** Unauthenticated requests to protected paths return `401`. The body may be empty or a `ProblemDetail`; it must not be an HTML page.
- **R9** `common/GlobalExceptionHandler` (`@RestControllerAdvice`) turns `MethodArgumentNotValidException` into a `400` `ProblemDetail` with an `errors` map (field → message), and unexpected exceptions into a `500` `ProblemDetail` without a stack trace.
- **R10** Do not add any new `.env.example` keys in this unit.

## Parts

1. **Persistence:** R1 (JPA, PostgreSQL, Flyway, H2 test), R2 datasource lines, R3, R4. Check: `./mvnw test` passes; the app starts against a local PostgreSQL with `.env` values.
2. **Security:** R1 (security, resource server, validation, security test), R2 JWT line, R5–R10. Check: the tests below pass.

## Acceptance Criteria

- [ ] `./mvnw test` passes with no database running and no `.env` file.
- [ ] With `.env` pointing at a local PostgreSQL, `./mvnw spring-boot:run` starts and Flyway creates its history table.
- [ ] `GET /api/health` returns `200 {"status":"ok"}` without a token.
- [ ] `GET /api/anything-else` without a token returns `401`.
- [ ] A preflight `OPTIONS` request from `http://localhost:5173` succeeds; one from another origin does not get CORS headers.
- [ ] Start-up fails with a clear message when `JWT_SECRET` is shorter than 32 bytes.
- [ ] No secret value appears in committed files.

## Tests

- `HealthControllerTests` (existing) still pass, now through the security chain.
- `SecurityConfigTests` (MockMvc): health is public; an unknown protected path returns `401`; a request with a token signed by the test `JwtEncoder` passes authentication (expect `404` for an unmapped path, not `401`); CORS preflight from the allowed origin passes.
- `JwtPropertiesTests`: a 10-byte secret fails validation; a 32-byte secret passes.

## Docs to Update

- `PROJECT.md` §6: mark Auth, Database and Migrations rows as "In repo".
- `progress-tracker.md`: Completed entry with the starter names actually used.
