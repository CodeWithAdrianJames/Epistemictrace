// Q7: time limit for one program run, excluding interpreter start-up.
export const RUN_TIMEOUT_MS = 3000

// Q14: one pinned Pyodide version. It must equal the `pyodide` entry in package.json:
// the npm package checks at load time that the core it fetches from the CDN has the same version.
export const PYODIDE_VERSION = '314.0.7'

export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`
