import type { PyodideInterface } from 'pyodide'
import type { RunOutcome } from './runnerProtocol.ts'

export type ProgramRunner = (code: string, stdin: string) => RunOutcome

const RUN_FUNCTION = '_epistemictrace_run'

// Runs inside Pyodide. The student program gets its own namespace dict on every call, so nothing it
// defines is visible to the next run, and nothing defined here is visible to it. stdin is a StringIO,
// so reading past the last line raises EOFError exactly as `input()` does at the end of piped input.
const HARNESS_SOURCE = `
import io
import json
import sys

_STUDENT_FILE = '<student>'


def ${RUN_FUNCTION}(code, stdin_text):
    out = io.StringIO()
    saved_stdin, saved_stdout = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(stdin_text)
    sys.stdout = out
    error = None
    try:
        try:
            compiled = compile(code, _STUDENT_FILE, 'exec')
        except SyntaxError as exc:
            error = {'type': type(exc).__name__, 'message': exc.msg, 'line': exc.lineno}
        else:
            exec(compiled, {'__name__': '__main__'})
    except SystemExit as exc:
        if exc.code not in (None, 0):
            error = {'type': 'SystemExit', 'message': str(exc.code), 'line': _student_line(exc)}
    except BaseException as exc:
        error = {'type': type(exc).__name__, 'message': str(exc), 'line': _student_line(exc)}
    finally:
        sys.stdin, sys.stdout = saved_stdin, saved_stdout
    return json.dumps({'stdout': out.getvalue(), 'error': error})


def _student_line(exc):
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _STUDENT_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line
`

function parseOutcome(raw: unknown): RunOutcome {
  const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : null
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Unreadable result from the Python harness.')
  const { stdout, error } = parsed as { stdout?: unknown; error?: unknown }
  if (typeof stdout !== 'string') throw new Error('Unreadable result from the Python harness.')
  if (error === null) return { status: 'ok', stdout }

  const { type, message, line } = (error ?? {}) as { type?: unknown; message?: unknown; line?: unknown }
  if (typeof type !== 'string' || typeof message !== 'string') {
    throw new Error('Unreadable result from the Python harness.')
  }
  return { status: 'error', stdout, error: { type, message, line: typeof line === 'number' ? line : null } }
}

export function createProgramRunner(pyodide: PyodideInterface): ProgramRunner {
  pyodide.runPython(HARNESS_SOURCE)
  const runFunction = pyodide.globals.get(RUN_FUNCTION)

  return (code, stdin) => parseOutcome(runFunction(code, stdin))
}
