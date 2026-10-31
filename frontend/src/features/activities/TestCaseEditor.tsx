import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/ApiError.ts'
import {
  addTestCase,
  deleteTestCase,
  listTestCases,
  updateTestCase,
  type TestCase,
} from '../../api/instructorActivitiesApi.ts'
import { formErrorsFrom, hasErrors, type FieldErrors } from '../../auth/authForms.ts'
import { useProtectedRequest } from '../../auth/useProtectedRequest.ts'
import formStyles from './ActivityForm.module.css'
import pageStyles from './ActivityPage.module.css'
import Field from './Field.tsx'
import styles from './TestCaseEditor.module.css'
import {
  EMPTY_TEST_CASE,
  MAX_TEST_CASES,
  TEST_CASE_FIELDS,
  TEST_CASE_LIMIT_DETAIL,
  isTestCaseChanged,
  testCaseValuesFrom,
  toTestCaseRequest,
  validateTestCase,
  type TestCaseField,
  type TestCaseFormValues,
} from './testCaseForm.ts'

const FALLBACK_DETAIL = 'Something went wrong. Please try again.'

// Applied to the latest list, so two requests that finish close together cannot undo each other.
export type TestCasesUpdate = (current: TestCase[]) => TestCase[]

interface TestCaseEditorProps {
  activityId: number
  testCases: TestCase[]
  onTestCasesChange: (update: TestCasesUpdate) => void
}

// Spec 09 R4: the test cases section of the edit page. Errors without a field land at its top (R6),
// and every list change comes from a server response (R7).
function TestCaseEditor({ activityId, testCases, onTestCasesChange }: TestCaseEditorProps) {
  const headingId = useId()
  const [sectionError, setSectionError] = useState<string | null>(null)
  const ordered = [...testCases].sort((a, b) => a.position - b.position)

  return (
    <section aria-labelledby={headingId} className={pageStyles.panel}>
      <h2 id={headingId} className={pageStyles.sectionHeading}>
        Test cases
      </h2>
      {sectionError && (
        <p role="alert" className={pageStyles.pageError}>
          {sectionError}
        </p>
      )}
      {ordered.length === 0 ? (
        <p className={pageStyles.message}>No test cases yet.</p>
      ) : (
        <ol className={styles.list}>
          {ordered.map((testCase) => (
            <li key={testCase.id} className={styles.item}>
              <TestCaseRow
                activityId={activityId}
                testCase={testCase}
                onSectionError={setSectionError}
                onTestCasesChange={onTestCasesChange}
              />
            </li>
          ))}
        </ol>
      )}
      <NewTestCaseForm
        activityId={activityId}
        count={testCases.length}
        onSectionError={setSectionError}
        onTestCasesChange={onTestCasesChange}
      />
    </section>
  )
}

interface TestCaseRowProps {
  activityId: number
  testCase: TestCase
  onSectionError: (message: string | null) => void
  onTestCasesChange: (update: TestCasesUpdate) => void
}

// One saved test case with Save (enabled only when something changed) and Delete (after confirm()).
function TestCaseRow({ activityId, testCase, onSectionError, onTestCasesChange }: TestCaseRowProps) {
  const request = useProtectedRequest()
  const headingId = useId()
  const [values, setValues] = useState<TestCaseFormValues>(() => testCaseValuesFrom(testCase))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TestCaseField>>({})
  const [pending, setPending] = useState<'save' | 'delete' | null>(null)

  const name = `Test ${testCase.position}`
  const changed = isTestCaseChanged(values, testCaseValuesFrom(testCase))

  async function save(form: TestCaseFormValues) {
    setPending('save')
    try {
      const updated = await request((token) =>
        updateTestCase(token, activityId, testCase.id, toTestCaseRequest(form)),
      )
      setValues(testCaseValuesFrom(updated))
      setPending(null)
      onTestCasesChange((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error: unknown) {
      // useProtectedRequest has already logged out and left the page.
      if (isUnauthorized(error)) {
        return
      }
      setPending(null)
      const mapped = formErrorsFrom(error, TEST_CASE_FIELDS)
      setFieldErrors(mapped.fieldErrors)
      onSectionError(mapped.formError)
    }
  }

  async function remove() {
    setPending('delete')
    try {
      await request((token) => deleteTestCase(token, activityId, testCase.id))
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        return
      }
      setPending(null)
      onSectionError(detailOf(error))
      return
    }
    // The server renumbers the remaining positions, so the list is read back instead of guessed.
    try {
      const remaining = await request((token) => listTestCases(token, activityId))
      onTestCasesChange(() => remaining)
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        return
      }
      // The 204 confirmed the delete, so only this row goes; the others keep their last known positions.
      onTestCasesChange((current) => current.filter((item) => item.id !== testCase.id))
      onSectionError(detailOf(error))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null || !changed) {
      return
    }
    const errors = validateTestCase(values)
    setFieldErrors(errors)
    onSectionError(null)
    if (hasErrors(errors)) {
      return
    }
    void save(values)
  }

  function handleDelete() {
    if (pending !== null || !window.confirm(`Delete ${name}? This can't be undone.`)) {
      return
    }
    onSectionError(null)
    void remove()
  }

  return (
    <form aria-labelledby={headingId} className={styles.testCase} noValidate onSubmit={handleSubmit}>
      <h3 id={headingId} className={styles.testCaseHeading}>
        {name}
      </h3>
      <TestCaseFields values={values} fieldErrors={fieldErrors} onChange={setValues} />
      <div className={styles.actions}>
        <button
          type="submit"
          aria-label={`Save ${name}`}
          className={formStyles.submit}
          disabled={pending !== null || !changed}
        >
          Save
        </button>
        <button
          type="button"
          aria-label={`Delete ${name}`}
          className={styles.secondary}
          disabled={pending !== null}
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </form>
  )
}

