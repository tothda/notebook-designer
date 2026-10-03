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
