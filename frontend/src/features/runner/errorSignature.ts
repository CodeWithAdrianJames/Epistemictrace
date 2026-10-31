import type { ExecutionResult } from './pythonRunner.ts'

const MAX_SIGNATURE_LENGTH = 200

// Q4: `<ExceptionType>@<line>` groups repeated errors; the message is left out on purpose.
export function errorSignature(result: ExecutionResult): string | null {
  if (result.status === 'timeout') return 'Timeout@?'
  if (result.status !== 'error') return null
  return `${result.error.type}@${result.error.line ?? '?'}`.slice(0, MAX_SIGNATURE_LENGTH)
}
