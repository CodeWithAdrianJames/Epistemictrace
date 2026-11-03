import styles from './BrandLogo.module.css'
import Mascot from './Mascot.tsx'

interface BrandLogoProps {
  size?: 'md' | 'lg'
}

// The emblem is decorative, so the visible text alone gives the logo its accessible name: "EpistemicTrace".
function BrandLogo({ size = 'md' }: BrandLogoProps) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <span className={styles.emblem} aria-hidden="true">
        <Mascot className={styles.glyph} />
      </span>
      <span className={styles.wordmark}>EpistemicTrace</span>
    </span>
  )
}

export default BrandLogo
