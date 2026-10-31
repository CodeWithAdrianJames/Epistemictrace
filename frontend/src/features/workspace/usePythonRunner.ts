import { useEffect, useState } from 'react'
import { createPythonRunner, type PythonRunner } from '../runner/pythonRunner.ts'

export type RunnerStatus = 'warming' | 'ready' | 'failed'

// Spec 14 R5: one runner per page, warmed up on mount and disposed on unmount.
// The runner creates its worker lazily, so a strict-mode remount simply starts a new one;
// the cancelled warm-up's outcome is ignored.
export function usePythonRunner(): { runner: PythonRunner; status: RunnerStatus } {
  const [runner] = useState(() => createPythonRunner())
  const [status, setStatus] = useState<RunnerStatus>('warming')

  useEffect(() => {
    let active = true
    runner.warmUp().then(
      () => {
        if (active) setStatus('ready')
      },
      () => {
        if (active) setStatus('failed')
      },
    )
    return () => {
      active = false
      runner.dispose()
    }
  }, [runner])

  return { runner, status }
}
