import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPythonRunner, type PythonRunner } from '../runner/pythonRunner.ts'
import { usePythonRunner } from './usePythonRunner.ts'

// The real runner starts a Web Worker, which jsdom does not have.
vi.mock('../runner/pythonRunner.ts', () => ({
  createPythonRunner: vi.fn(),
}))

const createRunnerMock = vi.mocked(createPythonRunner)

function fakeRunner() {
  const warmUps: { resolve: () => void; reject: (error: Error) => void }[] = []
  const runner = {
    warmUp: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          warmUps.push({ resolve, reject })
        }),
    ),
    run: vi.fn<PythonRunner['run']>(),
    dispose: vi.fn<PythonRunner['dispose']>(),
  }
  createRunnerMock.mockReturnValue(runner)
  return { runner, warmUps }
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('usePythonRunner', () => {
  it('creates one runner and warms it up on mount', () => {
    const { runner } = fakeRunner()
    const { result, rerender } = renderHook(() => usePythonRunner())
    rerender()

    expect(createRunnerMock).toHaveBeenCalledTimes(1)
    expect(result.current.runner).toBe(runner)
    expect(runner.warmUp).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('warming')
  })

  it('is ready once warm-up finishes', async () => {
    const { warmUps } = fakeRunner()
    const { result } = renderHook(() => usePythonRunner())

    await act(async () => warmUps[0].resolve())

    expect(result.current.status).toBe('ready')
  })

  it('has failed when warm-up fails', async () => {
    const { warmUps } = fakeRunner()
    const { result } = renderHook(() => usePythonRunner())

    await act(async () => warmUps[0].reject(new Error('CDN unreachable')))

    expect(result.current.status).toBe('failed')
  })

  it('disposes the runner on unmount', () => {
    const { runner } = fakeRunner()
    const { unmount } = renderHook(() => usePythonRunner())
    expect(runner.dispose).not.toHaveBeenCalled()

    unmount()

    expect(runner.dispose).toHaveBeenCalledTimes(1)
  })

  it('ignores the warm-up a strict-mode remount cancelled, and uses the second one', async () => {
    const { runner, warmUps } = fakeRunner()
    const { result } = renderHook(() => usePythonRunner(), { wrapper: StrictMode })

    expect(runner.warmUp).toHaveBeenCalledTimes(2)
    expect(runner.dispose).toHaveBeenCalledTimes(1)
    await act(async () => warmUps[0].reject(new Error('The Python runner was disposed.')))
    expect(result.current.status).toBe('warming')

    await act(async () => warmUps[1].resolve())
    expect(result.current.status).toBe('ready')
  })

  it('does not update after unmount when warm-up settles late', async () => {
    const { warmUps } = fakeRunner()
    const { result, unmount } = renderHook(() => usePythonRunner())
    unmount()

    await act(async () => warmUps[0].resolve())

    expect(result.current.status).toBe('warming')
  })
})
