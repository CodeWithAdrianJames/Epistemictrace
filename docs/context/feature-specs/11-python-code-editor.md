# 11 — Python Code Editor

- **Card:** IMP-11 (https://trello.com/c/5IHpkger) · **Feature:** CW-01 / M3
- **Owner:** Jacob · **Reviewer:** Adrian
- **Depends on:** 04
- **Gates:** —

## Goal

A reusable Monaco-based Python editor that keeps the student's code after a refresh and reports every content change with the number of characters added and removed.

## In Scope

- `features/workspace/CodeEditor.tsx`.
- `features/workspace/draftStore.ts` and `useDraft` hook.
- A temporary mount on the `/student/activities/:activityId` placeholder for manual checks.

## Out of Scope

- Loading the real activity and starter code (spec 14).
- Telemetry events (spec 17) — this unit only exposes the change callback.
- Read-only mode, themes other than `vs`, auto-complete configuration, multiple files.

## Requirements

- **R1** `CodeEditor` props: `value: string`, `onChange(value: string, change: EditorChange): void`, `ariaLabel?: string`. `EditorChange = { charsAdded: number; charsRemoved: number; at: number }` where `at = Date.now()`.
- **R2** Uses `@monaco-editor/react` with `language="python"`, `theme="vs"`, minimap off, word wrap on, font size 14, tab size 4 with spaces (`insertSpaces: true`).
- **R3** Change accounting: for each Monaco content-change event, `charsAdded` = sum of `change.text.length` and `charsRemoved` = sum of `change.rangeLength` over the event's `changes`. Called once per Monaco change event (every keystroke, paste or undo), never batched here (CW-01 AC 3).
- **R4** `draftStore`: `loadDraft(userId, activityId): string | null`, `saveDraft(userId, activityId, code)`, `clearDraft(userId, activityId)` using `localStorage` key `epistemictrace:draft:{userId}:{activityId}`. All calls wrapped in `try/catch`; storage errors are ignored (editor still works).
- **R5** `useDraft(userId, activityId, starterCode)` returns `[code, setCode]`. Initial value = saved draft if present, else `starterCode`. Saves are debounced by 500 ms and flushed on `pagehide` and on unmount.
- **R6** Temporary mount on the workspace placeholder page: the editor fills the content area with an empty starter. Use the logged-in user's id when spec 07 is merged; otherwise the literal `'local'`. Spec 14 replaces this mount.

## Parts

1. `draftStore` + `useDraft` with tests.
2. `CodeEditor` with change accounting, mounted on the placeholder page.

## Acceptance Criteria

- [ ] Python syntax highlighting is active (CW-01 AC 1).
- [ ] Typing code, then refreshing the page, shows the same code (CW-01 AC 2).
- [ ] `onChange` fires on every keystroke with correct `charsAdded`/`charsRemoved`; selecting 5 characters and typing 1 reports `+1 / −5` (CW-01 AC 3).
- [ ] Drafts for two different activity ids do not overwrite each other.
- [ ] With `localStorage` disabled (private mode or mocked to throw), the editor still works.

## Tests

- `draftStore.test.ts`: round trip; keys separated per user and activity; throwing storage is swallowed.
- `useDraft.test.ts` (fake timers): starter used when no draft; draft wins over starter; debounced save.
- `changeAccounting.test.ts`: extract the R3 calculation into a pure function `countChange(changes)` and test insert, delete, replace and multi-cursor cases.
- Manual (evidence for SP-05): screen recording or screenshots of highlighting and refresh persistence.

## Docs to Update

- `progress-tracker.md`: Completed entry.
