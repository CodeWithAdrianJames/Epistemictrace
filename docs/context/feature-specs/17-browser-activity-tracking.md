# 17 — Activity Tracking in the Browser

- **Card:** IMP-17 (https://trello.com/c/JiwYhV62) · **Feature:** TEL-01 / M5
- **Owner:** Adrian · **Reviewer:** Noel
- **Depends on:** 11, 13, 15 Part B, 16, 18
- **Gates:** Q4 (event format, coalescing, send timing)

## Goal

On the activity page, after consent, the browser starts or resumes a session, records EDIT, RUN and ERROR events, and sends them in batches. Nothing is captured anywhere else.

## In Scope

- `features/telemetry/telemetryBuffer.ts` (plain module).
- `features/telemetry/editCoalescer.ts` (plain module).
- `features/telemetry/useTelemetrySession.ts` (React hook used only by `WorkspacePage`).
- `api/sessionsApi.ts`: `startSession`, `endSession`, `sendEvents`.

## Out of Scope

- Using the batch response to lock the runner (spec 23) or show a level (spec 28). This spec only passes the response on.
- Offline storage of unsent events (memory only).

## Requirements

- **R1** `sessionsApi`: `startSession(activityId)` → `POST /api/sessions`; `endSession(sessionId, { keepalive })` → `POST /api/sessions/{id}/end`; `sendEvents(sessionId, events, { keepalive })` → `POST /api/sessions/{id}/events`. Response types are open objects (`Record<string, unknown>` extended later by specs 21–22), validated where read.
- **R2** `editCoalescer(onEdit)`: `push(change: EditorChange)`; changes less than 2 000 ms apart are summed into one pending EDIT; the pending EDIT is emitted 2 000 ms after its last change, or immediately when `flush()` is called. Emitted `occurredAt` = time of the last change.
- **R3** `telemetryBuffer({ send, now, setTimer })` (all injectable):
  - `add(event)` assigns `clientEventId = crypto.randomUUID()` and appends it.
  - Every 10 000 ms, if non-empty, sends up to 200 events.
  - `flushNow()` sends everything immediately (in chunks of 200) and resolves with the last response, or `null` if sending failed.
  - On failure, the events stay at the front of the buffer with the same ids and are retried on the next send.
  - Only one request in flight at a time; a flush requested during a send runs right after it.
  - `close({ keepalive: true })` stops the timer and sends what remains with `keepalive`.
- **R4** `useTelemetrySession({ activityId, consentStatus })`:
  - Does nothing unless `consentStatus === 'accepted'` (invariant 2). Starts when it becomes `accepted`.
  - Calls `startSession`; on failure, tracking stays off for this visit and the page shows a small notice "Tracking is unavailable right now." (no retries).
  - Returns `{ sessionId | null, startResponse | null, recordEdit(change), recordRun(report): Promise<BatchResponse | null>, onBatchResponse(callback) }`.
  - `recordEdit` → `editCoalescer.push`.
  - `recordRun(report)`: ignore reports with `status: 'unavailable'`. Otherwise: flush the coalescer (so the last EDIT precedes the RUN); if `report.errorSignature` is set, add an `ERROR` event; add a `RUN` event with `passedCount`/`totalCount`; both use `occurredAt = report.finishedAt`; then `flushNow()` and return its response.
  - Every batch response is passed to `onBatchResponse` listeners.
  - On unmount and on `pagehide`: flush the coalescer, `close({ keepalive: true })`, then `endSession(sessionId, { keepalive: true })`. Timers and listeners are removed.
- **R5** `WorkspacePage` wires `CodeEditor` changes to `recordEdit` and `useRunTests.onReportReady` to `recordRun`. No other page imports anything from `features/telemetry/`.
- **R6** Event payloads exactly match spec 18 R1 (field names, no extra fields, no `sdiValue`).

## Parts

1. `sessionsApi`, `editCoalescer`, `telemetryBuffer` with tests (fake timers, fake send).
2. `useTelemetrySession` and the workspace wiring, with tests and a manual network check.

## Acceptance Criteria

- [ ] Edit, run, error and pass-count events are captured with timestamp and session id (TEL-01 AC 1).
- [ ] No capture outside the activity page (TEL-01 AC 2): navigating away stops timers; no requests after leaving.
- [ ] Batched payloads match the agreed schema (TEL-01 AC 3): verified against spec 18 by an end-to-end manual run with no `400` responses.
- [ ] With consent declined, no session or events request is ever made.
- [ ] Turning the network off for 30 seconds and back on delivers the missed events exactly once.

## Tests

- `editCoalescer.test.ts`: merging within 2 s; separate edits after 2 s; flush.
- `telemetryBuffer.test.ts`: periodic send; 200-event chunks; retry keeps ids; single in-flight request; `close` uses keepalive.
- `useTelemetrySession.test.tsx`: no start without consent; ERROR before RUN with the same `occurredAt`; unavailable report ignored; cleanup ends the session.
- Manual: DevTools network log of one session (start, batches, end) attached to the TEL-01 card (evidence for SP-05).

## Docs to Update

- `progress-tracker.md`: Completed entry.
