import type { TestCase, TestCaseRequest } from '../../api/instructorActivitiesApi.ts'
import type { FieldErrors } from '../../auth/authForms.ts'

// The editable fields of a test case, exactly as typed into a row or the add form.
export interface TestCaseFormValues {
  input: string
  expectedOutput: string
  hidden: boolean
}

// The text fields; hidden is a checkbox, so the server never reports an error for it.
export type TestCaseField = 'input' | 'expectedOutput'

export const TEST_CASE_FIELDS: readonly TestCaseField[] = ['input', 'expectedOutput']

export const EMPTY_TEST_CASE: TestCaseFormValues = { input: '', expectedOutput: '', hidden: false }

// Spec 08 R2 limits (Q16), mirrored so most mistakes are caught before a request.
const INPUT_MAX = 10_000
const EXPECTED_OUTPUT_MAX = 10_000
export const MAX_TEST_CASES = 50

// Same text as the server's TestCaseLimitException, so both checks read the same.
export const TEST_CASE_LIMIT_DETAIL = `An activity can have at most ${MAX_TEST_CASES} test cases.`

// String length counts UTF-16 code units, the same unit as the server's @Size.
export function validateTestCase(values: TestCaseFormValues): FieldErrors<TestCaseField> {
  const errors: FieldErrors<TestCaseField> = {}

  if (values.input.length > INPUT_MAX) {
    errors.input = `Input must be ${formatLimit(INPUT_MAX)} characters or fewer.`
  }

  // @NotBlank: output comparison strips trailing whitespace, so a blank value would match a program that prints nothing.
  if (values.expectedOutput.trim() === '') {
    errors.expectedOutput = 'Enter the expected output.'
  } else if (values.expectedOutput.length > EXPECTED_OUTPUT_MAX) {
    errors.expectedOutput = `Expected output must be ${formatLimit(EXPECTED_OUTPUT_MAX)} characters or fewer.`
  }

  return errors
}

// Spaces and line breaks are part of a program's input and output, so nothing is trimmed.
export function toTestCaseRequest(values: TestCaseFormValues): TestCaseRequest {
  return { input: values.input, expectedOutput: values.expectedOutput, hidden: values.hidden }
}

export function testCaseValuesFrom(testCase: TestCase): TestCaseFormValues {
  return { input: testCase.input, expectedOutput: testCase.expectedOutput, hidden: testCase.hidden }
}

export function isTestCaseChanged(values: TestCaseFormValues, saved: TestCaseFormValues): boolean {
  return (
    values.input !== saved.input || values.expectedOutput !== saved.expectedOutput || values.hidden !== saved.hidden
  )
}

function formatLimit(limit: number): string {
  return limit.toLocaleString('en-US')
}
