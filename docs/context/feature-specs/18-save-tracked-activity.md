# 18 — Save Tracked Activity on the Server

- **Card:** IMP-18 (https://trello.com/c/hBw72Ffk) · **Feature:** TEL-02 / M5
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** 16
- **Gates:** Q4 (event format), Q5 (path and payload)

## Goal

The server accepts batches of telemetry events for a student's own session, stores them once each, and rejects anything for someone else's session.

## In Scope

- `POST /api/sessions/{id}/events`.
- Request validation and idempotent storage.

## Out of Scope

- SDI scoring (spec 21) and breaker state (spec 22). This spec returns only counts; those specs extend the response.
- Reading events back (history and analytics specs).

## Requirements

- **R1** Request body:
  ```json
  { "events": [
    { "clientEventId": "uuid", "type": "EDIT", "occurredAt": "2026-11-03T02:15:04.120Z", "charsAdded": 3, "charsRemoved": 0 },
    { "clientEventId": "uuid", "type": "ERROR", "occurredAt": "…", "errorSignature": "NameError@3" },
    { "clientEventId": "uuid", "type": "RUN", "occurredAt": "…", "passedCount": 1, "totalCount": 4 }
  ] }
  ```
- **R2** Validation (any failure rejects the whole batch with `400` and nothing is stored):
  - `events`: 1–200 items.
  - `clientEventId`: UUID; `type`: `EDIT` | `RUN` | `ERROR`; `occurredAt`: ISO-8601 instant, not later than server now + 5 minutes and not earlier than the session's `started_at` − 5 minutes.
  - `EDIT`: `charsAdded` and `charsRemoved` integers ≥ 0, at least one > 0; RUN/ERROR fields absent.
  - `RUN`: `totalCount` ≥ 1, `0 ≤ passedCount ≤ totalCount`; other type fields absent.
  - `ERROR`: `errorSignature` 1–200 characters; other type fields absent.
  - `sdiValue` is never accepted from the client; if present → `400`.
- **R3** Ownership via `requireOwnedSession` (spec 16): missing `404`, other student `403` (TEL-02 AC 3). Instructors `403` by role rules.
- **R4** Events for a session whose `ended_at` is set are still accepted (the final flush can arrive after the end call).
- **R5** Idempotency: an event whose `(session_id, client_event_id)` already exists is skipped, not an error. Insert the batch in one transaction.
- **R6** Response `200 { "accepted": n, "duplicates": m }`.
- **R7** The service method that stores a batch returns the stored RUN events in `occurredAt` order, so spec 21 can score them without a second query.

## Parts

1. Request DTOs and validation with tests.
2. Service with idempotent insert, controller, MockMvc tests.

## Acceptance Criteria

- [ ] Events are batched and stored (TEL-02 AC 1).
- [ ] A student can only write their own events (TEL-02 AC 3): another student's session → `403`, nothing stored.
- [ ] Sending the same batch twice stores each event once and reports `duplicates`.
- [ ] One invalid event rejects the whole batch.
- [ ] A batch with `sdiValue` is rejected.

## Tests

- `TelemetryBatchValidationTests`: each R2 rule.
- `TelemetryControllerTests`: success; duplicates; `403`; `404`; instructor `403`; ended session accepted.

## Docs to Update

- `architecture-context.md` → Telemetry: remove "Proposed" once Q4 is accepted.
- `progress-tracker.md`: Completed entry.
