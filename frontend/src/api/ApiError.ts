export interface ApiErrorFields {
  status: number
  title: string
  detail: string
  fieldErrors: Record<string, string>
}

// Thrown by apiFetch for every non-2xx response and every network failure (status 0).
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail: string
  readonly fieldErrors: Record<string, string>

  constructor({ status, title, detail, fieldErrors }: ApiErrorFields) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
    this.fieldErrors = fieldErrors
  }
}
