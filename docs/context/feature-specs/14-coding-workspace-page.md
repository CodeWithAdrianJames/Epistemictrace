# 14 — Coding Workspace Page

- **Card:** IMP-14 (https://trello.com/c/L35BIBuU) · **Feature:** CW-03 / M3, M4
- **Owner:** Jacob · **Reviewer:** Adrian
- **Depends on:** 10, 11, 13
- **Gates:** Q8 (hidden-test display)

## Goal

On `/student/activities/:activityId`, the student sees the problem statement, the editor and the results panel together, can run the tests, and sees pass/fail per test and any runtime error.

## In Scope

- `features/workspace/WorkspacePage.tsx`, `ProblemPanel.tsx`, `ResultsPanel.tsx`, `RunButton.tsx`, `useRunTests.ts`.
- Replacing the temporary mounts from specs 11 and 12.

## Out of Scope

- Consent, sessions, telemetry (specs 15–17).
- Locking the runner (spec 23), struggle badge (spec 28).

## Requirements

- **R1** Load the activity with `activitiesApi.getActivity(activityId)`. States: "Loading activity…"; `404` → "This activity isn't available." with a link back to Activities; other errors → `ApiError.detail`.
- **R2** Layout follows `ui-context.md` → Coding Workspace: top bar (title, **Run tests**), problem panel left, editor top-right, results bottom-right; stacked below 1024px.
- **R3** Problem panel: problem statement as plain text with line breaks preserved (`white-space: pre-wrap`), plus the visible tests' inputs and expected outputs as examples. Hidden tests are not listed there.
- **R4** Editor: `CodeEditor` with `useDraft(user.id, activity.id, activity.starterCode)`. The `onChange` callback is exposed through a prop/hook so spec 17 can attach telemetry without editing `CodeEditor`.
- **R5** Runner lifecycle: one `pythonRunner` per page; `warmUp()` on mount; `dispose()` on unmount. While warming up, the button shows "Preparing Python…" and is disabled. If warm-up fails, show "Python couldn't start. Refresh the page to try again."
- **R6** `useRunTests` exposes `{ state: 'idle' | 'running', lastReport: RunReport | null, run(): Promise<RunReport | null>, onReportReady(callback) }`. `run()` calls `runTests(code, activity.testCases, runner)`. `onReportReady` lets spec 17 receive each completed report.
- **R7** Results panel (`ui-context.md` → Results Panel):
  - before the first run: the placeholder text;
  - summary "N of M tests passed";
  - visible tests: status, and on `failed` the input, expected and actual output;
  - hidden tests: "Hidden test K" and status only — no input, expected, actual or error details (Q8);
  - first runtime error: exception type, line and message; timeout message uses `RUN_TIMEOUT_MS` (shown in seconds).
- **R8** The editor stays editable while tests run.

## Parts

1. Page loading, layout and problem panel with the editor.
2. Runner lifecycle, `useRunTests`, run button states.
3. Results panel.

## Acceptance Criteria

- [ ] Problem statement, editor and results panel are visible together on a 1280×800 screen (CW-03 AC 1).
- [ ] The results panel updates after each run (CW-03 AC 2).
- [ ] Pass or fail is shown for each test case (CW-02 AC 2).
- [ ] A runtime error is shown with type, line and message (CW-02 AC 4).
- [ ] An infinite loop shows the timeout message and the next run works (CW-02 AC 3).
- [ ] Hidden tests show only name and status.
- [ ] Draft and archived activity ids show "This activity isn't available."

## Tests

- `ResultsPanel.test.tsx`: renders each status; hidden test details absent; summary text.
- `useRunTests.test.ts` (fake runner): state transitions; `onReportReady` called once per run.
- `WorkspacePage.test.tsx` (mocked API and runner): loading, `404`, and loaded layout.
- Manual: CW-02 and CW-03 checks with screenshots attached to the card.

## Docs to Update

- `progress-tracker.md`: Completed entry.
