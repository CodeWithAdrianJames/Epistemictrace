import { loadPyodide } from 'pyodide'
import { createProgramRunner } from './pythonHarness.ts'
import { PYODIDE_INDEX_URL } from './runnerConfig.ts'
import type { MainToWorker, WorkerToMain } from './runnerProtocol.ts'
import { createWorkerHandler } from './workerHandler.ts'

// tsconfig has the DOM lib, where `self` is a Window; this is the part of a worker scope used here.
interface WorkerScope {
  postMessage(message: WorkerToMain): void
  addEventListener(type: 'message', listener: (event: MessageEvent<MainToWorker>) => void): void
}

const scope = self as unknown as WorkerScope

const handle = createWorkerHandler({
  loadRunner: async () => createProgramRunner(await loadPyodide({ indexURL: PYODIDE_INDEX_URL })),
  post: (message) => scope.postMessage(message),
})

scope.addEventListener('message', (event) => {
  void handle(event.data)
})
