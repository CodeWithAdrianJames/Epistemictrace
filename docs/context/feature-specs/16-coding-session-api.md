# 16 — Coding Session API

- **Card:** IMP-16 (https://trello.com/c/AfkSCI03) · **Feature:** TEL-02 / M5
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** 08, 15 Part A
- **Gates:** Q5 (paths), Q15 (resume window)

## Goal

A student with consent can start (or resume) a coding session on a published activity and end it.

## In Scope

- `POST /api/sessions`, `POST /api/sessions/{id}/end`.
- `SessionProperties` bound to `epistemictrace.session.resume-window` (default `PT30M`).
- `SessionService.requireOwnedSession(sessionId, studentId)` for later specs.

## Out of Scope

- Events (spec 18), SDI (spec 21), breaker state in responses (spec 22 adds it).
- Instructor access to sessions.

## Requirements

- **R1** `POST /api/sessions` body `{ "activityId": number }` (role `STUDENT`):
  - Activity missing or not `PUBLISHED` → `404`.
  - `users.consent_accepted_at` is `null` → `403` with detail "Consent is required before tracking starts." (invariant 2).
  - Find the student's latest session for this activity (by `started_at`). If it exists and (`ended_at` is `null` or `ended_at` ≥ now − resume window), **resume** it: set `ended_at = null`; respond `200`.
  - Otherwise create a new session with `started_at = now`; respond `201`.
  - Body: `{ "sessionId", "activityId", "startedAt", "resumed": boolean }`.
- **R2** `POST /api/sessions/{id}/end` (role `STUDENT`): owner only (`404` missing, `403` not owner). Sets `ended_at = now` (overwrites an earlier end). `204`.
- **R3** `requireOwnedSession(sessionId, studentId)` returns the session or throws the `404`/`403` exceptions above; specs 18, 22, 24 and 26 reuse it.
- **R4** Server time (`Instant.now()` from an injectable `Clock` bean) is used for `started_at` and `ended_at`, so tests can fix the time.

## Parts

1. `Clock` bean, `SessionProperties`, `SessionService` with unit tests.
2. Controller and MockMvc tests.

## Acceptance Criteria

- [ ] Session start is recorded (TEL-02 AC 2) and session end is recorded (TEL-02 AC 2).
- [ ] A student without consent gets `403` and no session row is created.
- [ ] Starting again within 30 minutes of the end resumes the same session; after 31 minutes a new one is created.
- [ ] A student cannot end another student's session (`403`).
- [ ] A draft or archived activity cannot get a session (`404`).

## Tests

- `SessionServiceTests` (fixed `Clock`): new, resume-open, resume-recent-end, new-after-window, consent missing.
- `SessionControllerTests`: `201` vs `200`; `403` consent; `404` activity; end `204`/`403`/`404`; instructor `403`.

## Docs to Update

- `architecture-context.md` → Circuit Breaker (session resume): remove "Proposed" once Q15 is accepted.
- `progress-tracker.md`: Completed entry.
