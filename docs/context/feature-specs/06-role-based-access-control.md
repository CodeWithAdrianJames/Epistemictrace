# 06 — Role-Based Access Control

- **Card:** IMP-06 (https://trello.com/c/dwYXSC74) · **Feature:** PLT-01 / M1
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** 05
- **Gates:** Q5 (path prefixes per role)

## Goal

The backend rejects requests from the wrong role before they reach any controller, and services have one helper to get the current user's id and role.

## In Scope

- Mapping the `role` claim to Spring authorities.
- Path rules per role in the `SecurityFilterChain`.
- `CurrentUser` helper.
- JSON `403` responses.

## Out of Scope

- Ownership checks on individual records (each feature spec adds them in its service).
- Any new endpoint.

## Requirements

- **R1** A `JwtAuthenticationConverter` maps the `role` claim to exactly one authority, `ROLE_STUDENT` or `ROLE_INSTRUCTOR`. A token without a valid `role` claim is rejected with `401`.
- **R2** Rules, in this order, added to the chain from spec 01:
  - `/api/health`, `POST /api/auth/register`, `POST /api/auth/login`, `OPTIONS /**` → permit all.
  - `/api/auth/me` → authenticated.
  - `/api/instructor/**` → `hasRole('INSTRUCTOR')`.
  - `/api/activities/**`, `/api/sessions/**`, `/api/me/**` → `hasRole('STUDENT')`.
  - any other `/api/**` → `denyAll()`.
- **R3** Access denied returns `403` with a `ProblemDetail` body, detail "You don't have access to this." Unauthenticated stays `401`.
- **R4** `config/CurrentUser` (a Spring bean or static helper) exposes `long id()` and `Role role()` read from the authenticated JWT. Services receive the user id as a method argument from controllers; they do not read the security context themselves.

## Parts

1. R1, R3, R4 with tests.
2. R2 rules with tests.

## Acceptance Criteria

- [ ] A student token on `/api/instructor/activities` gets `403` (even though no controller exists yet).
- [ ] An instructor token on `/api/activities` and `/api/sessions/1/events` gets `403`.
- [ ] A student token on `/api/activities` gets past security (`404` until spec 08 adds the controller).
- [ ] Both roles can call `/api/auth/me`.
- [ ] An unlisted path such as `/api/admin` returns `403` for both roles and `401` without a token.

## Tests

- `RoleAccessTests` (MockMvc with tokens from the test encoder): one test per rule and role combination in R2, asserting `401`, `403` or "not 401/403".
- `JwtRoleConverterTests`: valid roles map correctly; missing or unknown role is rejected.

## Docs to Update

- `architecture-context.md` → Auth and Ownership Model (confirm rules).
- `progress-tracker.md`: Completed entry.
