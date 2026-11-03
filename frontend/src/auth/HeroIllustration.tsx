import { useId } from 'react'
import Mascot from '../components/Mascot.tsx'
import PythonMark from '../components/PythonMark.tsx'
import styles from './HeroIllustration.module.css'

// Plane-to-isometric transforms: the board tilts down to the left, the screen down to the right.
const BOARD = 'matrix(0.866 0.5 -0.866 0.5 300 318)'
const SCREEN = 'matrix(0.866 -0.5 0.866 0.5 418 492)'

const CHECK_TILES = [
  { x: 34, y: 40 },
  { x: 120, y: 92 },
  { x: 60, y: 150 },
  { x: 146, y: 206 },
]

const CODE_LINES = [
  { y: 30, width: 120, tone: 'lineAccent' },
  { y: 58, width: 82, tone: 'lineCyan' },
  { y: 86, width: 140, tone: 'lineMuted' },
  { y: 114, width: 64, tone: 'linePink' },
  { y: 142, width: 104, tone: 'lineYellow' },
  { y: 170, width: 76, tone: 'lineMuted' },
] as const

function hexagon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i + Math.PI / 6
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}

// The register page hero art from ui/main screens/epistemictrace-signup.png: the mascot over a board of
// solved steps, a code screen and Python, code and badge tokens. Purely decorative.
function HeroIllustration() {
  const id = useId()
  const glowId = `${id}-glow`
  const dotsId = `${id}-dots`

  return (
    <svg className={styles.art} viewBox="0 0 720 660" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0" className={styles.glowCore} />
          <stop offset="1" className={styles.glowEdge} />
        </radialGradient>
        <pattern id={dotsId} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="1.6" className={styles.dot} />
        </pattern>
      </defs>

      <circle cx="380" cy="300" r="280" fill={`url(#${glowId})`} />

      <g transform={BOARD}>
        <rect x="-6" y="14" width="250" height="300" rx="26" className={styles.boardEdge} />
        <rect x="0" y="0" width="250" height="300" rx="26" className={styles.board} />
        <rect x="0" y="0" width="250" height="300" rx="26" fill={`url(#${dotsId})`} />
        <polyline points="56,62 142,114 82,172 168,228" className={styles.trail} />
        {CHECK_TILES.map((tile) => (
          <g key={`${tile.x}-${tile.y}`} transform={`translate(${tile.x} ${tile.y})`}>
            <rect x="0" y="6" width="44" height="44" rx="11" className={styles.tileEdge} />
            <rect x="0" y="0" width="44" height="44" rx="11" className={styles.tile} />
            <polyline points="13,23 20,30 32,15" className={styles.tick} />
          </g>
        ))}
      </g>

      <g transform={SCREEN}>
        <rect x="-4" y="12" width="230" height="210" rx="22" className={styles.boardEdge} />
        <rect x="0" y="0" width="230" height="210" rx="22" className={styles.screen} />
        {CODE_LINES.map((line) => (
          <rect key={line.y} x="28" y={line.y} width={line.width} height="10" rx="5" className={styles[line.tone]} />
        ))}
      </g>

      <g transform="translate(398 458)">
        <rect x="0" y="16" width="112" height="92" rx="24" className={styles.playEdge} />
        <rect x="0" y="0" width="112" height="92" rx="24" className={styles.play} />
        <polygon points="44,26 78,46 44,66" className={styles.playIcon} />
      </g>

      <g transform="translate(470 418)">
        <rect x="0" y="0" width="118" height="96" rx="26" className={styles.outlineTile} />
      </g>

      <g transform="translate(232 40) rotate(-8)">
        <path d="M0 14 L74 0 L92 76 Q70 116 46 128 Q14 100 0 14 Z" className={styles.shieldEdge} transform="translate(6 8)" />
        <path d="M0 14 L74 0 L92 76 Q70 116 46 128 Q14 100 0 14 Z" className={styles.shield} />
        <text x="46" y="74" className={styles.shieldText}>
          {'</>'}
        </text>
      </g>

      <polygon points={hexagon(112, 330, 72)} className={styles.hexOuter} />
      <polygon points={hexagon(112, 330, 54)} className={styles.hexInner} />
      <PythonMark frame={{ x: 84, y: 302, width: 56, height: 56 }} />
      <rect x="58" y="320" width="6" height="6" className={styles.spark} />
      <rect x="160" y="344" width="6" height="6" className={styles.spark} />

      <g transform="translate(616 260) rotate(14)">
        <polygon points={hexagon(0, 0, 66)} className={styles.badgeOuter} />
        <polygon points={hexagon(0, 0, 50)} className={styles.badgeInner} />
        <polyline points="-26,-6 -12,8 2,-6 14,4 28,-12" className={styles.badgeTick} />
        <circle cx="-16" cy="26" r="4" className={styles.badgeStar} />
        <circle cx="0" cy="30" r="4" className={styles.badgeStar} />
        <circle cx="16" cy="26" r="4" className={styles.badgeStar} />
      </g>
      <rect x="538" y="140" width="10" height="10" className={styles.spark} />

      <Mascot className={styles.mascot} frame={{ x: 238, y: 110, width: 300, height: 293 }} />
    </svg>
  )
}

export default HeroIllustration
