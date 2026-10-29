# 07 — Login, Register and Logout Pages

- **Card:** IMP-07 (https://trello.com/c/hIbpOXYf) · **Feature:** PLT-01 / M1
- **Owner:** Jacob · **Reviewer:** Noel
- **Depends on:** 04, 05
- **Gates:** Q11 (router, auth context), Q13 (token in `sessionStorage`)

## Goal

Users can register (students), log in, log out, and are redirected away from pages their role cannot use.

## In Scope

- `auth/AuthProvider` context, `auth/tokenStore.ts`, `api/authApi.ts`.
- Login and register pages replacing the placeholders.
- `RequireRole` route guard and `/` role redirect.
- Top-bar links per role, user name and **Log out**.

## Out of Scope

- Consent notice (spec 15).
- Password reset, "remember me", instructor registration.

## Requirements

- **R1** `tokenStore`: `getToken()`, `setToken(token, expiresAt)`, `clearToken()` using `sessionStorage` key `epistemictrace:token`. `getToken()` returns `null` when the stored `expiresAt` has passed.
- **R2** `authApi`: `register(name, email, password)`, `login(email, password)`, `me(token)` calling the endpoints from spec 05 through `apiFetch`.
- **R3** `AuthProvider` state: `{ status: 'loading' | 'anonymous' | 'authenticated', user: User | null, token: string | null }` with actions `login`, `register`, `logout`. On mount, if a token exists, it calls `me()`; `401` → clear token, status `anonymous`. `User` = `{ id, name, email, role: 'STUDENT' | 'INSTRUCTOR', consentAccepted: boolean }`.
- **R4** `apiFetch` callers get the token from the provider; any `401` from a protected call triggers `logout()` and a redirect to `/login`.
- **R5** Login page (`/login`): email and password fields, **Log in** button, link to register. On success: redirect to `/student/activities` or `/instructor/activities` by role. On `401`: show "Email or password is incorrect." under the form. While submitting, the button is disabled.
- **R6** Register page (`/register`): name, email, password, confirm password; client checks mirror spec 05 (name 1–100, valid email, password 8–72, passwords match). On `201`, log in automatically with the same credentials and redirect to `/student/activities`. On `409`, show the server message under the email field. Field errors from the server map to their fields.
- **R7** `RequireRole({ role })`: while `loading`, render "Loading…"; if `anonymous`, redirect to `/login`; if the role differs, redirect to that user's home. Wrap all `/student/*` routes with `role="STUDENT"` and `/instructor/*` with `role="INSTRUCTOR"`.
- **R8** `/` redirects to the user's home when authenticated, otherwise to `/login`. Authenticated users visiting `/login` or `/register` are redirected to their home.
- **R9** Top bar: student links Activities, History; instructor link My activities; the user's name; **Log out** (clears the token and redirects to `/login`).

## Parts

1. `tokenStore`, `authApi`, `AuthProvider` with unit tests.
2. Login and register pages.
3. `RequireRole`, redirects, top bar links and logout.

## Acceptance Criteria

- [ ] A new student can register and lands on Activities, logged in.
- [ ] Invalid login shows an error message and stays on `/login`.
- [ ] A student typing `/instructor/activities` in the address bar is redirected to `/student/activities`.
- [ ] An instructor typing `/student/history` is redirected to `/instructor/activities`.
- [ ] A refresh keeps the user logged in (same tab); closing the tab logs them out.
- [ ] **Log out** returns to `/login`, and the Back button does not show a protected page.

## Tests

- `tokenStore.test.ts`: expired token returns `null`.
- `AuthProvider.test.tsx` (mocked `authApi`): restores the user from a stored token; clears on `401`.
- `RequireRole.test.tsx`: anonymous → `/login`; wrong role → own home; right role → children.
- `LoginPage.test.tsx`: error message on `401`; redirect by role on success.

## Docs to Update

- `progress-tracker.md`: Completed entry.
