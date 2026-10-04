const s = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }

export const icons = {
  select: (
    <svg {...s} strokeLinejoin="round">
      <path d="M4 2.5l9.5 7-4.2.6 2.6 4.8-1.8.9-2.6-4.8L4 14z" fill="currentColor" stroke="none" />
    </svg>
  ),
  line: (
    <svg {...s} strokeLinecap="round">
      <path d="M3 15L15 3" />
    </svg>
  ),
  rect: (
    <svg {...s}>
      <rect x="2.75" y="4.25" width="12.5" height="9.5" rx="0.5" />
    </svg>
  ),
  ellipse: (
    <svg {...s}>
      <ellipse cx="9" cy="9" rx="6.5" ry="5" />
    </svg>
  ),
  text: (
    <svg {...s} strokeLinecap="round">
      <path d="M3.5 4h11M9 4v11" />
    </svg>
  ),
  dot: (
    <svg {...s}>
      <circle cx="9" cy="9" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** "Ab" stays recognisable at any angle, so the icon shows which way the text reads. */
const letters = (
  <text x="9" y="12.6" textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily="Inter, sans-serif" fill="currentColor" stroke="none">
    Ab
  </text>
)
const dotRow = (y: number) => (
  <g fill="currentColor" stroke="none" opacity={0.55}>
    <circle cx="2.5" cy={y} r="1" />
    <circle cx="9" cy={y} r="1" />
    <circle cx="15.5" cy={y} r="1" />
  </g>
)

/** Icons for text placement and direction (the letter shows which way text reads). */
export const textIcons = {
  onRow: (
    <svg {...s}>
      <path d="M5.5 13L9 3.5l3.5 9.5M6.8 9.8h4.4" strokeLinecap="round" strokeLinejoin="round" />
      {dotRow(15.5)}
    </svg>
  ),
  between: (
    <svg {...s}>
      {dotRow(2)}
      <path d="M6.5 12.5L9 5.5l2.5 7M7.4 10h3.2" strokeLinecap="round" strokeLinejoin="round" />
      {dotRow(16)}
    </svg>
  ),
  horizontal: <svg {...s}>{letters}</svg>,
  down: (
    <svg {...s}>
      <g transform="rotate(90 9 9)">{letters}</g>
    </svg>
  ),
  up: (
    <svg {...s}>
      <g transform="rotate(-90 9 9)">{letters}</g>
    </svg>
  )
}
