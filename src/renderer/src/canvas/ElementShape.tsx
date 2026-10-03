import { gridSize } from '@shared/geometry'
import { baselineDots } from '@shared/text'
import { fontMetrics } from '../measure'
import type { Dash, Element, NotebookSpec } from '@shared/model'

/** SVG dash pattern in mm, scaled to the pen width so it reads like a hand-drawn dash. */
function dashArray(dash: Dash, strokeMm: number): string | undefined {
  if (dash === 'dashed') return `${Math.max(1.2, strokeMm * 5)} ${Math.max(0.9, strokeMm * 3.5)}`
  if (dash === 'dotted') return `0 ${Math.max(0.8, strokeMm * 3)}`
  return undefined
}

export const FILL_OPACITY = 0.22

interface Props {
  el: Element
  spec: NotebookSpec
}

/** Renders one element in page-mm coordinates. */
export function ElementShape({ el, spec }: Props) {
  const p = spec.dotPitchMm
  const X = (d: number) => spec.gridOffsetXMm + d * p
  const Y = (d: number) => spec.gridOffsetYMm + d * p
  switch (el.type) {
    case 'line':
      return (
        <line
          x1={X(el.x1)}
          y1={Y(el.y1)}
          x2={X(el.x2)}
          y2={Y(el.y2)}
          stroke={el.color}
          strokeWidth={el.strokeMm}
          strokeLinecap="round"
          strokeDasharray={dashArray(el.dash, el.strokeMm)}
        />
      )
    case 'rect': {
      const x = Math.min(el.x, el.x + el.w)
      const y = Math.min(el.y, el.y + el.h)
      return (
        <rect
          x={X(x)}
          y={Y(y)}
          width={Math.abs(el.w) * p}
          height={Math.abs(el.h) * p}
          rx={el.radiusDots * p}
          fill={el.fill ?? 'none'}
          fillOpacity={FILL_OPACITY}
          stroke={el.strokeMm > 0 ? el.color : 'none'}
          strokeWidth={el.strokeMm}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray(el.dash, el.strokeMm)}
        />
      )
    }
    case 'ellipse':
      return (
        <ellipse
          cx={X(el.x + el.w / 2)}
          cy={Y(el.y + el.h / 2)}
          rx={(Math.abs(el.w) * p) / 2}
          ry={(Math.abs(el.h) * p) / 2}
          fill={el.fill ?? 'none'}
          fillOpacity={FILL_OPACITY}
          stroke={el.strokeMm > 0 ? el.color : 'none'}
          strokeWidth={el.strokeMm}
          strokeLinecap="round"
          strokeDasharray={dashArray(el.dash, el.strokeMm)}
        />
      )
    case 'text': {
      const lines = el.text.split('\n')
      const m = fontMetrics(el.font, el.bold)
      return (
        <text
          x={X(el.x)}
          y={Y(baselineDots(el, 0, m))}
          fill={el.color}
          fontFamily={`"${el.font}", cursive`}
          fontWeight={el.bold ? 700 : 400}
          fontSize={el.sizeDots * p}
          textAnchor={el.align}
          style={{ whiteSpace: 'pre' }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={X(el.x)} y={Y(baselineDots(el, i, m))}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      )
    }
    case 'dot':
      return <circle cx={X(el.x)} cy={Y(el.y)} r={el.sizeMm / 2} fill={el.color} />
  }
}

interface PageProps {
  spec: NotebookSpec
  showDots: boolean
  showBorder: boolean
  dotColor?: string
}

/** Paper, dot grid and page outline in page-mm coordinates. */
export function PageBackground({ spec, showDots, showBorder, dotColor = '#b4b0a6' }: PageProps) {
  const p = spec.dotPitchMm
  const dots: React.ReactNode[] = []
  if (showDots) {
    const { cols, rows } = gridSize(spec)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = spec.gridOffsetXMm + c * p
        const y = spec.gridOffsetYMm + r * p
        dots.push(<circle key={`${r}-${c}`} cx={x} cy={y} r={spec.dotDiameterMm / 2} fill={dotColor} />)
      }
    }
  }
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={spec.pageWidthMm}
        height={spec.pageHeightMm}
        fill="var(--paper, #fffdf8)"
        stroke={showBorder ? '#9c978c' : 'none'}
        strokeWidth={0.2}
      />
      {dots}
    </g>
  )
}
