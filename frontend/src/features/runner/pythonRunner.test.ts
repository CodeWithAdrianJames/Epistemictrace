import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPythonRunner, type WorkerLike } from './pythonRunner.ts'
import type { MainToWorker, RunOutcome, WorkerToMain } from './runnerProtocol.ts'
import { RUN_TIMEOUT_MS } from './runnerConfig.ts'

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerToMain>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: MainToWorker[] = []
  terminated = false

  postMessage(message: MainToWorker): void {
    this.posted.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: WorkerToMain): void {
    this.onmessage?.({ data: message } as MessageEvent<WorkerToMain>)
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent)
  }

  get runMessages(): Extract<MainToWorker, { type: 'run' }>[] {
    return this.posted.filter((m) => m.type === 'run')
  }

  get initMessages(): MainToWorker[] {
    return this.posted.filter((m) => m.type === 'init')
  }
}

const OK: RunOutcome = { status: 'ok', stdout: '42\n' }

function setup() {
  const workers: FakeWorker[] = []
  const factory = vi.fn(() => {
    const worker = new FakeWorker()
    workers.push(worker)
    return worker
  })
  const runner = createPythonRunner(factory)
  return { runner, workers, factory }
}

// Lets promise callbacks run without moving the fake clock.
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('warmUp', () => {
  it('creates one worker, posts init and resolves on ready', async () => {
    const { runner, workers } = setup()
    let resolved = false

    const promise = runner.warmUp().then(() => {
      resolved = true
    })
    await flush()

    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toEqual([{ type: 'init' }])
    expect(resolved).toBe(false)

    workers[0].emit({ type: 'ready' })
    await promise

    expect(resolved).toBe(true)
  })

  it('is idempotent: a second call reuses the worker and posts init once', async () => {
    const { runner, workers, factory } = setup()

    const first = runner.warmUp()
    const second = runner.warmUp()
    workers[0].emit({ type: 'ready' })
    await Promise.all([first, second])
    await runner.warmUp()

    expect(factory).toHaveBeenCalledTimes(1)
    expect(workers[0].initMessages).toHaveLength(1)
  })

  it('rejects with the worker message on init-error, then retries with a new worker', async () => {
    const { runner, workers } = setup()

    const failed = runner.warmUp()
    workers[0].emit({ type: 'init-error', message: 'network down' })

    await expect(failed).rejects.toThrow('network down')
    expect(workers[0].terminated).toBe(true)

    const retry = runner.warmUp()
    expect(workers).toHaveLength(2)
    workers[1].emit({ type: 'ready' })
    await expect(retry).resolves.toBeUndefined()
  })

  it('rejects when the worker crashes before it is ready', async () => {
    const { runner, workers } = setup()

    const failed = runner.warmUp()
    workers[0].crash('boom')

    await expect(failed).rejects.toThrow('boom')
    expect(workers[0].terminated).toBe(true)
  })
})

