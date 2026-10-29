# 27 — Session History Page

- **Card:** IMP-27 (https://trello.com/c/YXLQU4gO) · **Feature:** STU-01 / M8
- **Owner:** Jacob · **Reviewer:** Noel
- **Depends on:** 26
- **Gates:** —

## Goal

Students review their past sessions and the reflections they wrote.

## In Scope

- `api/historyApi.ts`.
- Pages `/student/history` and `/student/history/:sessionId`.

## Out of Scope

- Charts, struggle levels per session, editing reflections.

## Requirements

- **R1** `historyApi.listSessions(page)` and `getSession(id)` match spec 26.
- **R2** List page "My history": one row per session with date and time started (local time, e.g. "Mon, 3 Nov 2026, 10:15"), activity title, duration ("25 min", "1 h 5 min", or "In progress" when `durationSeconds` is `null`), and "N reflections". Each row links to the detail page. **Previous** / **Next** buttons when there is more than one page.
- **R3** Empty state: "You haven't worked on any activities yet." with a link to Activities.
- **R4** Detail page: activity title, date, duration, number of runs, and each reflection as a card with its time, "What I thought was wrong" (hypothesis) and "What I planned to try" (planned fix). If there are none: "No pauses in this session."
- **R5** Reflection text is rendered as plain text (no HTML), with line breaks preserved.
- **R6** No SDI number or level is shown (invariant 5).
- **R7** Loading and error states as in `ui-context.md` → Layout Patterns.

## Parts

1. API module, list page and formatting helpers with tests.
2. Detail page with tests.

## Acceptance Criteria

- [ ] The list shows date, activity, duration and reflections (STU-01 AC 1).
- [ ] The history page opens in under 3 seconds with 200 sessions (STU-01 AC 2), measured in the browser's network panel and attached to the card.
- [ ] Opening another student's session id shows "This session isn't available."
- [ ] Reflection text containing `<b>` is shown literally, not as bold.

## Tests

- `formatDuration.test.ts`, `formatDateTime.test.ts`.
- `HistoryListPage.test.tsx` (mocked API): rows, paging buttons, empty state.
- `SessionDetailPage.test.tsx`: reflections rendered; none state; `403` message.

## Docs to Update

- `progress-tracker.md`: Completed entry; MVP must-haves complete.
