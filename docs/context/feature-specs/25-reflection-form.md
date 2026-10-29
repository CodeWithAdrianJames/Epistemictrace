# 25 — Reflection Form

- **Card:** IMP-25 (https://trello.com/c/ObXqDkDb) · **Feature:** MCB-02 / M7
- **Owner:** Jacob · **Reviewer:** Adrian
- **Depends on:** 23, 24
- **Gates:** Q8

## Goal

When the runner locks, the student fills in a hypothesis and a planned fix inside the locked panel; submitting unlocks the runner.

## In Scope

- `features/breaker/ReflectionForm.tsx` inside `LockedPanel`.
- `sessionsApi.submitReflection(sessionId, body)`.
- Updating `useBreakerState` from the reflection response.

## Out of Scope

- Showing past reflections (spec 27).
- AI or instructor prompts in the form (IMP-36, IMP-38).

## Requirements

- **R1** Two `<textarea>` fields with the labels from `ui-context.md` (**What do you think is wrong?**, **What will you try next?**), each with a live counter "N / min characters" until the minimum is reached. The minimum comes from `breaker.reflectionMinLength` (never hard-coded).
- **R2** **Continue** is enabled only when both trimmed values reach the minimum. While submitting, it shows "Saving…" and is disabled.
- **R3** On `201`: update `useBreakerState` with the response's `breaker` (→ `COOLDOWN`), close the panel, re-enable **Run tests**, and move focus back to **Run tests**.
- **R4** On `400`: show field errors under the fields. On `409`: refresh the breaker state from the next batch response and close the panel if it is no longer locked. On other errors: show `ApiError.detail` and keep the text.
- **R5** Typed text is kept if the request fails, and is not stored anywhere else (no drafts in `localStorage`).
- **R6** The editor stays usable while the form is open (invariant 6); the form is part of the page, not a modal.
- **R7** Wording follows `ui-context.md` → Student-Facing Wording.

## Parts

1. API call and form component with tests.
2. Integration with `LockedPanel` and `useBreakerState`; manual end-to-end check.

## Acceptance Criteria

- [ ] Two required fields with a minimum length (MCB-02 AC 1).
- [ ] Submitting the form unlocks the runner (MCB-02 AC 2).
- [ ] The saved reflection has a timestamp and the linked SDI value, checked in the database (MCB-02 AC 3).
- [ ] The student can edit code while writing the reflection.
- [ ] A failed submit keeps the typed text.

## Tests

- `ReflectionForm.test.tsx` (mocked API): button disabled until both minimums; counters; success callback; `400` field errors; error keeps text.
- Manual: lock → reflect → cooldown → run works; screenshots on the MCB-02 card.

## Docs to Update

- `progress-tracker.md`: Completed entry.
