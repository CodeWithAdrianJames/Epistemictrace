import { describe, expect, it } from 'vitest'
import packageJson from '../../../package.json?raw'
import { PYODIDE_INDEX_URL, PYODIDE_VERSION, RUN_TIMEOUT_MS } from './runnerConfig.ts'

describe('runnerConfig', () => {
  it('sets the run time limit to 3 seconds (Q7)', () => {
    expect(RUN_TIMEOUT_MS).toBe(3000)
  })

  it('pins the same Pyodide version as package.json, without a range', () => {
    const pkg = JSON.parse(packageJson) as {
      dependencies: Record<string, string>
    }

    expect(pkg.dependencies.pyodide).toBe(PYODIDE_VERSION)
    expect(PYODIDE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('points the index URL at the official CDN folder for that version, ending in a slash', () => {
    expect(PYODIDE_INDEX_URL).toBe(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`)
  })
})
