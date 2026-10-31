import { describe, expect, it } from 'vitest'
import type { TestCase } from '../../api/instructorActivitiesApi.ts'
import {
  EMPTY_TEST_CASE,
  MAX_TEST_CASES,
  TEST_CASE_FIELDS,
  TEST_CASE_LIMIT_DETAIL,
  isTestCaseChanged,
  testCaseValuesFrom,
  toTestCaseRequest,
  validateTestCase,
  type TestCaseFormValues,
} from './testCaseForm.ts'

const VALID: TestCaseFormValues = { input: '1 2\n', expectedOutput: '3\n', hidden: false }

const TEST_CASE: TestCase = { id: 11, position: 2, input: '1 2\n', expectedOutput: '3\n', hidden: true }

describe('validateTestCase', () => {
  it('accepts valid values, including an empty input', () => {
    expect(validateTestCase(VALID)).toEqual({})
    expect(validateTestCase({ ...VALID, input: '' })).toEqual({})
  })

  it('asks for an expected output when it is empty or only whitespace', () => {
    expect(validateTestCase({ ...VALID, expectedOutput: '' })).toEqual({ expectedOutput: 'Enter the expected output.' })
    expect(validateTestCase({ ...VALID, expectedOutput: ' \n\t ' })).toEqual({
      expectedOutput: 'Enter the expected output.',
    })
  })

  it('limits the input to 10,000 characters', () => {
    expect(validateTestCase({ ...VALID, input: 'a'.repeat(10_000) })).toEqual({})
    expect(validateTestCase({ ...VALID, input: 'a'.repeat(10_001) })).toEqual({
      input: 'Input must be 10,000 characters or fewer.',
    })
  })

  it('limits the expected output to 10,000 characters', () => {
    expect(validateTestCase({ ...VALID, expectedOutput: 'a'.repeat(10_000) })).toEqual({})
    expect(validateTestCase({ ...VALID, expectedOutput: 'a'.repeat(10_001) })).toEqual({
      expectedOutput: 'Expected output must be 10,000 characters or fewer.',
    })
  })

  it('counts UTF-16 code units, like the server', () => {
    // Each emoji is two UTF-16 code units.
    expect(validateTestCase({ ...VALID, input: '😀'.repeat(5_000) })).toEqual({})
    expect(validateTestCase({ ...VALID, input: `${'😀'.repeat(5_000)}a` })).toEqual({
      input: 'Input must be 10,000 characters or fewer.',
    })
  })

  it('reports both fields at once', () => {
    expect(validateTestCase({ input: 'a'.repeat(10_001), expectedOutput: '', hidden: true })).toEqual({
      input: 'Input must be 10,000 characters or fewer.',
      expectedOutput: 'Enter the expected output.',
    })
  })
})

describe('toTestCaseRequest', () => {
  it('sends input and expected output exactly as typed', () => {
    expect(toTestCaseRequest({ input: '  1 2 \n\n', expectedOutput: ' 3 \n', hidden: true })).toEqual({
      input: '  1 2 \n\n',
      expectedOutput: ' 3 \n',
      hidden: true,
    })
  })
})

describe('testCaseValuesFrom', () => {
  it('takes the editable fields of a test case', () => {
    expect(testCaseValuesFrom(TEST_CASE)).toEqual({ input: '1 2\n', expectedOutput: '3\n', hidden: true })
  })
})

describe('isTestCaseChanged', () => {
  const saved = testCaseValuesFrom(TEST_CASE)

  it('is false for the saved values', () => {
    expect(isTestCaseChanged({ ...saved }, saved)).toBe(false)
  })

  it.each([
    ['input', { input: '1 3\n' }],
    ['expectedOutput', { expectedOutput: '4\n' }],
    ['hidden', { hidden: false }],
  ] as const)('is true when %s differs', (_field, change) => {
    expect(isTestCaseChanged({ ...saved, ...change }, saved)).toBe(true)
  })
})

describe('constants', () => {
  it('starts a new test case empty and visible', () => {
    expect(EMPTY_TEST_CASE).toEqual({ input: '', expectedOutput: '', hidden: false })
  })

  it('lists the fields the server can report errors for', () => {
    expect(TEST_CASE_FIELDS).toEqual(['input', 'expectedOutput'])
  })

  it('mirrors the 50 test case limit with the server message', () => {
    expect(MAX_TEST_CASES).toBe(50)
    expect(TEST_CASE_LIMIT_DETAIL).toBe('An activity can have at most 50 test cases.')
  })
})