describe('run', () => {
  it('waits for ready, then posts the code and stdin with a run id', async () => {
    const { runner, workers } = setup()

    const promise = runner.run('print(int(input()) * 2)', '21')
    await flush()

    expect(workers[0].posted).toEqual([{ type: 'init' }])

    workers[0].emit({ type: 'ready' })
    await flush()

    const [message] = workers[0].runMessages
    expect(message).toMatchObject({ type: 'run', code: 'print(int(input()) * 2)', stdin: '21' })
    expect(typeof message.runId).toBe('string')

    workers[0].emit({ type: 'result', runId: message.runId, outcome: OK })
    await expect(promise).resolves.toEqual(OK)
  })

  it('resolves an error outcome unchanged', async () => {
    const { runner, workers } = setup()
    const outcome: RunOutcome = {
      status: 'error',
      stdout: '',
      error: { type: 'ZeroDivisionError', message: 'division by zero', line: 2 },
    }

    const promise = runner.run('x = 1\n1/0', '')
    workers[0].emit({ type: 'ready' })
    await flush()
    workers[0].emit({ type: 'result', runId: workers[0].runMessages[0].runId, outcome })

    await expect(promise).resolves.toEqual(outcome)
  })

  it('reuses the ready worker for later runs, each with its own run id', async () => {
    const { runner, workers, factory } = setup()
    await Promise.all([runner.warmUp(), Promise.resolve().then(() => workers[0].emit({ type: 'ready' }))])

    const first = runner.run('a', '')
    await flush()
    workers[0].emit({ type: 'result', runId: workers[0].runMessages[0].runId, outcome: OK })
    await first

    const second = runner.run('b', '')
    await flush()
    workers[0].emit({ type: 'result', runId: workers[0].runMessages[1].runId, outcome: { status: 'ok', stdout: 'b\n' } })

    await expect(second).resolves.toEqual({ status: 'ok', stdout: 'b\n' })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(workers[0].runMessages[0].runId).not.toBe(workers[0].runMessages[1].runId)
  })

  it('routes results by run id and ignores a result for another run', async () => {
    const { runner, workers } = setup()
    const promise = runner.run('a', '')
    workers[0].emit({ type: 'ready' })
    await flush()
    const { runId } = workers[0].runMessages[0]
    let settled = false
    void promise.then(() => {
      settled = true
    })

    workers[0].emit({ type: 'result', runId: 'someone-else', outcome: { status: 'ok', stdout: 'wrong\n' } })
    await flush()
    expect(settled).toBe(false)

    workers[0].emit({ type: 'result', runId, outcome: OK })
    await expect(promise).resolves.toEqual(OK)
  })

  it('rejects with Error("busy") while a run waits for ready, and while it executes', async () => {
    const { runner, workers } = setup()

    const first = runner.run('a', '')
    await expect(runner.run('b', '')).rejects.toThrow('busy')

    workers[0].emit({ type: 'ready' })
    await flush()
    await expect(runner.run('c', '')).rejects.toThrow('busy')
    expect(workers[0].runMessages).toHaveLength(1)

    workers[0].emit({ type: 'result', runId: workers[0].runMessages[0].runId, outcome: OK })
    await first

    const next = runner.run('d', '')
    await flush()
    expect(workers[0].runMessages).toHaveLength(2)
    workers[0].emit({ type: 'result', runId: workers[0].runMessages[1].runId, outcome: OK })
    await expect(next).resolves.toEqual(OK)
  })

  it('resolves unavailable with the message when init fails, and is not busy afterwards', async () => {
    const { runner, workers } = setup()

    const promise = runner.run('a', '')
    workers[0].emit({ type: 'init-error', message: 'could not load Pyodide' })

    await expect(promise).resolves.toEqual({ status: 'unavailable', message: 'could not load Pyodide' })

    const retry = runner.run('a', '')
    expect(workers).toHaveLength(2)
    workers[1].emit({ type: 'ready' })
    await flush()
    workers[1].emit({ type: 'result', runId: workers[1].runMessages[0].runId, outcome: OK })
    await expect(retry).resolves.toEqual(OK)
  })

  it('resolves unavailable and drops the worker when it crashes during a run', async () => {
    const { runner, workers } = setup()
    const promise = runner.run('a', '')
    workers[0].emit({ type: 'ready' })
    await flush()

    workers[0].crash('out of memory')

    await expect(promise).resolves.toEqual({ status: 'unavailable', message: 'out of memory' })
    expect(workers[0].terminated).toBe(true)

    void runner.run('b', '')
    expect(workers).toHaveLength(2)
  })
})

describe('a worker that cannot be created', () => {
  it('rejects warmUp with the creation error, and tries again on the next call', async () => {
    const workers: FakeWorker[] = []
    let failing = true
    const runner = createPythonRunner(() => {
      if (failing) throw new Error('Workers are not supported')
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    })

    await expect(runner.warmUp()).rejects.toThrow('Workers are not supported')

    failing = false
    const retry = runner.warmUp()
    workers[0].emit({ type: 'ready' })
    await expect(retry).resolves.toBeUndefined()
  })

  it('resolves run as unavailable and is not busy afterwards', async () => {
    const runner = createPythonRunner(() => {
      throw new Error('Workers are not supported')
    })

    await expect(runner.run('a', '')).resolves.toEqual({
      status: 'unavailable',
      message: 'Workers are not supported',
    })
    await expect(runner.run('b', '')).resolves.toMatchObject({ status: 'unavailable' })
  })
})

