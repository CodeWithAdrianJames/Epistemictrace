import { describe, expect, it, vi } from 'vitest'
import type { ProgramRunner } from './pythonHarness.ts'
import type { RunOutcome, WorkerToMain } from './runnerProtocol.ts'
import { createWorkerHandler } from './workerHandler.ts'

const OK: RunOutcome = { status: 'ok', stdout: '42\n' }

function setup(loadRunner: () => Promise<ProgramRunner>) {
  const posted: WorkerToMain[] = []
  const load = vi.fn(loadRunner)
  const handle = createWorkerHandler({ loadRunner: load, post: (message) => posted.push(message) })
  return { handle, posted, load }
}

describe('createWorkerHandler', () => {
  it('loads once on init and answers ready', async () => {
    const { handle, posted, load } = setup(async () => () => OK)

    await handle({ type: 'init' })

    expect(load).toHaveBeenCalledTimes(1)
    expect(posted).toEqual([{ type: 'ready' }])
  })

  it('does not load again on a second init, and still answers ready', async () => {
    const { handle, posted, load } = setup(async () => () => OK)

    await handle({ type: 'init' })
    await handle({ type: 'init' })

    expect(load).toHaveBeenCalledTimes(1)
    expect(posted).toEqual([{ type: 'ready' }, { type: 'ready' }])
  })

  it('answers init-error with the load error message, and retries on the next init', async () => {
    let attempts = 0
    const { handle, posted, load } = setup(async () => {
      attempts += 1
      if (attempts === 1) throw new Error('Failed to fetch')
      return () => OK
    })

    await handle({ type: 'init' })
    await handle({ type: 'init' })

    expect(load).toHaveBeenCalledTimes(2)
    expect(posted).toEqual([{ type: 'init-error', message: 'Failed to fetch' }, { type: 'ready' }])
  })

  it('uses a fallback message when the load error has none', async () => {
    const { handle, posted } = setup(() => Promise.reject('nope'))

    await handle({ type: 'init' })

    expect(posted).toEqual([{ type: 'init-error', message: 'Pyodide could not be loaded.' }])
  })

  it('runs the program with its stdin and answers with the same run id', async () => {
    const program = vi.fn<ProgramRunner>(() => OK)
    const { handle, posted } = setup(async () => program)

    await handle({ type: 'init' })
    await handle({ type: 'run', runId: 'run-7', code: 'print(int(input()) * 2)', stdin: '21' })

    expect(program).toHaveBeenCalledWith('print(int(input()) * 2)', '21')
    expect(posted[1]).toEqual({ type: 'result', runId: 'run-7', outcome: OK })
  })

  it('answers every run, in order', async () => {
    const { handle, posted } = setup(async () => (code) => ({ status: 'ok', stdout: `${code}\n` }))

    await handle({ type: 'init' })
    await handle({ type: 'run', runId: 'a', code: 'one', stdin: '' })
    await handle({ type: 'run', runId: 'b', code: 'two', stdin: '' })

    expect(posted.slice(1)).toEqual([
      { type: 'result', runId: 'a', outcome: { status: 'ok', stdout: 'one\n' } },
      { type: 'result', runId: 'b', outcome: { status: 'ok', stdout: 'two\n' } },
    ])
  })

  it('answers an InternalError outcome when the harness throws', async () => {
    const { handle, posted } = setup(async () => () => {
      throw new Error('harness broke')
    })

    await handle({ type: 'init' })
    await handle({ type: 'run', runId: 'r', code: 'x', stdin: '' })

    expect(posted[1]).toEqual({
      type: 'result',
      runId: 'r',
      outcome: { status: 'error', stdout: '', error: { type: 'InternalError', message: 'harness broke', line: null } },
    })
  })

  it('answers an InternalError outcome for a run before init', async () => {
    const { handle, posted } = setup(async () => () => OK)

    await handle({ type: 'run', runId: 'r', code: 'x', stdin: '' })

    expect(posted).toEqual([
      {
        type: 'result',
        runId: 'r',
        outcome: {
          status: 'error',
          stdout: '',
          error: { type: 'InternalError', message: 'The Python runner was not initialised.', line: null },
        },
      },
    ])
  })
})
