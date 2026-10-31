import { describe, expect, it } from 'vitest'
import { errorSignature } from './errorSignature.ts'
import type { ExecutionResult } from './pythonRunner.ts'

function failure(type: string, line: number | null, message = 'boom'): ExecutionResult {
  return { status: 'error', stdout: '', error: { type, message, line } }
}

describe('errorSignature', () => {
  it('is <type>@<line> for an error', () => {
    expect(errorSignature(failure('ZeroDivisionError', 2))).toBe('ZeroDivisionError@2')
  })

  it('uses ? when the line is unknown', () => {
    expect(errorSignature(failure('MemoryError', null))).toBe('MemoryError@?')
  })

  it('keeps line 0 as a line', () => {
    expect(errorSignature(failure('SyntaxError', 0))).toBe('SyntaxError@0')
  })

  it('is the same for the same exception on the same line, whatever the message', () => {
    expect(errorSignature(failure('ValueError', 4, 'first'))).toBe(errorSignature(failure('ValueError', 4, 'second')))
  })

  it('differs for another line or another exception', () => {
    expect(errorSignature(failure('ValueError', 4))).not.toBe(errorSignature(failure('ValueError', 5)))
    expect(errorSignature(failure('ValueError', 4))).not.toBe(errorSignature(failure('TypeError', 4)))
  })

  it('is Timeout@? for a timeout', () => {
    expect(errorSignature({ status: 'timeout' })).toBe('Timeout@?')
  })

  it('is null for ok and unavailable', () => {
    expect(errorSignature({ status: 'ok', stdout: '1\n' })).toBeNull()
    expect(errorSignature({ status: 'unavailable', message: 'down' })).toBeNull()
  })

  it('truncates to 200 characters', () => {
    const signature = errorSignature(failure('E'.repeat(300), 3))
    expect(signature).toHaveLength(200)
    expect(signature).toBe('E'.repeat(200))
  })

  it('does not truncate a signature of exactly 200 characters', () => {
    const type = 'E'.repeat(196)
    expect(errorSignature(failure(type, 3))).toBe(`${type}@3`)
  })
})