describe('time limit', () => {
  it('does not start the timer before the worker is ready', async () => {
    const { runner, workers } = setup()
    let result: unknown
    void runner.run('a', '').then((r) => {
      result = r
    })

    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS * 5)
    expect(result).toBeUndefined()
    expect(workers[0].terminated).toBe(false)

    workers[0].emit({ type: 'ready' })
    await flush()
    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS - 1)
    expect(result).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(result).toEqual({ status: 'timeout' })
  })

  it('terminates the worker at RUN_TIMEOUT_MS and resolves timeout', async () => {
    const { runner, workers } = setup()
    const promise = runner.run('while True: pass', '')
    workers[0].emit({ type: 'ready' })
    await flush()

    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS)

    await expect(promise).resolves.toEqual({ status: 'timeout' })
    expect(workers[0].terminated).toBe(true)
  })

  it('creates a new worker lazily for the next run, and ignores the old worker', async () => {
    const { runner, workers, factory } = setup()
    const timedOut = runner.run('while True: pass', '')
    workers[0].emit({ type: 'ready' })
    await flush()
    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS)
    await timedOut
    expect(factory).toHaveBeenCalledTimes(1)

    const next = runner.run('print(1)', '')
    expect(factory).toHaveBeenCalledTimes(2)
    expect(workers[1].posted).toEqual([{ type: 'init' }])

    // A late message from the terminated worker must not touch the new run.
    workers[0].emit({ type: 'ready' })
    workers[0].emit({ type: 'result', runId: 'run-1', outcome: { status: 'ok', stdout: 'stale\n' } })
    workers[1].emit({ type: 'ready' })
    await flush()
    workers[1].emit({ type: 'result', runId: workers[1].runMessages[0].runId, outcome: OK })

    await expect(next).resolves.toEqual(OK)
    expect(workers[1].terminated).toBe(false)
  })

  it('does not time out a run that finishes just before the limit', async () => {
    const { runner, workers } = setup()
    const promise = runner.run('a', '')
    workers[0].emit({ type: 'ready' })
    await flush()

    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS - 1)
    workers[0].emit({ type: 'result', runId: workers[0].runMessages[0].runId, outcome: OK })
    await expect(promise).resolves.toEqual(OK)

    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS * 2)
    expect(workers[0].terminated).toBe(false)
  })

  it('starts a fresh timer for every run', async () => {
    const { runner, workers } = setup()
    const first = runner.run('a', '')
    workers[0].emit({ type: 'ready' })
    await flush()
    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS - 1)
    workers[0].emit({ type: 'result', runId: workers[0].runMessages[0].runId, outcome: OK })
    await first

    let result: unknown
    void runner.run('b', '').then((r) => {
      result = r
    })
    await flush()
    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS - 1)
    expect(result).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(result).toEqual({ status: 'timeout' })
  })
})

describe('dispose', () => {
  it('terminates the worker', async () => {
    const { runner, workers } = setup()
    const ready = runner.warmUp()
    workers[0].emit({ type: 'ready' })
    await ready

    runner.dispose()

    expect(workers[0].terminated).toBe(true)
  })

  it('does nothing when no worker exists', () => {
    const { runner, factory } = setup()

    expect(() => runner.dispose()).not.toThrow()
    expect(factory).not.toHaveBeenCalled()
  })

  it('resolves a pending run as unavailable and clears its timer', async () => {
    const { runner, workers } = setup()
    const promise = runner.run('while True: pass', '')
    workers[0].emit({ type: 'ready' })
    await flush()

    runner.dispose()

    await expect(promise).resolves.toMatchObject({ status: 'unavailable' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resolves a run that is still waiting for ready as unavailable, without posting it', async () => {
    const { runner, workers } = setup()
    const promise = runner.run('a', '')

    runner.dispose()
    workers[0].emit({ type: 'ready' })
    await flush()

    await expect(promise).resolves.toMatchObject({ status: 'unavailable' })
    expect(workers[0].runMessages).toHaveLength(0)
  })

  it('lets the runner be used again afterwards with a new worker', async () => {
    const { runner, workers } = setup()
    runner.dispose()
    const ready = runner.warmUp()
    workers[0].emit({ type: 'ready' })
    await ready
    runner.dispose()

    const promise = runner.run('a', '')
    expect(workers).toHaveLength(2)
    workers[1].emit({ type: 'ready' })
    await flush()
    workers[1].emit({ type: 'result', runId: workers[1].runMessages[0].runId, outcome: OK })

    await expect(promise).resolves.toEqual(OK)
  })
})
