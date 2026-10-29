# 23 — Lock the Run Button

- **Card:** IMP-23 (https://trello.com/c/tRtI29jK) · **Feature:** MCB-01 / M7
- **Owner:** Adrian · **Reviewer:** Jacob
- **Depends on:** 14, 17, 22
- **Gates:** Q2 (browser follows server state, fail-open), Q15 (lock survives refresh through session resume)

## Goal

**Run tests** is disabled while the server says the runner is locked, the editor keeps working, and the lock is still there after a refresh.

## In Scope

- `features/breaker/useBreakerState.ts`.
- `features/breaker/LockedPanel.tsx` (heading and explanation only; the form is spec 25).
- Changes to `RunButton` and `WorkspacePage` wiring.

## Out of Scope

- The reflection form and unlock (spec 25).
- Struggle level badge (spec 28).

## Requirements

- **R1** `useBreakerState({ startResponse, onBatchResponse })` keeps `{ state: 'UNLOCKED' | 'LOCKED' | 'COOLDOWN', cooldownEndsAt: string | null, reflectionMinLength: number }`:
  - initial value from the session start response's `breaker`;
  - updated from every batch response's `breaker`;
  - responses without a valid `breaker` object are ignored (validate at the boundary);
  - when the state is `COOLDOWN`, a timer switches it to `UNLOCKED` at `cooldownEndsAt` (client display only; the server remains authoritative).
  - With tracking off (consent declined or session start failed) the state is always `UNLOCKED`.
- **R2** Run gating in `WorkspacePage`: after a run completes, keep **Run tests** disabled until `recordRun` (spec 17) resolves or 5 000 ms pass, whichever comes first. If it times out or resolves `null`, re-enable the button and show the notice "We couldn't reach the server. Your tests still run, but pauses may not work right now." (fail-open, Q2).
- **R3** **Run tests** is disabled whenever the state is `LOCKED`, with the label and reason from `ui-context.md` → Run Tests Button.
- **R4** When the state becomes `LOCKED`, show `LockedPanel` above the results panel with the heading and body text from `ui-context.md` → Locked panel copy, and move focus to the panel heading. The editor and problem panel stay editable and scrollable (invariant 6).
- **R5** During `COOLDOWN`, show the top-bar notice from `ui-context.md`; **Run tests** is enabled.
- **R6** Refresh: the page starts the session again (spec 17); the server resumes the same session (spec 16) and returns `LOCKED` (spec 22), so the panel and disabled button reappear without extra code.
- **R7** No SDI number, percentage or the word "SDI" is shown (invariant 5).

## Parts

1. `useBreakerState` with tests.
2. Run gating (R2) and lock display (R3–R5) with tests; manual end-to-end check.

## Acceptance Criteria

- [ ] The test runner is disabled when the SDI reaches the threshold (MCB-01 AC 1, end to end).
- [ ] The editor stays usable while the runner is locked (MCB-01 AC 2).
- [ ] After a refresh, the runner is still locked.
- [ ] During cooldown the runner works and does not lock again (MCB-01 AC 3, end to end).
- [ ] With the backend stopped, a run re-enables the button within 5 seconds and shows the notice.

## Tests

- `useBreakerState.test.ts` (fake timers): initial state; updates; invalid payload ignored; cooldown expiry; tracking-off default.
- `RunButton.test.tsx`: label and disabled state for each row of the `ui-context.md` table.
- Manual: trigger the lock by running quickly without changes (wheel-spinning), refresh, confirm lock; screenshots on the MCB-01 card.

## Docs to Update

- `progress-tracker.md`: Completed entry.
