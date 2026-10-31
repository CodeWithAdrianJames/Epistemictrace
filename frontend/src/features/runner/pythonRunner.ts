import { RUN_TIMEOUT_MS } from './runnerConfig.ts'
import type { MainToWorker, RunOutcome, WorkerToMain } from './runnerProtocol.ts'

export type ExecutionResult =
  | RunOutcome
  | { status: 'timeout' }
  | { status: 'unavailable'; message: string }

// The part of `Worker` the runner uses, so tests can pass a fake.
export interface WorkerLike {
  postMessage(message: MainToWorker): void
  terminate(): void
  onmessage: ((event: MessageEvent<WorkerToMain>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface PythonRunner {
  warmUp(): Promise<void>
  run(code: string, stdin: string): Promise<ExecutionResult>
  dispose(): void
}

interface ActiveRun {
  runId: string
  resolve: (result: ExecutionResult) => void
  timer: ReturnType<typeof setTimeout> | null
}

// The URL expression must stay inline: Vite only bundles the worker for this exact form (R5).
function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'The Python runner is not available.'
}

export function createPythonRunner(createWorker: () => WorkerLike = defaultWorkerFactory): PythonRunner {
  let worker: WorkerLike | null = null
  let ready: Promise<void> | null = null
  let rejectReady: ((error: Error) => void) | null = null
  let active: ActiveRun | null = null
  let runCounter = 0

  function finish(entry: ActiveRun, result: ExecutionResult): void {
    if (active !== entry) return
    if (entry.timer !== null) clearTimeout(entry.timer)
    active = null
    entry.resolve(result)
  }

  // Drops the current worker. A later warmUp/run creates a new one.
  function discardWorker(reason: Error): void {
    const current = worker
    const reject = rejectReady
    worker = null
    ready = null
    rejectReady = null
    if (current) {
      current.onmessage = null
      current.onerror = null
      current.terminate()
    }
    // Rejects warmUp() callers that are still waiting for `ready`; a no-op once it resolved.
    reject?.(reason)
  }

  function warmUp(): Promise<void> {
    if (ready) return ready

    let created: WorkerLike
    try {
      created = createWorker()
    } catch (error) {
      // For example a browser without module workers: nothing to clean up, a later call tries again.
      return Promise.reject(error instanceof Error ? error : new Error(messageOf(error)))
    }
    let resolveReady: () => void = () => {}
    const pending = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    worker = created
    ready = pending

    created.onmessage = (event) => {
      if (worker !== created) return
      const message = event.data
      if (message.type === 'ready') {
        resolveReady()
      } else if (message.type === 'init-error') {
        discardWorker(new Error(message.message))
      } else if (active && active.runId === message.runId) {
        finish(active, message.outcome)
      }
    }
    created.onerror = (event) => {
      if (worker !== created) return
      const reason = new Error(event.message || 'The Python worker crashed.')
      const entry = active
      discardWorker(reason)
      if (entry) finish(entry, { status: 'unavailable', message: reason.message })
    }
    created.postMessage({ type: 'init' })
    return pending
  }

  function run(code: string, stdin: string): Promise<ExecutionResult> {
    if (active) return Promise.reject(new Error('busy'))

    return new Promise<ExecutionResult>((resolve) => {
      runCounter += 1
      const entry: ActiveRun = { runId: `run-${runCounter}`, resolve, timer: null }
      active = entry

      warmUp().then(
        () => {
          // The run was finished meanwhile (dispose), or its worker replaced.
          if (active !== entry || !worker) return
          const target = worker
          try {
            target.postMessage({ type: 'run', runId: entry.runId, code, stdin })
          } catch (error) {
            discardWorker(error instanceof Error ? error : new Error(messageOf(error)))
            finish(entry, { status: 'unavailable', message: messageOf(error) })
            return
          }
          // The limit counts from here: the worker is ready, so start-up time is excluded (Q7).
          entry.timer = setTimeout(() => {
            discardWorker(new Error('The run timed out.'))
            finish(entry, { status: 'timeout' })
          }, RUN_TIMEOUT_MS)
        },
        (error: unknown) => {
          finish(entry, { status: 'unavailable', message: messageOf(error) })
        },
      )
    })
  }

  function dispose(): void {
    const entry = active
    discardWorker(new Error('The Python runner was disposed.'))
    if (entry) finish(entry, { status: 'unavailable', message: 'The Python runner was disposed.' })
  }

  return { warmUp, run, dispose }
}
