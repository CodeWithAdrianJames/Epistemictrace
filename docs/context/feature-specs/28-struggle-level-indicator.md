# 28 — Struggle Level Indicator (Should Have)

- **Card:** IMP-28 (https://trello.com/c/Gclr4J07) · **Feature:** STU-02
- **Owner:** Jacob · **Reviewer:** Adrian
- **Depends on:** 14, 17, 21
- **Gates:** Q1 (level boundaries)

## Goal

After each run, the student sees a gentle low/medium/high badge in the workspace top bar, never a number.

## In Scope

- `features/workspace/StruggleBadge.tsx` and `useStruggleLevel.ts`.

## Out of Scope

- Levels in history (spec 27) or instructor views.
- Changing level boundaries from the UI.

## Requirements

- **R1** `useStruggleLevel(onBatchResponse)` keeps the latest non-null `struggleLevel` from batch responses (spec 21 R4). Values other than `LOW`, `MEDIUM`, `HIGH` are ignored.
- **R2** Before the first scored run of the visit, and whenever tracking is off, the badge is not shown.
- **R3** Badge text and colors exactly as `ui-context.md` → Struggle Level Badge. It has `aria-live="polite"` so screen readers announce changes.
- **R4** The badge never shows a number, a percentage, a progress bar or the word "SDI" (invariant 5); the client never computes a level itself.

## Parts

1. Hook and badge with tests; place the badge in the top bar.

## Acceptance Criteria

- [ ] The indicator updates after each run (STU-02 AC 1).
- [ ] It shows levels (low, medium, high) instead of a raw score or punishing wording (STU-02 AC 2).
- [ ] No badge is visible when consent was declined.

## Tests

- `useStruggleLevel.test.ts`: updates; ignores `null` and unknown values.
- `StruggleBadge.test.tsx`: text per level; no digits in the rendered output.

## Docs to Update

- `progress-tracker.md`: Completed entry.