interface NewTestCaseFormProps {
  activityId: number
  count: number
  onSectionError: (message: string | null) => void
  onTestCasesChange: (update: TestCasesUpdate) => void
}

// The Add test case form below the list; it empties itself after the server has stored the test case.
function NewTestCaseForm({ activityId, count, onSectionError, onTestCasesChange }: NewTestCaseFormProps) {
  const request = useProtectedRequest()
  const headingId = useId()
  const [values, setValues] = useState<TestCaseFormValues>(EMPTY_TEST_CASE)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TestCaseField>>({})
  const [submitting, setSubmitting] = useState(false)

  async function add(form: TestCaseFormValues) {
    setSubmitting(true)
    try {
      const created = await request((token) => addTestCase(token, activityId, toTestCaseRequest(form)))
      setValues(EMPTY_TEST_CASE)
      setSubmitting(false)
      onTestCasesChange((current) => [...current.filter((item) => item.id !== created.id), created])
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        return
      }
      setSubmitting(false)
      // The server's limit error is keyed "testCases", not a form field, so its detail goes to the section top.
      const mapped = formErrorsFrom(error, TEST_CASE_FIELDS)
      setFieldErrors(mapped.fieldErrors)
      onSectionError(mapped.formError)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    if (count >= MAX_TEST_CASES) {
      setFieldErrors({})
      onSectionError(TEST_CASE_LIMIT_DETAIL)
      return
    }
    const errors = validateTestCase(values)
    setFieldErrors(errors)
    onSectionError(null)
    if (hasErrors(errors)) {
      return
    }
    void add(values)
  }

  return (
    <form
      aria-labelledby={headingId}
      className={`${styles.testCase} ${styles.newTestCase}`}
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 id={headingId} className={styles.testCaseHeading}>
        New test case
      </h3>
      <TestCaseFields values={values} fieldErrors={fieldErrors} onChange={setValues} />
      <div className={styles.actions}>
        <button type="submit" className={formStyles.submit} disabled={submitting}>
          Add test case
        </button>
      </div>
    </form>
  )
}

interface TestCaseFieldsProps {
  values: TestCaseFormValues
  fieldErrors: FieldErrors<TestCaseField>
  onChange: (values: TestCaseFormValues) => void
}

// Input and expected output are program text, so both are mono textareas that keep spaces and line breaks.
function TestCaseFields({ values, fieldErrors, onChange }: TestCaseFieldsProps) {
  return (
    <>
      <Field label="Input" error={fieldErrors.input}>
        {(props) => (
          <textarea
            {...props}
            name="input"
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            value={values.input}
            className={`${formStyles.input} ${formStyles.code}`}
            onChange={(event) => {
              onChange({ ...values, input: event.target.value })
            }}
          />
        )}
      </Field>
      <Field label="Expected output" error={fieldErrors.expectedOutput}>
        {(props) => (
          <textarea
            {...props}
            name="expectedOutput"
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            value={values.expectedOutput}
            className={`${formStyles.input} ${formStyles.code}`}
            onChange={(event) => {
              onChange({ ...values, expectedOutput: event.target.value })
            }}
          />
        )}
      </Field>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          name="hidden"
          checked={values.hidden}
          onChange={(event) => {
            onChange({ ...values, hidden: event.target.checked })
          }}
        />
        Hidden
      </label>
    </>
  )
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

function detailOf(error: unknown): string {
  return error instanceof ApiError ? error.detail : FALLBACK_DETAIL
}

export default TestCaseEditor
