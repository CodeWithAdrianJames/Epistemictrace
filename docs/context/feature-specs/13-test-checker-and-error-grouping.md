# 13 — Test Checker and Error Grouping

- **Card:** IMP-13 (https://trello.com/c/LVs3mUc5) · **Feature:** CW-02 / M4
- **Owner:** Adrian · **Reviewer:** Noel
- **Depends on:** 08 (test-case shape), 12
- **Gates:** Q4 (error signature format), Q8 (hidden tests), Q14 (output comparison, stop at first timeout)

## Goal

Given the student's code and an activity's test cases, produce a run report: per-test status, pass count, and one error signature that groups repeated errors together.

## In Scope

- `features/runner/compareOutput.ts`, `errorSignature.ts`, `runTests.ts`.

## Out of Scope

- Rendering results (spec 14), sending telemetry (spec 17).
- Partial credit, fuzzy matching, floating-point tolerance.

## Requirements

- **R1** `normalizeOutput(text)`: replace `\r\n` with `\n`; strip trailing whitespace from every line; remove trailing empty lines. `compareOutput(expected, actual)` returns `normalizeOutput(expected) === normalizeOutput(actual)`.
- **R2** `errorSignature(result)`:
  - `status: 'error'` → `` `${error.type}@${error.line ?? '?'}` ``, truncated to 200 characters.
  - `status: 'timeout'` → `'Timeout@?'`.
  - anything else → `null`.
- **R3** `runTests(code, testCases, runner): Promise<RunReport>` runs test cases one at a time in `position` order through `runner.run(code, testCase.input)`.
  - `ok` and output matches → `passed`; `ok` and output differs → `failed` (keep `actualOutput`).
  - `error` → `error` (keep `error` and partial `actualOutput`).
  - `timeout` → `timeout`; every later test → `not_run`; stop.
  - `unavailable` → stop; the report has `status: 'unavailable'` and the message; no telemetry should be produced for it (spec 17 checks this).
- **R4** `RunReport = { status: 'completed' | 'unavailable', results: TestResult[], passedCount, totalCount, errorSignature: string | null, firstError: PythonError | 'timeout' | null, finishedAt: number }`.
  - `TestResult = { testCaseId, position, hidden, status: 'passed' | 'failed' | 'error' | 'timeout' | 'not_run', actualOutput?: string, error?: PythonError }`.
  - `totalCount` = number of test cases (including `not_run`).
  - `errorSignature` and `firstError` come from the **first** test with status `error` or `timeout` (one ERROR event per run, Q4).
- **R5** Hidden tests are processed exactly like visible ones; hiding is a display concern (spec 14).
- **R6** All three modules are plain TypeScript with no React or DOM imports.

## Parts

1. `compareOutput` and `errorSignature` with tests.
2. `runTests` with a fake runner and tests.

## Acceptance Criteria

- [ ] `"5\n"` matches `"5"`; `"5 \r\n\n"` matches `"5"`; `"5"` does not match `"6"`; `"a b"` does not match `"a  b"`.
- [ ] Two runs that fail with the same exception on the same line produce the same signature; a different line produces a different one.
- [ ] A timeout in test 2 of 4 gives statuses `[x, timeout, not_run, not_run]` and `totalCount = 4`.
- [ ] `passedCount` counts only `passed`.

## Tests

- `compareOutput.test.ts`, `errorSignature.test.ts`, `runTests.test.ts` covering every branch in R1–R4 with a fake runner.

## Docs to Update

- `progress-tracker.md`: Completed entry.
