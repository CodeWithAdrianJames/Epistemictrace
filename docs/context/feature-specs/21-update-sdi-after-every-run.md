# 21 — Update the SDI After Every Run

- **Card:** IMP-21 (https://trello.com/c/xcjySVSL) · **Feature:** TEL-03 / M6
- **Owner:** Adrian · **Reviewer:** Noel
- **Depends on:** 18, 20
- **Gates:** Q1, Q2 (server computes and is authoritative)

## Goal

When a batch with RUN events is stored, the server scores each RUN, saves `sdi_value` on it, updates the session's `peak_sdi`, and tells the student only their struggle level.

## In Scope

- `sdi/SdiScoringService` (Spring service that loads events, calls `SdiEngine`, saves results).
- Extending the events response from spec 18.

## Out of Scope

- Breaker state (spec 22 adds it to the same response).
- Showing the level in the UI (spec 28).
- Recomputing scores when configuration changes (scores are stored as computed).

## Requirements

- **R1** After spec 18 stores a batch (same transaction), for each newly stored RUN event in `occurredAt` order (spec 19 ordering):
  - load the session's events that are not ordered after this RUN (including events stored earlier in the same batch);
  - compute `sdi = SdiEngine.compute(events, run, window, tuning, weights)` with `window` from the activity's `sdi_configs.window_minutes` and tuning/weights from `SdiProperties`;
  - save `sdi_value` on the RUN event;
  - set `coding_sessions.peak_sdi = max(peak_sdi, sdi)`.
- **R2** Duplicate RUN events (skipped by idempotency) are not re-scored.
- **R3** RUN events that arrive out of order (older `occurredAt` than an already-scored RUN) are scored with the events that precede them; already-scored RUNs are not recomputed.
- **R4** Response from `POST /api/sessions/{id}/events` becomes `{ "accepted", "duplicates", "struggleLevel": "LOW" | "MEDIUM" | "HIGH" | null }`. `struggleLevel` is computed with `StruggleLevels.of` from the **latest** scored RUN in the batch, using `levels.medium-from` and the activity threshold; `null` if the batch had no new RUN.
- **R5** The response never contains `sdi_value`, `peak_sdi` or any number derived from them (invariant 5).
- **R6** Loading events for scoring uses one query per batch for the session's events up to the latest RUN in the batch (not one query per RUN).

## Parts

1. `SdiScoringService` with service tests (H2, fixed instants).
2. Integration into ingestion and the response field, with MockMvc tests.

## Acceptance Criteria

- [ ] SDI recalculates after each run (TEL-03 AC 3): every stored RUN has a non-null `sdi_value` between 0 and 100.
- [ ] `peak_sdi` equals the maximum `sdi_value` of the session's RUN events.
- [ ] Posting the wheel-spinning scenario from spec 20 as batches ends with `struggleLevel: "HIGH"`; the steady scenario ends with `"LOW"`.
- [ ] No response body contains a raw score.
- [ ] Re-sending the same batch does not change any stored `sdi_value`.

## Tests

- `SdiScoringServiceTests`: scores per RUN, peak update, out-of-order RUN, duplicates ignored.
- `TelemetryScoringControllerTests`: scenario batches → expected levels; JSON has no `sdi`/`peak` fields.

## Docs to Update

- `architecture-context.md` → SDI "Where/When/Recording": remove "Proposed" once Q2 is accepted.
- `PROJECT.md` §11: delete Q2 row; record the answer in §5.
- `progress-tracker.md`: Completed entry.
