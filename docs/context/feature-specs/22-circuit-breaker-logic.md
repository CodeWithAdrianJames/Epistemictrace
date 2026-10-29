# 22 — Circuit Breaker Logic

- **Card:** IMP-22 (https://trello.com/c/1mKNcQcN) · **Feature:** MCB-01 / M7
- **Owner:** Adrian · **Reviewer:** Jacob
- **Depends on:** Part A: 20 · Part B: 21
- **Gates:** Q1 (cooldown default), Q2 (server owns the state), Q8 (reflection minimum length, Part B)

## Goal

The server decides when the runner locks, when cooldown applies and when it unlocks, using tested transition rules, stores the state on the session, and returns it whenever the student starts a session or sends events.

## In Scope

- **Part A:** `breaker/BreakerState`, `breaker/BreakerView`, `breaker/BreakerRules` (plain Java).
- **Part B:** `breaker/BreakerService` persistence and wiring into session start (spec 16) and event ingestion (spec 21).

## Out of Scope

- The unlock action (reflection endpoint, spec 24) — Part A defines its rule; spec 24 calls it.
- UI (spec 23).
- Alerts on repeated triggers (IMP-34).

## Requirements

### Part A — Rules (plain Java)

- **R1** `BreakerState(boolean locked, Integer sdiAtLock, Instant cooldownEndsAt)` mirrors the session columns.
- **R2** `BreakerRules.onRunScored(BreakerState s, int sdi, int threshold, Instant now) → BreakerState`:
  - if `s.cooldownEndsAt != null && now.isBefore(s.cooldownEndsAt)` → return `s` unchanged;
  - else if `!s.locked && sdi >= threshold` → `locked = true`, `sdiAtLock = sdi`;
  - else → `s` unchanged.
- **R3** `BreakerRules.onReflection(BreakerState s, Duration cooldown, Instant now) → BreakerState`: requires `s.locked` (else `IllegalStateException`); returns `locked = false`, `sdiAtLock = null`, `cooldownEndsAt = now + cooldown`.
- **R4** `BreakerRules.view(BreakerState s, Instant now) → BreakerView`: `LOCKED` if `locked`; `COOLDOWN` with `cooldownEndsAt` if `cooldownEndsAt` is after `now`; else `UNLOCKED`.
- **R5** Threshold and cooldown come from the activity's `sdi_configs` row; nothing is hard-coded (invariant 7).

### Part B — Persistence and responses

- **R6** In ingestion (spec 21), after each RUN is scored, apply `onRunScored` with server `now` (from the `Clock` bean) and save the session's breaker columns. RUNs received while locked are scored (spec 21) but do not change the state (R2 already guarantees this).
- **R7** Breaker payload: `{ "state": "UNLOCKED" | "LOCKED" | "COOLDOWN", "cooldownEndsAt": ISO-8601 | null, "reflectionMinLength": number }`. Add `config/ReflectionProperties` bound to `epistemictrace.reflection` with `min-length` (Q8 proposal `20`) and `max-length` (`2000`), validated `1 ≤ min ≤ max`. `reflectionMinLength` comes from it; spec 24 reuses the same properties.
- **R8** `POST /api/sessions` (spec 16) response gains `"breaker": {…}`; a resumed locked session returns `LOCKED`.
- **R9** `POST /api/sessions/{id}/events` response gains `"breaker": {…}` (always present, even when the batch had no RUN).
- **R10** No breaker payload contains `sdiAtLock` (invariant 5).

## Parts

1. Part A with exhaustive unit tests.
2. Part B wiring and MockMvc tests.

## Acceptance Criteria

- [ ] The state becomes `LOCKED` when a scored RUN reaches the threshold (MCB-01 AC 1, server side).
- [ ] A cooldown prevents an immediate re-trigger (MCB-01 AC 3): a RUN with SDI 95 during cooldown leaves the state `COOLDOWN`.
- [ ] After the cooldown ends, the next RUN at or above the threshold locks again.
- [ ] Starting (resuming) a locked session returns `LOCKED`.
- [ ] No response contains the SDI value at lock.

## Tests

- `BreakerRulesTests` (fixed instants): each branch of R2–R4, including `now` exactly equal to `cooldownEndsAt` (→ not in cooldown), threshold equality (→ locks), already locked (→ unchanged).
- `BreakerIngestionTests`: wheel-spinning batches lock; steady batches stay unlocked; session start returns the stored state.

## Docs to Update

- `architecture-context.md` → Circuit Breaker: remove "Proposed" once Q1/Q2 are accepted.
- `progress-tracker.md`: Completed entry.
