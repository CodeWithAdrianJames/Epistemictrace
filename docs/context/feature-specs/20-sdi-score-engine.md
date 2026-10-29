# 20 — SDI Score Engine

- **Card:** IMP-20 (https://trello.com/c/WiKHZSr2) · **Feature:** TEL-03 / M6
- **Owner:** Adrian · **Reviewer:** Jacob
- **Depends on:** 19
- **Gates:** Q1 (weights, caps, level boundary)

## Goal

The signals are combined into a 0–100 score with configurable weights, and deterministic tests prove that wheel-spinning scores above 70 and steady progress below 70.

## In Scope

- `sdi/SdiEngine`, `sdi/SdiWeights`, `sdi/StruggleLevel`, `sdi/StruggleLevels`.
- `config/SdiProperties` bound to `epistemictrace.sdi` with validation, and default values in the main configuration file.
- Seeded scenario fixtures.

## Out of Scope

- Running the engine on ingestion and saving scores (spec 21).
- Per-activity threshold/cooldown/window (already in `sdi_configs`, spec 08).
- Tuning beyond the Q1 proposal (CLR-01 owns tuning; this spec makes it easy to change).

## Requirements

- **R1** `SdiWeights(double runFrequency, double editToRun, double repeatedErrors, double noProgress)`; each in `[0, 1]`; sum within `1 ± 0.001`; otherwise construction fails.
- **R2** `SdiEngine.score(Signals signals, SdiWeights weights) → int` = `round(100 × Σ wᵢ·nᵢ)` using `Math.round`, then clamped to `[0, 100]`. Pure; no Spring.
- **R3** `SdiEngine.compute(List<SdiEvent> sessionEvents, SdiEvent run, Duration window, SignalTuning tuning, SdiWeights weights) → int` = `score(SignalCalculator.calculate(...), weights)`.
- **R4** `StruggleLevel { LOW, MEDIUM, HIGH }`; `StruggleLevels.of(int sdi, int mediumFrom, int threshold)`: `HIGH` if `sdi ≥ threshold`; else `MEDIUM` if `sdi ≥ mediumFrom`; else `LOW`.
- **R5** `SdiProperties` (`@ConfigurationProperties("epistemictrace.sdi")`, validated) with:
  - `weights.run-frequency`, `weights.edit-to-run`, `weights.repeated-errors`, `weights.no-progress`;
  - `caps.run-count`, `caps.gap` (Duration), `caps.repeats`;
  - `levels.medium-from`;
  - and the existing `defaults.threshold`, `defaults.cooldown-seconds`, `defaults.window-minutes` (spec 08) moved into this record if they were separate.
  It exposes `toWeights()` and `toTuning()`.
- **R6** Main configuration contains the Q1 proposed values (`0.20`, `0.20`, `0.25`, `0.35`; `10`, `60s`, `5`; `40`). No numeric weight, cap or level value appears in Java code outside tests (invariant 7).
- **R7** Test fixtures in `src/test/java/.../sdi/SdiScenarios.java` build event lists with fixed instants:
  - **Wheel-spinning:** 10 runs in 5 minutes, each 10 s after an edit, the same error signature on 8 runs, `passedCount` never above 1.
  - **Steady progress:** 4 runs in 5 minutes, each 60–90 s after an edit, no repeated errors, `passedCount` 1, 2, 3, 4.
  - **Edge cases:** a single first run; 30 runs with no edits; alternating passes.

## Parts

1. `SdiWeights`, `SdiEngine.score`, `StruggleLevels` with tests.
2. `SdiProperties` binding, validation and default values with tests.
3. Scenario fixtures and the threshold tests.

## Acceptance Criteria

- [ ] SDI is always between 0 and 100 (TEL-03 AC 1), including for 1 000 generated sequences from a fixed random seed.
- [ ] The wheel-spinning scenario scores above 70 and the steady-progress scenario below 70 with the configured defaults (TEL-03 AC 2).
- [ ] Changing a weight in test configuration changes the score without code changes.
- [ ] Invalid weights (sum 1.2) or a zero cap stop the application from starting.

## Tests

- `SdiEngineTests`: all-zero signals → 0; all-one signals → 100; rounding of `x.5`; clamping.
- `SdiScenarioTests`: R7 scenarios against the threshold 70; print each scenario's signals in the assertion message for CLR-01 evidence.
- `SdiBoundsTests`: 1 000 random sequences (`new Random(42)`) all in `[0, 100]`.
- `SdiPropertiesTests`: binding and validation failures.

## Docs to Update

- `architecture-context.md` → SDI: final values once Q1 is accepted.
- `PROJECT.md` §5 and §11: move the Q1 answer into §5; delete the §11 row.
- `progress-tracker.md`: Completed entry; attach scenario output to CLR-01.
