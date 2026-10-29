# 12 — Safe In-Browser Python Runner

- **Card:** IMP-12 (https://trello.com/c/8xDlHPv6) · **Feature:** CW-02 / M4
- **Owner:** Adrian · **Reviewer:** Noel
- **Depends on:** 04
- **Gates:** Q7 (time limit), Q14 (Pyodide loading and execution semantics)

## Goal

Student Python runs inside a Web Worker running Pyodide. The main thread can run one program with given stdin and get back stdout or an error, and a program that runs too long is stopped.

## In Scope

- `features/runner/python.worker.ts` (worker).
- `features/runner/pythonRunner.ts` (main-thread wrapper).
- `features/runner/runnerConfig.ts` (time limit and Pyodide version, one place).
- Adding the `pyodide` package (pinned exact version) per Q14.

## Out of Scope

- Running test cases and comparing output (spec 13).
- UI (spec 14).
- Package installation (`micropip`), file system access, `input()` prompts beyond stdin lines.

## Requirements

- **R1** `runnerConfig.ts` exports `RUN_TIMEOUT_MS` (proposed `3000`, Q7) and `PYODIDE_INDEX_URL` for the pinned version. No other file contains these values.
- **R2** Worker messages (typed as discriminated unions in `runnerProtocol.ts`):
  - main → worker: `{ type: 'init' }`, `{ type: 'run', runId: string, code: string, stdin: string }`
  - worker → main: `{ type: 'ready' }`, `{ type: 'init-error', message }`, `{ type: 'result', runId, outcome: RunOutcome }`
  - `RunOutcome = { status: 'ok', stdout: string } | { status: 'error', stdout: string, error: PythonError }`
  - `PythonError = { type: string, message: string, line: number | null }`
- **R3** The worker loads Pyodide once on `init`. Each `run`:
  - creates a fresh globals dict (no state leaks between runs);
  - feeds `stdin` line by line to Python's standard input; reading past the end raises `EOFError`;
  - captures everything written to stdout;
  - on an exception, reports the exception class name, its message, and the line number of the last traceback frame inside the student's code (`null` if none).
  Verify every Pyodide call (loading, stdin/stdout redirection, running with custom globals) against the documentation of the pinned version; do not rely on remembered signatures.
- **R4** `pythonRunner` API:
  - `warmUp(): Promise<void>` — creates the worker and waits for `ready`; idempotent.
  - `run(code, stdin): Promise<ExecutionResult>` where `ExecutionResult = RunOutcome | { status: 'timeout' } | { status: 'unavailable', message }`.
  - Only one run at a time; calling `run` while busy rejects with an `Error('busy')`.
  - Starts a `RUN_TIMEOUT_MS` timer when the `run` message is posted (after `ready`). On timeout it calls `worker.terminate()`, resolves `{ status: 'timeout' }`, and lazily creates a new worker on the next `warmUp`/`run`.
  - `dispose()` terminates the worker (called on page unmount).
  - The worker factory is injectable (`createPythonRunner(createWorker = defaultFactory)`) so tests can use a fake worker.
- **R5** The worker is created with `new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })`.
- **R6** No student code ever runs on the main thread (invariant 1).

## Parts

1. Protocol types, config and `pythonRunner` with a fake worker + tests.
2. Real worker with Pyodide; manual verification page section (temporary button on the workspace placeholder that runs a hard-coded snippet; remove in spec 14).

## Acceptance Criteria

- [ ] `print(int(input()) * 2)` with stdin `21` returns `stdout = "42\n"` (CW-02 AC 1: code runs inside a Web Worker).
- [ ] `while True: pass` resolves `{ status: 'timeout' }` within `RUN_TIMEOUT_MS + 500 ms`, and the next run works (CW-02 AC 3).
- [ ] `1/0` on line 2 returns `error.type = 'ZeroDivisionError'`, `line = 2` (CW-02 AC 4 input).
- [ ] A variable defined in one run is not defined in the next run.
- [ ] The page stays responsive (typing works) during a long-running program.

## Tests

- `pythonRunner.test.ts` (fake worker, fake timers): ready handshake; result routing by `runId`; busy rejection; timeout terminates and recreates; `dispose`.
- Manual: the five acceptance checks in Chrome, with screenshots or a short recording attached to the card.

## Docs to Update

- `PROJECT.md` §6: Pyodide "In repo" with the pinned version.
- `architecture-context.md` → Code Execution Model: remove "Proposed" once Q7/Q14 are accepted.
- `progress-tracker.md`: Completed entry, plus measured Pyodide start-up time under Session Notes.
