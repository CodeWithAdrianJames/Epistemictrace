# 24 — Save Reflections API

- **Card:** IMP-24 (https://trello.com/c/rZ68fbYC) · **Feature:** MCB-02 / M7
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** 22
- **Gates:** Q8 (minimum and maximum length)

## Goal

A student whose runner is locked can submit a hypothesis and a planned fix; the server saves the reflection with the SDI at trigger and starts the cooldown.

## In Scope

- `POST /api/sessions/{id}/reflections`.
- `reflection/ReflectionService` using `BreakerRules.onReflection` (spec 22) and `ReflectionProperties`.

## Out of Scope

- Reading reflections (spec 26 for students; IMP-31 for instructors).
- Editing or deleting reflections.
- AI-generated prompts (IMP-38).

## Requirements

- **R1** Request `{ "hypothesis": string, "plannedFix": string }`. Each value is trimmed, then must be at least `min-length` and at most `max-length` characters (`ReflectionProperties`). Failures → `400` with `errors` (field names `hypothesis`, `plannedFix`), detail naming the minimum, e.g. "Write at least 20 characters."
- **R2** Ownership via `requireOwnedSession` (`404` / `403`).
- **R3** The session must be locked; otherwise `409` with detail "Tests aren't paused right now."
- **R4** In one transaction: insert `reflections(session_id, hypothesis, planned_fix, sdi_at_trigger = session.sdi_at_lock, submitted_at = now)`; apply `BreakerRules.onReflection` with the activity's `cooldown_seconds`; save the session.
- **R5** Response `201 { "reflectionId", "submittedAt", "breaker": { … spec 22 R7 … } }` with `state: "COOLDOWN"`.
- **R6** Concurrent double submit: the second request sees the session unlocked and gets `409`; only one reflection is stored (use the transaction and a row lock or optimistic version on the session).
- **R7** The response never includes `sdi_at_trigger`.

## Parts

1. Service with tests (H2, fixed `Clock`).
2. Controller with MockMvc tests.

## Acceptance Criteria

- [ ] Two required fields with a minimum length (MCB-02 AC 1, server side).
- [ ] A valid reflection unlocks the runner: the next session start or batch response shows `COOLDOWN` (MCB-02 AC 2, server side).
- [ ] The reflection is saved with a timestamp and the linked SDI value (MCB-02 AC 3).
- [ ] Submitting when not locked returns `409` and stores nothing.
- [ ] Whitespace-only text is rejected.

## Tests

- `ReflectionServiceTests`: success sets cooldown and copies `sdi_at_lock`; not locked `409`; trimming; boundaries at min and max length.
- `ReflectionControllerTests`: `201` body shape (no SDI); `400` field errors; `403`; `404`; instructor `403`.

## Docs to Update

- `PROJECT.md` §11: delete the reflection-length part of Q7 once Q8 is accepted.
- `progress-tracker.md`: Completed entry.
