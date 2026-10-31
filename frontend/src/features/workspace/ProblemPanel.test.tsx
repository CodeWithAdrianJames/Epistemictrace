import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TestCase } from '../../api/activitiesApi.ts'
import ProblemPanel from './ProblemPanel.tsx'

function testCase(position: number, overrides: Partial<TestCase> = {}): TestCase {
  return { id: position * 10, position, input: `in ${position}`, expectedOutput: `out ${position}`, hidden: false, ...overrides }
}

describe('ProblemPanel', () => {
  it('shows the problem statement as typed, with its line breaks kept', () => {
    const statement = 'Read two numbers.\n\n  Print their sum.'
    render(<ProblemPanel problemStatement={statement} testCases={[]} />)

    const panel = screen.getByRole('region', { name: 'Problem' })
    expect(
      within(panel).getByText((_, element) => element?.tagName === 'P' && element.textContent === statement),
    ).toBeInTheDocument()
  })

  it('lists the visible tests as examples with their input and expected output', () => {
    render(<ProblemPanel problemStatement="Sum" testCases={[testCase(1), testCase(2)]} />)

    const examples = screen.getAllByRole('listitem')
    expect(examples).toHaveLength(2)
    expect(within(examples[0]).getByRole('heading', { name: 'Test 1' })).toBeInTheDocument()
    expect(within(examples[0]).getByText('in 1')).toBeInTheDocument()
    expect(within(examples[0]).getByText('out 1')).toBeInTheDocument()
    expect(within(examples[1]).getByRole('heading', { name: 'Test 2' })).toBeInTheDocument()
    expect(within(examples[1]).getByText('in 2')).toBeInTheDocument()
    expect(within(examples[1]).getByText('out 2')).toBeInTheDocument()
  })

  it('shows input and expected output in mono blocks with their labels', () => {
    render(<ProblemPanel problemStatement="Sum" testCases={[testCase(1, { input: '3\n4', expectedOutput: '7' })]} />)

    const example = screen.getByRole('listitem')
    expect(within(example).getByText('Input')).toBeInTheDocument()
    expect(within(example).getByText('Expected output')).toBeInTheDocument()
    expect(within(example).getByText((_, element) => element?.tagName === 'PRE' && element.textContent === '3\n4')).toBeInTheDocument()
    expect(within(example).getByText('7').tagName).toBe('PRE')
  })

  it('does not list hidden tests, and numbers visible ones by their place among all tests', () => {
    render(
      <ProblemPanel
        problemStatement="Sum"
        testCases={[testCase(1), testCase(2, { hidden: true, input: 'secret in', expectedOutput: 'secret out' }), testCase(3)]}
      />,
    )

    const examples = screen.getAllByRole('listitem')
    expect(examples).toHaveLength(2)
    expect(within(examples[0]).getByRole('heading', { name: 'Test 1' })).toBeInTheDocument()
    expect(within(examples[1]).getByRole('heading', { name: 'Test 3' })).toBeInTheDocument()
    expect(screen.queryByText('secret in')).not.toBeInTheDocument()
    expect(screen.queryByText('secret out')).not.toBeInTheDocument()
    expect(screen.queryByText(/Test 2/)).not.toBeInTheDocument()
  })

  it('orders examples by position even when they arrive out of order', () => {
    render(<ProblemPanel problemStatement="Sum" testCases={[testCase(2), testCase(1)]} />)

    const headings = screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Test 1', 'Test 2'])
    expect(within(screen.getAllByRole('listitem')[0]).getByText('in 1')).toBeInTheDocument()
  })

  it('leaves out the examples section when every test is hidden', () => {
    render(<ProblemPanel problemStatement="Sum" testCases={[testCase(1, { hidden: true })]} />)

    expect(screen.queryByRole('heading', { name: 'Examples' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows an examples heading when there are visible tests', () => {
    render(<ProblemPanel problemStatement="Sum" testCases={[testCase(1)]} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Examples' })).toBeInTheDocument()
  })
})
