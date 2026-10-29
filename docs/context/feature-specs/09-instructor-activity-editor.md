# 09 — Instructor Activity Editor

- **Card:** IMP-09 (https://trello.com/c/cUfkJ2ba) · **Feature:** PLT-02 / M2
- **Owner:** Jacob · **Reviewer:** Noel
- **Depends on:** 07, 08
- **Gates:** Q16 (status rules and limits)

## Goal

Instructors can list their activities, create and edit them, manage test cases, and publish or archive them from the browser.

## In Scope

- `api/instructorActivitiesApi.ts` for every instructor endpoint in spec 08.
- Pages `/instructor/activities`, `/instructor/activities/new`, `/instructor/activities/:activityId`.

## Out of Scope

- SDI settings (IMP-32), analytics, reflection review.
- Markdown rendering of the problem statement (plain text with preserved line breaks).
- Monaco for starter code (a mono `<textarea>` is enough).

## Requirements

- **R1** List page: one row per activity with title, status label (Draft / Published / Archived), test-case count, last updated date, and an **Edit** link. **New activity** button at the top. Empty state: "You haven't created any activities yet."
- **R2** New page: fields Title, Problem statement (`<textarea>`), Starter code (mono `<textarea>`). **Create** → `POST`, then navigate to the edit page of the new activity.
- **R3** Edit page, top section: the same three fields with **Save changes** (enabled only when something changed). Shows the status label.
- **R4** Edit page, test cases section: a list in position order. Each row shows "Test N", input (mono), expected output (mono), a **Hidden** checkbox, **Save** and **Delete**. An **Add test case** form below with the same fields. Delete asks for confirmation with the browser `confirm()` dialog.
- **R5** Status actions:
  - `DRAFT`: **Publish** (disabled with the hint "Add at least one test case" when there are none) and **Archive**.
  - `PUBLISHED`: **Archive**; editing stays allowed.
  - `ARCHIVED`: all fields and buttons read-only with the note "Archived activities can't be edited."
  - Archive asks for confirmation.
- **R6** Client validation mirrors spec 08 R2 limits; server `400` field errors are shown under their fields; `409` details are shown at the top of the section that caused them.
- **R7** After every successful action, the page shows the server's returned data (no optimistic updates).

## Parts

1. API module + list page.
2. New page and edit page top section.
3. Test-case section.
4. Publish/archive actions and read-only archived state.

## Acceptance Criteria

- [ ] An instructor can create an activity, add two test cases (one hidden), publish it, and see it as Published in the list.
- [ ] An instructor can edit the title of a published activity.
- [ ] Archiving makes the edit page read-only.
- [ ] Publishing is impossible without a test case, and the reason is shown.
- [ ] Validation errors appear next to the right field.

## Tests

- `ActivityListPage.test.tsx` (mocked API): rows and empty state.
- `TestCaseEditor.test.tsx`: add, save, delete calls with the right payloads.
- `ActivityStatusActions.test.tsx`: buttons per status from R5.

## Docs to Update

- `progress-tracker.md`: Completed entry.
