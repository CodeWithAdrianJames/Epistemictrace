import styles from './BrandLogo.module.css'

interface BrandLogoProps {
  size?: 'md' | 'lg'
}

// The emblem is decorative, so the visible text alone gives the logo its accessible name: "EpistemicTrace".
function BrandLogo({ size = 'md' }: BrandLogoProps) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <span className={styles.emblem} aria-hidden="true">
        <svg className={styles.glyph} viewBox="0 0 24 24" focusable="false">
          <path className={styles.trace} d="M5 17 L10 11.5 L14 14.5 L19 7" />
          <circle className={styles.node} cx="5" cy="17" r="2" />
          <circle className={styles.node} cx="10" cy="11.5" r="1.6" />
          <circle className={styles.node} cx="14" cy="14.5" r="1.6" />
          <circle className={styles.spark} cx="19" cy="7" r="2.6" />
        </svg>
      </span>
      <span className={styles.wordmark}>
        Epistemic<span className={styles.accent}>Trace</span>
      </span>
    </span>
  )
}

export default BrandLogo
