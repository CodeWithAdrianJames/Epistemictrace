# 19 — SDI Signal Calculations

- **Card:** IMP-19 (https://trello.com/c/OpV50Pnv) · **Feature:** TEL-03 / M6
- **Owner:** Adrian · **Reviewer:** Noel
- **Depends on:** 02 (event fields)
- **Gates:** Q1 (signal definitions and caps), Q2 (computed on the server, in Java)

## Goal

Pure Java code that, for one RUN event, computes the four struggle signals over the rolling window and normalizes each to `[0, 1]`, fully covered by unit tests.

## In Scope

- Package `com.episteme.epistemictrace.sdi`: `SdiEvent`, `SignalTuning`, `SignalCalculator`, `Signals`.

## Out of Scope

- Weights, the final score and clamping (spec 20).
- Loading events from the database or saving results (spec 21).
- Spring wiring and configuration binding (spec 20).

## Requirements

- **R1** No Spring, JPA, `Clock` or static time access in this package. Inputs and outputs are records.
- **R2** `SdiEvent(long id, EventType type, Instant occurredAt, Integer passedCount, String errorSignature)`.
- **R3** `SignalTuning(int runCap, Duration gapCap, int repeatCap)`; constructor rejects values ≤ 0. Values come from configuration (spec 20); tests construct them directly.
- **R4** `SignalCalculator.calculate(List<SdiEvent> sessionEvents, SdiEvent run, Duration window, SignalTuning tuning) → Signals`.
  - `sessionEvents` = all events of the session; the method ignores events ordered after `run`.
  - **Ordering:** by `occurredAt`, then type `EDIT` < `ERROR` < `RUN`, then `id`. "Before" and "after" always use this order.
  - **Window:** events with `run.occurredAt − window ≤ occurredAt ≤ run.occurredAt` that are not ordered after `run`.
  - Throws `IllegalArgumentException` if `run` is not a RUN event or not in `sessionEvents`.
- **R5** Signals, using `R` = RUN events in the window (always contains `run`):
  1. **Run frequency:** `runs = |R|`; `n1 = min(runs / runCap, 1)`.
  2. **Edit-to-run time:** for each RUN `r` in `R`: `prev` = the RUN just before `r` in the session (may be outside the window); `lastEdit` = the latest EDIT before `r` and after `prev` (or after session start if no `prev`). `gap = r − lastEdit` if `lastEdit` exists; else `r − prev` if `prev` exists; else `gapCap`. `medianGap` = median of the gaps (mean of the two middle values for an even count). `n2 = 1 − min(medianGap / gapCap, 1)`.
  3. **Repeated errors:** `E` = ERROR events in the window; `repeats = |E| − |distinct errorSignature in E|`; `n3 = min(repeats / repeatCap, 1)`.
  4. **No-progress runs:** a RUN is no-progress if its `passedCount` ≤ the highest `passedCount` of any RUN before it in the session; the session's first RUN is never no-progress. `n4 = noProgress(R) / |R|`.
- **R6** `Signals` record holds the raw values (`runs`, `medianGap`, `repeats`, `noProgressRuns`) and the four normalized values (`double`, each in `[0, 1]`).
- **R7** Calculations use exact arithmetic on `Duration` (milliseconds) and `double` for ratios; no rounding in this spec.

## Parts

1. Records, ordering and window selection with tests.
2. The four signals with tests (one test class section per signal).

## Acceptance Criteria

- [ ] Each normalized signal is always within `[0, 1]`, including empty windows except `run` itself.
- [ ] Events after `run` never affect the result.
- [ ] Events exactly at the window start are included; one millisecond earlier are excluded.
- [ ] The four signals rise in the "Raises SDI when…" cases of `PROJECT.md` §5 and stay at 0 for a single first run with no edits.

## Tests

`SignalCalculatorTests` with fixed `Instant`s:

- Ordering: EDIT, ERROR and RUN at the same instant are ordered EDIT < ERROR < RUN.
- Window boundaries (inclusive start, exclusive later events).
- Run frequency: 3 runs, cap 10 → 0.3; 12 runs → 1.0.
- Gap: edit 10 s before run → gap 10 s; re-run with no edit 20 s after previous run → 20 s; first run with no edit → `gapCap` → `n2 = 0`; even-count median.
- Repeats: signatures `[A, A, A, B]` → repeats 2.
- No-progress: passed `[0, 1, 1, 2, 0]` → no-progress runs are the 3rd and 5th.

## Docs to Update

- `architecture-context.md` → SDI: confirm definitions; remove "Proposed" once Q1/Q2 are accepted.
- `progress-tracker.md`: Completed entry.
