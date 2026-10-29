# 08 — Activities API

- **Card:** IMP-08 (https://trello.com/c/jhNdVH2n) · **Feature:** PLT-02 / M2
- **Owner:** Noel · **Reviewer:** Jacob
- **Depends on:** 06
- **Gates:** Q5 (paths, payloads), Q16 (status rules and limits)

## Goal

Instructors manage their own activities and test cases; students read only published activities, including the test data their browser needs to run tests.

## In Scope

- Instructor endpoints for activities, publish/archive, and test cases.
- Student read endpoints.
- Creating the `sdi_configs` row with configured defaults when an activity is created.
- `SdiDefaultsProperties` bound to `epistemictrace.sdi.defaults`.

## Out of Scope

- Editing SDI settings (INS-03 / IMP-32).
- Un-archiving, deleting activities, duplicating activities.
- Courses or per-student visibility.

## Requirements

- **R1** DTOs:
  - `ActivitySummary { id, title, status, testCaseCount, updatedAt }`
  - `ActivityDetail { id, title, problemStatement, starterCode, status, testCases: TestCaseDto[], createdAt, updatedAt }`
  - `TestCaseDto { id, position, input, expectedOutput, hidden }`
  - `ActivityRequest { title, problemStatement, starterCode }`
  - `TestCaseRequest { input, expectedOutput, hidden }`
- **R2** Limits (Q16): title trimmed 1–120; problem statement 1–20 000; starter code 0–20 000; test input 0–10 000; expected output 1–10 000; at most 50 test cases per activity. Violations → `400` with `errors`.
- **R3** Instructor endpoints (role `INSTRUCTOR`; every `{id}` must belong to the caller, else `403`; missing → `404`):
  - `GET /api/instructor/activities` → `ActivitySummary[]`, most recently updated first, all statuses.
  - `POST /api/instructor/activities` with `ActivityRequest` → `201 ActivityDetail`, status `DRAFT`, and an `sdi_configs` row with `threshold`, `cooldown_seconds`, `window_minutes` from `epistemictrace.sdi.defaults` (proposed `70`, `120`, `5` — configuration, not code).
  - `GET /api/instructor/activities/{id}` → `ActivityDetail`.
  - `PUT /api/instructor/activities/{id}` with `ActivityRequest` → `200 ActivityDetail`. `ARCHIVED` → `409`.
  - `POST /api/instructor/activities/{id}/publish` → `200 ActivityDetail`. Only from `DRAFT`; requires at least one test case, else `409` "Add at least one test case before publishing."
  - `POST /api/instructor/activities/{id}/archive` → `200 ActivityDetail`. From `DRAFT` or `PUBLISHED`; already `ARCHIVED` → `409`.
  - `GET /api/instructor/activities/{id}/test-cases` → `TestCaseDto[]` by position.
  - `POST /api/instructor/activities/{id}/test-cases` with `TestCaseRequest` → `201 TestCaseDto`, `position` = current max + 1.
  - `PUT /api/instructor/activities/{id}/test-cases/{testCaseId}` → `200 TestCaseDto`.
  - `DELETE /api/instructor/activities/{id}/test-cases/{testCaseId}` → `204`; remaining positions are renumbered 1..n. Deleting the last test case of a `PUBLISHED` activity → `409`.
  - Any test-case change on an `ARCHIVED` activity → `409`. A `testCaseId` from another activity → `404`.
  - Every change updates `activities.updated_at`.
- **R4** Student endpoints (role `STUDENT`):
  - `GET /api/activities` → `ActivitySummary[]` for `PUBLISHED` activities only, ordered by title.
  - `GET /api/activities/{id}` → `ActivityDetail` including hidden tests with their data (needed for browser execution, Q8). Not `PUBLISHED` (draft, archived) or missing → `404`.
- **R5** Services hold all rules; controllers validate and map. Ownership is checked with the user id passed from the controller.

## Parts

1. Activity CRUD (create with SDI config, list, get, update) + `SdiDefaultsProperties`.
2. Publish and archive.
3. Test-case endpoints.
4. Student read endpoints.

## Acceptance Criteria

- [ ] An instructor can create, edit and archive an activity (PLT-02).
- [ ] Test cases are saved with the activity and returned in position order (PLT-02).
- [ ] Students only see published activities; draft and archived return `404` (PLT-02).
- [ ] An instructor cannot read or change another instructor's activity (`403`).
- [ ] Publishing without test cases returns `409`.
- [ ] Creating an activity creates one `sdi_configs` row with the configured defaults.

## Tests

- `InstructorActivityControllerTests`: each endpoint's success; validation `400`; other instructor `403`; missing `404`; state `409` cases from R3.
- `StudentActivityControllerTests`: list shows only published; draft/archived detail `404`; hidden test data present with `hidden: true`.
- `ActivityServiceTests`: renumbering after delete; `updated_at` changes.

## Docs to Update

- `architecture-context.md` → API Surface (confirm rows).
- `progress-tracker.md`: Completed entry; Q16 accepted.
