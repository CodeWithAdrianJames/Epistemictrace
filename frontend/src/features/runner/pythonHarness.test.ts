// @vitest-environment node
// Runs the real Pyodide from node_modules (no network), so the Python side of the runner is tested for real.
import { loadPyodide } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { createProgramRunner, type ProgramRunner } from './pythonHarness.ts'

let run: ProgramRunner

beforeAll(async () => {
  run = createProgramRunner(await loadPyodide())
}, 120_000)

function errorOf(code: string, stdin = '') {
  const outcome = run(code, stdin)
  if (outcome.status !== 'error') throw new Error(`expected an error, got ${JSON.stringify(outcome)}`)
  return outcome
}

describe('stdin and stdout', () => {
  it('doubles the number read from stdin', () => {
    expect(run('print(int(input()) * 2)', '21')).toEqual({ status: 'ok', stdout: '42\n' })
  })

  it('feeds stdin line by line', () => {
    const code = 'a = input()\nb = input()\nprint(b, a)'

    expect(run(code, 'first\nsecond\n')).toEqual({ status: 'ok', stdout: 'second first\n' })
  })

  it('reads all lines through sys.stdin too', () => {
    const code = 'import sys\nprint(len(sys.stdin.read().splitlines()))'

    expect(run(code, 'a\nb\nc\n')).toEqual({ status: 'ok', stdout: '3\n' })
  })

  it('raises EOFError when the program reads past the end, keeping earlier output', () => {
    const outcome = errorOf('print("before")\nx = input()\ny = input()\nprint(x, y)', 'only one line\n')

    expect(outcome.stdout).toBe('before\n')
    expect(outcome.error).toEqual({ type: 'EOFError', message: 'EOF when reading a line', line: 3 })
  })

  it('raises EOFError on the first read when stdin is empty', () => {
    expect(errorOf('input()', '').error).toMatchObject({ type: 'EOFError', line: 1 })
  })

  it('returns the stdout exactly as written: no normalization, no trailing newline added', () => {
    expect(run('print("a", end="")', '')).toEqual({ status: 'ok', stdout: 'a' })
    expect(run('print("x  ")\nprint()', '')).toEqual({ status: 'ok', stdout: 'x  \n\n' })
  })

  it('keeps non-ASCII output', () => {
    expect(run('print("héllo ✓")', '')).toEqual({ status: 'ok', stdout: 'héllo ✓\n' })
  })

  it('does not capture stderr as stdout', () => {
    const code = 'import sys\nprint("out")\nprint("err", file=sys.stderr)'

    expect(run(code, '')).toEqual({ status: 'ok', stdout: 'out\n' })
  })

  it('restores sys.stdout and sys.stdin after a run, even after an error', () => {
    errorOf('print("x")\n1/0')

    expect(run('print("next")', '')).toEqual({ status: 'ok', stdout: 'next\n' })
  })
})

describe('errors', () => {
  it('reports ZeroDivisionError on line 2', () => {
    const outcome = errorOf('x = 1\ny = 1/0\nprint(y)')

    expect(outcome.error).toEqual({ type: 'ZeroDivisionError', message: 'division by zero', line: 2 })
  })

  it('reports the line of the last frame inside the student code, not the call site', () => {
    const code = 'def f(a):\n    return a[5]\n\nvalues = [1]\nprint(f(values))'

    expect(errorOf(code).error).toEqual({
      type: 'IndexError',
      message: 'list index out of range',
      line: 2,
    })
  })

  it('reports the line of the student frame when the error starts inside a library call', () => {
    expect(errorOf('import json\nx = 1\njson.loads("{")').error).toMatchObject({
      type: 'JSONDecodeError',
      line: 3,
    })
  })

  it('reports a SyntaxError with its line', () => {
    const outcome = errorOf('print(1)\nprint(2\n')

    expect(outcome.stdout).toBe('')
    expect(outcome.error.type).toBe('SyntaxError')
    expect(outcome.error.line).toBeGreaterThanOrEqual(2)
    expect(outcome.error.message).not.toContain('<student>')
  })

  it('reports an IndentationError by its own class name', () => {
    expect(errorOf('if True:\nprint(1)').error).toMatchObject({ type: 'IndentationError', line: 2 })
  })

  it('reports NameError', () => {
    expect(errorOf('print(missing)').error).toEqual({
      type: 'NameError',
      message: "name 'missing' is not defined",
      line: 1,
    })
  })

  it('reports a student-defined exception class by name', () => {
    const code = 'class Boom(Exception):\n    pass\n\nraise Boom("bad")'

    expect(errorOf(code).error).toEqual({ type: 'Boom', message: 'bad', line: 4 })
  })

  it('reports RecursionError', () => {
    expect(errorOf('def f():\n    return f()\nf()').error).toMatchObject({ type: 'RecursionError' })
  })

  it('treats sys.exit() and sys.exit(0) as a normal end', () => {
    expect(run('print(1)\nimport sys\nsys.exit()', '')).toEqual({ status: 'ok', stdout: '1\n' })
    expect(run('import sys\nsys.exit(0)', '')).toEqual({ status: 'ok', stdout: '' })
  })

  it('reports sys.exit with a non-zero code as SystemExit', () => {
    expect(errorOf('import sys\nsys.exit(2)').error).toEqual({ type: 'SystemExit', message: '2', line: 2 })
  })
})

describe('isolation between runs', () => {
  it('does not keep a variable from one run in the next', () => {
    expect(run('x = 5\nprint(x)', '')).toEqual({ status: 'ok', stdout: '5\n' })

    expect(errorOf('print(x)').error).toEqual({ type: 'NameError', message: "name 'x' is not defined", line: 1 })
  })

  it('does not keep functions, classes or imports from one run in the next', () => {
    run('import math\ndef helper():\n    return 1\nclass K:\n    pass', '')

    expect(errorOf('helper()').error.type).toBe('NameError')
    expect(errorOf('K()').error.type).toBe('NameError')
    expect(errorOf('math.pi').error.type).toBe('NameError')
  })

  it('does not expose the harness names to the student program', () => {
    expect(errorOf('print(_STUDENT_FILE)').error.type).toBe('NameError')
    expect(errorOf('print(_epistemictrace_run)').error.type).toBe('NameError')
    expect(errorOf('print(json)').error.type).toBe('NameError')
  })

  it('runs the program as __main__', () => {
    expect(run('print(__name__)', '')).toEqual({ status: 'ok', stdout: '__main__\n' })
  })

  it('gives each run its own stdin', () => {
    expect(run('print(input())', 'one')).toEqual({ status: 'ok', stdout: 'one\n' })
    expect(run('print(input())', 'two')).toEqual({ status: 'ok', stdout: 'two\n' })
  })
})
