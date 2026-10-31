export interface PythonError {
  type: string
  message: string
  line: number | null
}

export type RunOutcome =
  | { status: 'ok'; stdout: string }
  | { status: 'error'; stdout: string; error: PythonError }

export type MainToWorker =
  | { type: 'init' }
  | { type: 'run'; runId: string; code: string; stdin: string }

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; runId: string; outcome: RunOutcome }
