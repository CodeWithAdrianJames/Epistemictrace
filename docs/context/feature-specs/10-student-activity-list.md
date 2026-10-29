# 10 — Student Activity List

- **Card:** IMP-10 (https://trello.com/c/mayhhkzi) · **Feature:** PLT-02 / M2
- **Owner:** Jacob · **Reviewer:** Noel
- **Depends on:** 07, 08
- **Gates:** —

## Goal

Students see the published activities and can open one.

## In Scope

- `api/activitiesApi.ts` with `listActivities()` and `getActivity(id)` (the second is used by spec 14).
- The `/student/activities` page.

## Out of Scope

- Progress per activity, search, filters, courses.
- The workspace page itself (spec 14).

## Requirements

- **R1** `activitiesApi.listActivities()` → `GET /api/activities`; `getActivity(id)` → `GET /api/activities/{id}`. Types match spec 08 R1.
- **R2** Page heading "Activities". One row per activity, ordered as the server returns them (by title), showing the title and "N tests"; the whole row links to `/student/activities/{id}`.
- **R3** States: "Loading activities…"; empty state "No activities are available yet. Check back later."; error message from `ApiError.detail`.
- **R4** No telemetry, session or consent logic on this page (invariant 2).

## Parts

1. API module and page with all three states.

## Acceptance Criteria

- [ ] A published activity appears; a draft or archived one does not.
- [ ] Clicking a row opens `/student/activities/{id}`.
- [ ] Empty and error states show the R3 text.
- [ ] No request other than `GET /api/activities` is made from this page.

## Tests

- `StudentActivityListPage.test.tsx` (mocked API): renders rows; empty state; error state; link targets.

## Docs to Update

- `progress-tracker.md`: Completed entry.
