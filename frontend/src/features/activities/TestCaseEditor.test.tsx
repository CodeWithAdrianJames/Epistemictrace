import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import {
  addTestCase,
  deleteTestCase,
  listTestCases,
  updateTestCase,
  type TestCase,
} from '../../api/instructorActivitiesApi.ts'
import RequireRole from '../../app/RequireRole.tsx'
import { AuthProvider } from '../../auth/AuthProvider.tsx'
import { getToken, setToken } from '../../auth/tokenStore.ts'
import formStyles from './ActivityForm.module.css'
import TestCaseEditor from './TestCaseEditor.tsx'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/instructorActivitiesApi.ts', () => ({
  addTestCase: vi.fn(),
  updateTestCase: vi.fn(),
  deleteTestCase: vi.fn(),
  listTestCases: vi.fn(),
}))

const meMock = vi.mocked(me)
const addTestCaseMock = vi.mocked(addTestCase)
const updateTestCaseMock = vi.mocked(updateTestCase)
const deleteTestCaseMock = vi.mocked(deleteTestCase)
const listTestCasesMock = vi.mocked(listTestCases)

const FUTURE = '2099-01-01T00:00:00Z'
const TOKEN = 'token-1'
const ACTIVITY_ID = 5

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

const FIRST: TestCase = { id: 11, position: 1, input: '1 2\n', expectedOutput: '3\n', hidden: false }
const SECOND: TestCase = { id: 12, position: 2, input: '', expectedOutput: '0\n', hidden: true }

function apiError(status: number, detail: string, fieldErrors: Record<string, string> = {}): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors })
}

// Holds the list like the edit page does, so every update from the editor is rendered back (R7).
function Harness({ initial }: { initial: TestCase[] }) {
  const [testCases, setTestCases] = useState(initial)
  return <TestCaseEditor activityId={ACTIVITY_ID} testCases={testCases} onTestCasesChange={setTestCases} />
}

function renderEditor(initial: TestCase[] = [FIRST, SECOND]) {
  setToken(TOKEN, FUTURE)
  meMock.mockResolvedValue(INSTRUCTOR)
  const router = createMemoryRouter(
    [
      {
        path: '/instructor/activities/:activityId',
        element: (
          <RequireRole role="INSTRUCTOR">
            <Harness initial={initial} />
          </RequireRole>
        ),
      },
      { path: '/login', element: <h1>Log in page</h1> },
    ],
    { initialEntries: [`/instructor/activities/${ACTIVITY_ID}`] },
  )
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { router, ...view }
}

async function findSection(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Test cases' })
}

function row(name: string): HTMLElement {
  return screen.getByRole('form', { name })
}

function addForm(): HTMLElement {
  return screen.getByRole('form', { name: 'New test case' })
}

function textbox(container: HTMLElement, label: string): HTMLElement {
  return within(container).getByRole('textbox', { name: label })
}

function hiddenBox(container: HTMLElement): HTMLElement {
  return within(container).getByRole('checkbox', { name: 'Hidden' })
}

function button(container: HTMLElement, name: string): HTMLElement {
  return within(container).getByRole('button', { name })
}

