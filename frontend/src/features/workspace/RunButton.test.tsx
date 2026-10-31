import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RunButton from './RunButton.tsx'

describe('RunButton', () => {
  it('shows Run tests and runs when ready', () => {
    const onRun = vi.fn()
    render(<RunButton state="ready" onRun={onRun} />)

    const button = screen.getByRole('button', { name: 'Run tests' })
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(button)
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['preparing', 'Preparing Python…'],
    ['running', 'Running…'],
  ] as const)('is disabled with the label for the %s state', (state, label) => {
    const onRun = vi.fn()
    render(<RunButton state={state} onRun={onRun} />)

    const button = screen.getByRole('button', { name: label })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(button)
    expect(onRun).not.toHaveBeenCalled()
  })

  it('is disabled with the reason shown next to it when Python could not start', () => {
    render(<RunButton state="failed" onRun={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Run tests' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent("Python couldn't start. Refresh the page to try again.")
  })

  it('shows no reason in the other states', () => {
    render(<RunButton state="ready" onRun={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
