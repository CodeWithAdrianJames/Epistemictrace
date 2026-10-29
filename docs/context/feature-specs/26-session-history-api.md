# 26 — Session History API

- **Card:** IMP-26 (https://trello.com/c/ACqQe8D7) · **Feature:** STU-01 / M8
- **Owner:** Noel · **Reviewer:** Jacob
- **Depends on:** 24
- **Gates:** —

## Goal

A student can fetch a paged list of their own past sessions and the details of one session, including reflections, without any SDI numbers.

## In Scope

- `GET /api/me/sessions`, `GET /api/me/sessions/{id}` in `history/`.

## Out of Scope

- Instructor views of sessions (IMP-29, IMP-31).
- Event-level timelines, charts, code snapshots.

## Requirements

- **R1** `GET /api/me/sessions?page=0&size=20` (role `STUDENT`; `size` 1–50, default 20): only the caller's sessions, newest `started_at` first. Response:
  ```json
  { "items": [ { "sessionId", "activityId", "activityTitle", "startedAt", "endedAt", "durationSeconds", "runCount", "reflectionCount" } ],
    "page": 0, "size": 20, "totalItems": 37 }
  ```
  - `durationSeconds` = `endedAt − startedAt` in whole seconds, `null` if `endedAt` is `null`.
  - `runCount` = RUN events in the session; `reflectionCount` = reflections in the session.
  - Archived activities still appear with their title.
- **R2** `GET /api/me/sessions/{id}`: owner only (`404` / `403`). Response: the same fields as a list item plus `"reflections": [ { "hypothesis", "plannedFix", "submittedAt" } ]` ordered by `submittedAt`.
- **R3** No field contains `sdi_value`, `peak_sdi`, `sdi_at_lock` or `sdi_at_trigger` (invariant 5).
- **R4** Performance: the list uses one query for the page of sessions and one aggregate query for counts of those sessions (no N+1). With 200 sessions and 10 000 events for one student, the list endpoint responds in under 500 ms on a developer laptop (supports STU-01 AC 2, under 3 s page load).

## Parts

1. Repository queries (projection + counts) with tests.
2. Controllers and MockMvc tests.

## Acceptance Criteria

- [ ] The list returns date, activity, duration and reflection count for the caller's sessions only (STU-01 AC 1, API).
- [ ] Another student's session id returns `403`.
- [ ] No SDI field appears in either response.
- [ ] The R4 timing check passes and its output is attached to the card.

## Tests

- `HistoryControllerTests`: ordering, paging, durations (ended and open sessions), counts, ownership, instructor `403`, absence of SDI fields.
- `HistoryPerformanceTests` (tagged, may be run manually): seeded 200 sessions / 10 000 events timing.

## Docs to Update

- `progress-tracker.md`: Completed entry.