function type(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

function confirmWith(answer: boolean) {
  return vi.spyOn(window, 'confirm').mockReturnValue(answer)
}

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('TestCaseEditor', () => {
  describe('list', () => {
    it('shows one row per test case in position order', async () => {
      renderEditor()

      const section = await findSection()
      const rows = within(section).getAllByRole('listitem')
      expect(rows).toHaveLength(2)
      expect(within(rows[0]).getByRole('heading', { name: 'Test 1' })).toBeInTheDocument()
      expect(within(rows[1]).getByRole('heading', { name: 'Test 2' })).toBeInTheDocument()
    })

    it('orders the rows by position even when the list arrives out of order', async () => {
      renderEditor([SECOND, FIRST])

      const section = await findSection()
      const rows = within(section).getAllByRole('listitem')
      expect(within(rows[0]).getByRole('heading', { name: 'Test 1' })).toBeInTheDocument()
      expect(textbox(rows[0], 'Expected output')).toHaveValue('3\n')
      expect(within(rows[1]).getByRole('heading', { name: 'Test 2' })).toBeInTheDocument()
    })

    it('shows the input, expected output, Hidden checkbox, Save and Delete of each test case', async () => {
      renderEditor()

      await findSection()
      const first = row('Test 1')
      expect(textbox(first, 'Input')).toHaveValue('1 2\n')
      expect(textbox(first, 'Expected output')).toHaveValue('3\n')
      expect(hiddenBox(first)).not.toBeChecked()
      expect(button(first, 'Save Test 1')).toHaveTextContent('Save')
      expect(button(first, 'Delete Test 1')).toHaveTextContent('Delete')

      const second = row('Test 2')
      expect(textbox(second, 'Input')).toHaveValue('')
      expect(textbox(second, 'Expected output')).toHaveValue('0\n')
      expect(hiddenBox(second)).toBeChecked()
    })

    it('uses mono textareas for input and expected output', async () => {
      renderEditor()

      await findSection()
      for (const container of [row('Test 1'), addForm()]) {
        for (const label of ['Input', 'Expected output']) {
          expect(textbox(container, label).tagName).toBe('TEXTAREA')
          expect(textbox(container, label)).toHaveClass(formStyles.code)
        }
      }
    })

    it('shows an empty message and the add form when there are no test cases', async () => {
      renderEditor([])

      const section = await findSection()
      expect(within(section).getByText('No test cases yet.')).toBeInTheDocument()
      expect(within(section).queryByRole('listitem')).not.toBeInTheDocument()
      expect(addForm()).toBeInTheDocument()
    })

    it('places the add form below the list', async () => {
      renderEditor()

      const section = await findSection()
      const list = within(section).getByRole('list')
      expect(list.compareDocumentPosition(addForm()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('save', () => {
    it('enables Save only while the row differs from the saved test case', async () => {
      renderEditor()

      await findSection()
      const first = row('Test 1')
      expect(button(first, 'Save Test 1')).toBeDisabled()

      type(textbox(first, 'Input'), '2 2\n')
      expect(button(first, 'Save Test 1')).toBeEnabled()
      type(textbox(first, 'Input'), '1 2\n')
      expect(button(first, 'Save Test 1')).toBeDisabled()

      type(textbox(first, 'Expected output'), '4\n')
      expect(button(first, 'Save Test 1')).toBeEnabled()
      type(textbox(first, 'Expected output'), '3\n')

      fireEvent.click(hiddenBox(first))
      expect(button(first, 'Save Test 1')).toBeEnabled()
      fireEvent.click(hiddenBox(first))
      expect(button(first, 'Save Test 1')).toBeDisabled()
    })

    it('sends the row as typed and then shows what the server returned', async () => {
      updateTestCaseMock.mockResolvedValue({ ...FIRST, input: ' 2 2 \n', expectedOutput: '4', hidden: true })
      renderEditor()

      await findSection()
      const first = row('Test 1')
      type(textbox(first, 'Input'), ' 2 2 \n')
      type(textbox(first, 'Expected output'), '4\n\n')
      fireEvent.click(hiddenBox(first))
      fireEvent.click(button(first, 'Save Test 1'))

      expect(updateTestCaseMock).toHaveBeenCalledExactlyOnceWith(TOKEN, ACTIVITY_ID, 11, {
        input: ' 2 2 \n',
        expectedOutput: '4\n\n',
        hidden: true,
      })
      // The response says '4', not the typed '4\n\n': the row shows the server's copy.
      expect(await within(first).findByDisplayValue('4')).toBe(textbox(first, 'Expected output'))
      expect(hiddenBox(first)).toBeChecked()
      expect(button(first, 'Save Test 1')).toBeDisabled()
    })

    it('leaves the other rows untouched', async () => {
      updateTestCaseMock.mockResolvedValue({ ...FIRST, expectedOutput: '4\n' })
      renderEditor()

      await findSection()
      type(textbox(row('Test 2'), 'Input'), 'unsaved')
      type(textbox(row('Test 1'), 'Expected output'), '4\n')
      fireEvent.click(button(row('Test 1'), 'Save Test 1'))

      await waitFor(() => expect(button(row('Test 1'), 'Save Test 1')).toBeDisabled())
      expect(updateTestCaseMock).toHaveBeenCalledTimes(1)
      expect(textbox(row('Test 1'), 'Expected output')).toHaveValue('4\n')
      expect(textbox(row('Test 2'), 'Input')).toHaveValue('unsaved')
      expect(button(row('Test 2'), 'Save Test 2')).toBeEnabled()
    })

    it('shows the client checks under the row fields and sends nothing', async () => {
      renderEditor()

      await findSection()
      const first = row('Test 1')
      type(textbox(first, 'Input'), 'a'.repeat(10_001))
      type(textbox(first, 'Expected output'), '  ')
      fireEvent.click(button(first, 'Save Test 1'))

      expect(textbox(first, 'Input')).toHaveAccessibleDescription('Input must be 10,000 characters or fewer.')
      expect(textbox(first, 'Input')).toHaveAttribute('aria-invalid', 'true')
      expect(textbox(first, 'Expected output')).toHaveAccessibleDescription('Enter the expected output.')
      expect(updateTestCaseMock).not.toHaveBeenCalled()
    })

    it('shows server field errors under the row fields and keeps the typed values', async () => {
      updateTestCaseMock.mockRejectedValue(
        apiError(400, 'Validation failed.', { expectedOutput: 'must not be blank', input: 'size must be at most 10000' }),
      )
      renderEditor()

      await findSection()
      const first = row('Test 1')
      type(textbox(first, 'Expected output'), '9\n')
      fireEvent.click(button(first, 'Save Test 1'))

      expect(await within(first).findByText('must not be blank')).toBeInTheDocument()
      expect(textbox(first, 'Expected output')).toHaveAccessibleDescription('must not be blank')
      expect(textbox(first, 'Input')).toHaveAccessibleDescription('size must be at most 10000')
      expect(textbox(first, 'Expected output')).toHaveValue('9\n')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(button(first, 'Save Test 1')).toBeEnabled()
    })

    it('shows a 409 detail at the top of the test cases section', async () => {
      updateTestCaseMock.mockRejectedValue(apiError(409, "Archived activities can't be changed."))
      renderEditor()

      const section = await findSection()
      type(textbox(row('Test 1'), 'Expected output'), '9\n')
      fireEvent.click(button(row('Test 1'), 'Save Test 1'))

      const alert = await within(section).findByRole('alert')
      expect(alert).toHaveTextContent("Archived activities can't be changed.")
      expect(section.firstElementChild?.nextElementSibling).toBe(alert)
      expect(textbox(row('Test 1'), 'Expected output')).toHaveValue('9\n')
    })

    it('shows a fixed message for an error that is not an ApiError', async () => {
      updateTestCaseMock.mockRejectedValue(new TypeError('boom'))
      renderEditor()

      const section = await findSection()
      type(textbox(row('Test 1'), 'Expected output'), '9\n')
      fireEvent.click(button(row('Test 1'), 'Save Test 1'))

      expect(await within(section).findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    })

    it('disables Save and Delete while the request runs and ignores a second submit', async () => {
      let resolve: (testCase: TestCase) => void = () => {}
      updateTestCaseMock.mockReturnValue(new Promise((done) => (resolve = done)))
      renderEditor()

      await findSection()
      const first = row('Test 1')
      type(textbox(first, 'Expected output'), '9\n')
      fireEvent.click(button(first, 'Save Test 1'))
      expect(button(first, 'Save Test 1')).toBeDisabled()
      expect(button(first, 'Delete Test 1')).toBeDisabled()
      fireEvent.submit(first)
      expect(updateTestCaseMock).toHaveBeenCalledTimes(1)

      resolve({ ...FIRST, expectedOutput: '9\n' })
      await waitFor(() => expect(button(first, 'Delete Test 1')).toBeEnabled())
      expect(textbox(first, 'Expected output')).toHaveValue('9\n')
      expect(button(first, 'Save Test 1')).toBeDisabled()
    })

    it('does not send an unchanged row', async () => {
      renderEditor()

      await findSection()
      fireEvent.submit(row('Test 1'))

      expect(updateTestCaseMock).not.toHaveBeenCalled()
    })

    it('sends the user to /login when the token is rejected', async () => {
      updateTestCaseMock.mockRejectedValue(apiError(401, 'Authentication required.'))
      const { router } = renderEditor()

      await findSection()
      type(textbox(row('Test 1'), 'Expected output'), '9\n')
      fireEvent.click(button(row('Test 1'), 'Save Test 1'))

      expect(await screen.findByRole('heading', { level: 1, name: 'Log in page' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(getToken()).toBeNull()
    })
  })

  describe('add', () => {
    it('adds a test case with the typed values and shows the returned row', async () => {
      addTestCaseMock.mockResolvedValue({ id: 13, position: 3, input: '', expectedOutput: '6\n', hidden: true })
      renderEditor()

      await findSection()
      const form = addForm()
      type(textbox(form, 'Expected output'), '6\n')
      fireEvent.click(hiddenBox(form))
      fireEvent.click(button(form, 'Add test case'))

      const added = await screen.findByRole('form', { name: 'Test 3' })
      expect(addTestCaseMock).toHaveBeenCalledExactlyOnceWith(TOKEN, ACTIVITY_ID, {
        input: '',
        expectedOutput: '6\n',
        hidden: true,
      })
      expect(textbox(added, 'Expected output')).toHaveValue('6\n')
      expect(hiddenBox(added)).toBeChecked()
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('empties the add form after a successful add', async () => {
      addTestCaseMock.mockResolvedValue({ id: 13, position: 3, input: '5\n', expectedOutput: '6\n', hidden: true })
      renderEditor()

      await findSection()
      const form = addForm()
      type(textbox(form, 'Input'), '5\n')
      type(textbox(form, 'Expected output'), '6\n')
      fireEvent.click(hiddenBox(form))
      fireEvent.click(button(form, 'Add test case'))

      await screen.findByRole('form', { name: 'Test 3' })
      expect(textbox(addForm(), 'Input')).toHaveValue('')
      expect(textbox(addForm(), 'Expected output')).toHaveValue('')
      expect(hiddenBox(addForm())).not.toBeChecked()
    })

    it('adds the first test case to an empty list', async () => {
      addTestCaseMock.mockResolvedValue({ id: 20, position: 1, input: '', expectedOutput: 'hi\n', hidden: false })
      renderEditor([])

      await findSection()
      type(textbox(addForm(), 'Expected output'), 'hi\n')
      fireEvent.click(button(addForm(), 'Add test case'))

      expect(await screen.findByRole('form', { name: 'Test 1' })).toBeInTheDocument()
      expect(screen.queryByText('No test cases yet.')).not.toBeInTheDocument()
    })

    it('shows the client checks under the add form fields and sends nothing', async () => {
      renderEditor()

      await findSection()
      const form = addForm()
      type(textbox(form, 'Input'), 'a'.repeat(10_001))
      fireEvent.click(button(form, 'Add test case'))

      expect(textbox(form, 'Input')).toHaveAccessibleDescription('Input must be 10,000 characters or fewer.')
      expect(textbox(form, 'Expected output')).toHaveAccessibleDescription('Enter the expected output.')
      expect(textbox(form, 'Expected output')).toHaveAttribute('aria-invalid', 'true')

      type(textbox(form, 'Input'), '')
      type(textbox(form, 'Expected output'), 'a'.repeat(10_001))
      fireEvent.click(button(form, 'Add test case'))
      expect(textbox(form, 'Expected output')).toHaveAccessibleDescription(
        'Expected output must be 10,000 characters or fewer.',
      )
      expect(addTestCaseMock).not.toHaveBeenCalled()
    })

    it('shows server field errors under the add form fields and keeps the typed values', async () => {
      addTestCaseMock.mockRejectedValue(apiError(400, 'Validation failed.', { expectedOutput: 'must not be blank' }))
      renderEditor()

      await findSection()
      const form = addForm()
      type(textbox(form, 'Expected output'), '6\n')
      fireEvent.click(button(form, 'Add test case'))

      expect(await within(form).findByText('must not be blank')).toBeInTheDocument()
      expect(textbox(form, 'Expected output')).toHaveAccessibleDescription('must not be blank')
      expect(textbox(form, 'Expected output')).toHaveValue('6\n')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('refuses an add past 50 test cases without a request', async () => {
      const fifty = Array.from({ length: 50 }, (_, index) => ({
        id: 100 + index,
        position: index + 1,
        input: '',
        expectedOutput: `${index}\n`,
        hidden: false,
      }))
      renderEditor(fifty)

      const section = await findSection()
      type(textbox(addForm(), 'Expected output'), '51\n')
      fireEvent.click(button(addForm(), 'Add test case'))

      expect(within(section).getByRole('alert')).toHaveTextContent('An activity can have at most 50 test cases.')
      expect(addTestCaseMock).not.toHaveBeenCalled()
    })

    it("shows the server's test case limit error at the top of the section", async () => {
      addTestCaseMock.mockRejectedValue(
        apiError(400, 'An activity can have at most 50 test cases.', {
          testCases: 'An activity can have at most 50 test cases.',
        }),
      )
      renderEditor()

      const section = await findSection()
      type(textbox(addForm(), 'Expected output'), '6\n')
      fireEvent.click(button(addForm(), 'Add test case'))

      const alert = await within(section).findByRole('alert')
      expect(alert).toHaveTextContent('An activity can have at most 50 test cases.')
      expect(section.firstElementChild?.nextElementSibling).toBe(alert)
    })

    it('shows a 409 detail at the top of the section and keeps the typed values', async () => {
      addTestCaseMock.mockRejectedValue(apiError(409, "Archived activities can't be changed."))
      renderEditor()

      const section = await findSection()
      type(textbox(addForm(), 'Expected output'), '6\n')
      fireEvent.click(button(addForm(), 'Add test case'))

      expect(await within(section).findByRole('alert')).toHaveTextContent("Archived activities can't be changed.")
      expect(textbox(addForm(), 'Expected output')).toHaveValue('6\n')
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('disables Add test case while the request runs and ignores a second submit', async () => {
      let resolve: (testCase: TestCase) => void = () => {}
      addTestCaseMock.mockReturnValue(new Promise((done) => (resolve = done)))
      renderEditor()

      await findSection()
      type(textbox(addForm(), 'Expected output'), '6\n')
      fireEvent.click(button(addForm(), 'Add test case'))
      expect(button(addForm(), 'Add test case')).toBeDisabled()
      fireEvent.submit(addForm())
      expect(addTestCaseMock).toHaveBeenCalledTimes(1)

      resolve({ id: 13, position: 3, input: '', expectedOutput: '6\n', hidden: false })
      expect(await screen.findByRole('form', { name: 'Test 3' })).toBeInTheDocument()
      expect(button(addForm(), 'Add test case')).toBeEnabled()
    })

    it('clears the section error when the next action starts', async () => {
      addTestCaseMock.mockRejectedValueOnce(apiError(500, 'The server could not handle the request.'))
      addTestCaseMock.mockResolvedValueOnce({ id: 13, position: 3, input: '', expectedOutput: '6\n', hidden: false })
      renderEditor()

      await findSection()
      type(textbox(addForm(), 'Expected output'), '6\n')
      fireEvent.click(button(addForm(), 'Add test case'))
      expect(await screen.findByRole('alert')).toHaveTextContent('The server could not handle the request.')

      fireEvent.click(button(addForm(), 'Add test case'))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(await screen.findByRole('form', { name: 'Test 3' })).toBeInTheDocument()
    })
  })

  describe('delete', () => {
    it('asks for confirmation and sends nothing when cancelled', async () => {
      const confirm = confirmWith(false)
      renderEditor()

      await findSection()
      fireEvent.click(button(row('Test 2'), 'Delete Test 2'))

      expect(confirm).toHaveBeenCalledExactlyOnceWith("Delete Test 2? This can't be undone.")
      expect(deleteTestCaseMock).not.toHaveBeenCalled()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('deletes the test case and then shows the list the server returns', async () => {
      confirmWith(true)
      deleteTestCaseMock.mockResolvedValue(undefined)
      listTestCasesMock.mockResolvedValue([{ ...SECOND, position: 1 }])
      renderEditor()

      await findSection()
      fireEvent.click(button(row('Test 1'), 'Delete Test 1'))

      await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
      const renumbered = row('Test 1')
      expect(deleteTestCaseMock).toHaveBeenCalledExactlyOnceWith(TOKEN, ACTIVITY_ID, 11)
      expect(listTestCasesMock).toHaveBeenCalledExactlyOnceWith(TOKEN, ACTIVITY_ID)
      expect(textbox(renumbered, 'Expected output')).toHaveValue('0\n')
      expect(hiddenBox(renumbered)).toBeChecked()
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
      expect(screen.queryByRole('form', { name: 'Test 2' })).not.toBeInTheDocument()
    })

    it('shows a 409 detail at the top of the section and keeps the row', async () => {
      confirmWith(true)
      deleteTestCaseMock.mockRejectedValue(apiError(409, 'A published activity needs at least one test case.'))
      renderEditor([FIRST])

      const section = await findSection()
      fireEvent.click(button(row('Test 1'), 'Delete Test 1'))

      const alert = await within(section).findByRole('alert')
      expect(alert).toHaveTextContent('A published activity needs at least one test case.')
      expect(section.firstElementChild?.nextElementSibling).toBe(alert)
      expect(row('Test 1')).toBeInTheDocument()
      expect(button(row('Test 1'), 'Delete Test 1')).toBeEnabled()
      expect(listTestCasesMock).not.toHaveBeenCalled()
    })

    it('removes the deleted row and shows the error when the list cannot be reloaded', async () => {
      confirmWith(true)
      deleteTestCaseMock.mockResolvedValue(undefined)
      listTestCasesMock.mockRejectedValue(apiError(0, "Can't reach the server. Check your connection."))
      renderEditor()

      const section = await findSection()
      fireEvent.click(button(row('Test 1'), 'Delete Test 1'))

      expect(await within(section).findByRole('alert')).toHaveTextContent(
        "Can't reach the server. Check your connection.",
      )
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
      expect(textbox(within(section).getByRole('listitem'), 'Expected output')).toHaveValue('0\n')
    })

    it('disables the row while the delete runs', async () => {
      confirmWith(true)
      deleteTestCaseMock.mockReturnValue(new Promise(() => {}))
      renderEditor()

      await findSection()
      fireEvent.click(button(row('Test 1'), 'Delete Test 1'))

      expect(button(row('Test 1'), 'Delete Test 1')).toBeDisabled()
      expect(button(row('Test 1'), 'Save Test 1')).toBeDisabled()
      expect(deleteTestCaseMock).toHaveBeenCalledTimes(1)
    })

    it('sends the user to /login when the token is rejected', async () => {
      confirmWith(true)
      deleteTestCaseMock.mockRejectedValue(apiError(401, 'Authentication required.'))
      const { router } = renderEditor()

      await findSection()
      fireEvent.click(button(row('Test 1'), 'Delete Test 1'))

      expect(await screen.findByRole('heading', { level: 1, name: 'Log in page' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(getToken()).toBeNull()
    })
  })
})
