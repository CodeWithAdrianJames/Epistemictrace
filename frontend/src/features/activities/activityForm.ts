import type { ActivityDetail, ActivityRequest } from '../../api/instructorActivitiesApi.ts'
import type { FieldErrors } from '../../auth/authForms.ts'

// The editable fields of an activity, exactly as typed into the form.
export interface ActivityFormValues {
  title: string
  problemStatement: string
  starterCode: string
}

export type ActivityField = keyof ActivityFormValues

// Every field is sent, so the server may report an error for any of them.
export const ACTIVITY_FIELDS: readonly ActivityField[] = ['title', 'problemStatement', 'starterCode']

export const EMPTY_ACTIVITY: ActivityFormValues = { title: '', problemStatement: '', starterCode: '' }

// Spec 08 R2 limits (Q16), mirrored so most mistakes are caught before a request.
const TITLE_MAX = 120
const PROBLEM_STATEMENT_MAX = 20_000
const STARTER_CODE_MAX = 20_000

// String length counts UTF-16 code units, the same unit as the server's @Size.
export function validateActivity(values: ActivityFormValues): FieldErrors<ActivityField> {
  const errors: FieldErrors<ActivityField> = {}

  // The server trims the title before its @NotBlank and @Size checks.
  const title = values.title.trim()
  if (title === '') {
    errors.title = 'Enter a title.'
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title must be ${formatLimit(TITLE_MAX)} characters or fewer.`
  }

  // @NotBlank: a statement of only spaces and line breaks is rejected, but it is never trimmed.
  if (values.problemStatement.trim() === '') {
    errors.problemStatement = 'Enter a problem statement.'
  } else if (values.problemStatement.length > PROBLEM_STATEMENT_MAX) {
    errors.problemStatement = `Problem statement must be ${formatLimit(PROBLEM_STATEMENT_MAX)} characters or fewer.`
  }

  if (values.starterCode.length > STARTER_CODE_MAX) {
    errors.starterCode = `Starter code must be ${formatLimit(STARTER_CODE_MAX)} characters or fewer.`
  }

  return errors
}

// Leading spaces and blank lines matter in a problem statement and in code, so only the title is trimmed.
export function toActivityRequest(values: ActivityFormValues): ActivityRequest {
  return { title: values.title.trim(), problemStatement: values.problemStatement, starterCode: values.starterCode }
}

export function valuesFrom(activity: ActivityDetail): ActivityFormValues {
  return { title: activity.title, problemStatement: activity.problemStatement, starterCode: activity.starterCode }
}

export function isChanged(values: ActivityFormValues, saved: ActivityFormValues): boolean {
  return ACTIVITY_FIELDS.some((field) => values[field] !== saved[field])
}

function formatLimit(limit: number): string {
  return limit.toLocaleString('en-US')
}
