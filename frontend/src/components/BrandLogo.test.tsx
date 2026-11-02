import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BrandLogo from './BrandLogo.tsx'
import styles from './BrandLogo.module.css'

describe('BrandLogo', () => {
  it('names a surrounding link "EpistemicTrace"', () => {
    render(
      <a href="/">
        <BrandLogo />
      </a>,
    )

    expect(screen.getByRole('link', { name: 'EpistemicTrace' })).toBeInTheDocument()
  })

  it('hides the emblem from assistive technology', () => {
    const { container } = render(<BrandLogo />)

    const emblem = container.querySelector(`.${styles.emblem}`)
    expect(emblem).toHaveAttribute('aria-hidden', 'true')
    expect(emblem?.querySelector('svg')).toHaveAttribute('focusable', 'false')
  })

  it('uses the medium size by default and the large size on request', () => {
    const { container, rerender } = render(<BrandLogo />)
    expect(container.firstElementChild).toHaveClass(styles.logo, styles.md)

    rerender(<BrandLogo size="lg" />)
    expect(container.firstElementChild).toHaveClass(styles.logo, styles.lg)
  })
})
