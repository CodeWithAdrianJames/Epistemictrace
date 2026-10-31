import { useCallback, useEffect, useRef, useState } from 'react'
import type { TestCase } from '../../api/activitiesApi.ts'
import type { PythonRunner } from '../runner/pythonRunner.ts'
import { runTests, type RunReport } from '../runner/runTests.ts'

export type RunState = 'idle' | 'running'

export type ReportListener = (report: RunReport) => void

export interface RunTests {
  state: RunState
  lastReport: RunReport | null
  // Resolves with the report, or null when a run was already in progress or the runner rejected.
  run(): Promise<RunReport | null>
  // Spec 17 hook: called once per finished run, unavailable reports included. Returns an unsubscribe function.
  onReportReady(listener: ReportListener): () => void
}

// Spec 14 R6: runs the code as it was when run() was called; edits during a run apply to the next one.
// run and onReportReady keep their identity, so callers can use them in effects.
export function useRunTests(code: string, testCases: readonly TestCase[], runner: Pick<PythonRunner, 'run'>): RunTests {
  const [state, setState] = useState<RunState>('idle')
  const [lastReport, setLastReport] = useState<RunReport | null>(null)
  const inputsRef = useRef({ code, testCases, runner })
  const runningRef = useRef(false)
  const mountedRef = useRef(false)
  const listenersRef = useRef(new Set<ReportListener>())

  useEffect(() => {
    inputsRef.current = { code, testCases, runner }
  }, [code, testCases, runner])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(async (): Promise<RunReport | null> => {
    // A ref, not state: two clicks in the same frame must not start two runs.
    if (runningRef.current) return null
    runningRef.current = true
    setState('running')

    const { code: currentCode, testCases: currentTests, runner: currentRunner } = inputsRef.current
    let report: RunReport
    try {
      report = await runTests(currentCode, currentTests, currentRunner)
    } catch {
      // Only a runner bug ends here ('busy'); the button state must not stay stuck on Running….
      runningRef.current = false
      if (mountedRef.current) setState('idle')
      return null
    }
    runningRef.current = false

    // After unmount the runner was disposed, so this is an 'unavailable' report nobody shows.
    if (!mountedRef.current) return report
    setState('idle')
    setLastReport(report)
    for (const listener of [...listenersRef.current]) {
      listener(report)
    }
    return report
  }, [])

  const onReportReady = useCallback((listener: ReportListener) => {
    const listeners = listenersRef.current
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return { state, lastReport, run, onReportReady }
}
