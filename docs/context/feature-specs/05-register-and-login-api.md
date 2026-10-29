# 05 — Register and Login API

- **Card:** IMP-05 (https://trello.com/c/8oY7ZgZN) · **Feature:** PLT-01 / M1
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** 02
- **Gates:** Q3 (students self-register, instructors seeded), Q5 (paths and payloads), Q13 (JWT design)

## Goal

Students can register; any user can log in and receive a JWT; a logged-in user can fetch their own profile; instructor accounts can be created from environment variables.

## In Scope

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- `TokenService` that issues JWTs with the encoder from spec 01.
- `InstructorSeeder` start-up runner.

## Out of Scope

- Path-by-role rules (spec 06).
- Password reset, email verification, refresh tokens, rate limiting.
- Logout endpoint (logout is client-side; tokens expire after 8 h).

## Requirements

- **R1** `POST /api/auth/register` body `{ "name": string, "email": string, "password": string }`.
  - `name`: trimmed, 1–100 chars. `email`: valid format, ≤ 254 chars, stored trimmed and lower-case. `password`: 8–72 chars (BCrypt limit).
  - Creates a user with role `STUDENT`, `consent_accepted_at = null`, password hashed with BCrypt (`PasswordEncoder` bean).
  - `201` → `{ "id", "name", "email", "role": "STUDENT" }`.
  - Email already used → `409` `ProblemDetail`, detail "An account with this email already exists."
  - Invalid fields → `400` with `errors` map.
- **R2** `POST /api/auth/login` body `{ "email", "password" }`.
  - Email matched case-insensitively (lower-case before lookup).
  - Success `200` → `{ "token": string, "expiresAt": ISO-8601, "user": { "id", "name", "email", "role", "consentAccepted": boolean } }`.
  - Unknown email or wrong password → `401` with the same detail for both: "Email or password is incorrect."
- **R3** Token claims: `sub` = user id as a string, `role` = `STUDENT` | `INSTRUCTOR`, `email`, `iat`, `exp` (`iat` + `epistemictrace.jwt.ttl`). Header `alg` = `HS256`.
- **R4** `GET /api/auth/me` (any valid token) → `200` with the same `user` object as R2, read fresh from the database. A token whose user no longer exists → `401`.
- **R5** `InstructorSeeder` (`ApplicationRunner`) reads `epistemictrace.seed.instructor.email`, `.password`, `.name` (bound from `INSTRUCTOR_SEED_EMAIL`, `INSTRUCTOR_SEED_PASSWORD`, `INSTRUCTOR_SEED_NAME`). If email and password are set and no user has that email, it creates an `INSTRUCTOR`. If unset, it does nothing. It never changes an existing user. It logs the email only, never the password.
- **R6** Add the three `INSTRUCTOR_SEED_*` keys to `.env.example` with empty values.
- **R7** Controllers only validate and delegate; `AuthService` holds the rules.

## Parts

1. Register endpoint with service and tests.
2. Login + `TokenService` + `/api/auth/me` with tests.
3. `InstructorSeeder` + `.env.example` keys with tests.

## Acceptance Criteria

- [ ] Registering creates a `STUDENT` with a BCrypt hash (never the plain password) and returns `201`.
- [ ] Registering the same email again, in any letter case, returns `409`.
- [ ] Login with correct credentials returns a token that `/api/auth/me` accepts.
- [ ] Wrong password and unknown email both return `401` with the same message.
- [ ] A register request cannot create an instructor, even if the body contains `"role": "INSTRUCTOR"` (the field is ignored).
- [ ] With seed variables set, one instructor exists after start-up; restarting does not create a second one.

## Tests

- `AuthControllerTests` (MockMvc): register success, duplicate email (mixed case), invalid email, short password, extra `role` field ignored; login success, wrong password, unknown email; `/me` with and without token.
- `TokenServiceTests`: decoded claims match the user; `exp - iat` equals the configured TTL.
- `InstructorSeederTests`: creates once; no-op when unset; does not modify an existing user.

## Docs to Update

- `architecture-context.md` → API Surface (remove "Proposed" for these rows once Q5 is accepted).
- `PROJECT.md` §8: new `.env.example` keys.
- `progress-tracker.md`: Completed entry.
