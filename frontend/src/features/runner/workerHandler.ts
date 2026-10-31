import type { ProgramRunner } from './pythonHarness.ts'
import type { MainToWorker, RunOutcome, WorkerToMain } from './runnerProtocol.ts'

interface WorkerHandlerDeps {
  loadRunner: () => Promise<ProgramRunner>
  post: (message: WorkerToMain) => void
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Pyodide could not be loaded.'
}

function internalError(message: string): RunOutcome {
  return { status: 'error', stdout: '', error: { type: 'InternalError', message, line: null } }
}

// The worker's message logic, separate from `self` so it can be tested without a real worker.
export function createWorkerHandler({ loadRunner, post }: WorkerHandlerDeps) {
  let runner: Promise<ProgramRunner> | null = null

  async function init(): Promise<void> {
    // Pyodide loads once; a failed load is forgotten so a later `init` can try again.
    runner ??= loadRunner()
    try {
      await runner
      post({ type: 'ready' })
    } catch (error) {
      runner = null
      post({ type: 'init-error', message: messageOf(error) })
    }
  }

  async function run(runId: string, code: string, stdin: string): Promise<void> {
    let outcome: RunOutcome
    try {
      if (!runner) throw new Error('The Python runner was not initialised.')
      outcome = (await runner)(code, stdin)
    } catch (error) {
      outcome = internalError(error instanceof Error ? error.message : 'The program could not be run.')
    }
    post({ type: 'result', runId, outcome })
  }

  return async function handle(message: MainToWorker): Promise<void> {
    if (message.type === 'init') await init()
    else await run(message.runId, message.code, message.stdin)
  }
}
