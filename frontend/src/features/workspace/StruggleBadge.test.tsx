import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StruggleBadge from './StruggleBadge.tsx'

describe('StruggleBadge', () => {
  it.each([
    ['LOW', 'Steady'],
    ['MEDIUM', 'Take a moment'],
    ['HIGH', 'Time to pause and plan'],
  ] as const)('shows the ui-context text for %s', (level, text) => {
    const { container } = render(<StruggleBadge level={level} />)

    expect(screen.getByText(text)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d/)
    expect(container.textContent).not.toMatch(/SDI|%/)
    expect(container.querySelector('progress, [role="progressbar"], meter')).toBeNull()
  })

  it('is an empty polite live region without a level', () => {
    const { container } = render(<StruggleBadge level={null} />)

    const region = container.querySelector('[aria-live="polite"]')
    expect(region).not.toBeNull()
    expect(region?.textContent).toBe('')
  })

  it('announces changes through the same live region', () => {
    const { container, rerender } = render(<StruggleBadge level="LOW" />)
    const region = container.querySelector('[aria-live="polite"]')

    rerender(<StruggleBadge level="HIGH" />)

    expect(container.querySelector('[aria-live="polite"]')).toBe(region)
    expect(region).toHaveTextContent('Time to pause and plan')
  })
})
