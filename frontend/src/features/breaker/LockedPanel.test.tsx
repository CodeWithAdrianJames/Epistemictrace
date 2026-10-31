import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LockedPanel, { LOCKED_BODY, LOCKED_HEADING } from './LockedPanel.tsx'

describe('LockedPanel', () => {
  it('shows the ui-context heading and body and moves focus to the heading', () => {
    render(<LockedPanel />)

    const heading = screen.getByRole('heading', { name: "Let's pause and plan" })
    expect(heading).toHaveFocus()
    expect(LOCKED_HEADING).toBe("Let's pause and plan")
    expect(screen.getByText(LOCKED_BODY)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: "Let's pause and plan" })).toBeInTheDocument()
  })

  it('renders its children (the reflection form) inside the panel', () => {
    render(
      <LockedPanel>
        <p>Form goes here</p>
      </LockedPanel>,
    )
    expect(screen.getByRole('region')).toHaveTextContent('Form goes here')
  })

  it('never shows a number or the word SDI', () => {
    render(<LockedPanel />)
    expect(screen.getByRole('region').textContent).not.toMatch(/\d|SDI/)
  })
})
