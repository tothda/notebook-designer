import type { Element, NotebookSpec, TextElement } from './model'
import { readingToPage } from './text'

/** Dot index (0-based) to the 1-based number you count on paper: 2 → "3", 2.5 → "3½". */
export function formatDot(d: number): string {
  const n = d + 1
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  if (Math.abs(frac) < 1e-6) return String(whole)
  if (Math.abs(frac - 0.5) < 1e-6) return whole === 0 ? '½' : `${whole}½`
  return n.toFixed(2)
}

/** A distance in dot spaces: 12 → "12", 3.5 → "3½". */
export function formatSpaces(d: number): string {
  const a = Math.abs(d)
  const whole = Math.floor(a + 1e-9)
  const frac = a - whole
  const sign = d < 0 ? '−' : ''
  if (Math.abs(frac) < 1e-6) return `${sign}${whole}`
  if (Math.abs(frac - 0.5) < 1e-6) return `${sign}${whole === 0 ? '' : whole}½`
  return `${sign}${Number(a.toFixed(2))}`
}

/** "1 space", "3 spaces", "½ space". */
export function spacesLabel(d: number): string {
  return `${formatSpaces(d)} space${Math.abs(d) > 1 + 1e-9 || Math.abs(d) < 1e-9 ? 's' : ''}`
}

export function formatMm(mm: number): string {
  return `${Math.round(mm * 10) / 10} mm`
}

export function formatPos(x: number, y: number): string {
  return `col ${formatDot(x)}, row ${formatDot(y)}`
}

/** Human instructions for copying an element onto paper by counting dots. */
export function describeElement(el: Element, spec: NotebookSpec): string[] {
  const mm = (d: number) => formatMm(d * spec.dotPitchMm)
  switch (el.type) {
    case 'line': {
      const dx = el.x2 - el.x1
      const dy = el.y2 - el.y1
      const len = Math.hypot(dx, dy)
      const dir = dy === 0 ? 'horizontal' : dx === 0 ? 'vertical' : 'diagonal'
      return [
        `From ${formatPos(el.x1, el.y1)}`,
        `To ${formatPos(el.x2, el.y2)}`,
        dir === 'diagonal'
          ? `Diagonal: ${formatSpaces(dx)} across, ${formatSpaces(dy)} down (${mm(len)})`
          : `${dir === 'horizontal' ? 'Horizontal' : 'Vertical'}, ${formatSpaces(Math.abs(dx + dy))} spaces (${mm(len)})`
      ]
    }
    case 'rect':
    case 'ellipse': {
      const x = Math.min(el.x, el.x + el.w)
      const y = Math.min(el.y, el.y + el.h)
      const w = Math.abs(el.w)
      const h = Math.abs(el.h)
      return [
        `${el.type === 'rect' ? 'Top-left' : 'Box top-left'} ${formatPos(x, y)}`,
        `Bottom-right ${formatPos(x + w, y + h)}`,
        `${formatSpaces(w)} × ${formatSpaces(h)} spaces (${mm(w)} × ${mm(h)})`
      ]
    }
    case 'text':
      return describeText(el, mm)
    case 'dot':
      return [`At ${formatPos(el.x, el.y)}`]
  }
}

function describeText(el: TextElement, mm: (d: number) => string): string[] {
  const vertical = el.direction === 'down' || el.direction === 'up'
  const lines = el.text.split('\n').length
  const anchor = el.align === 'start' ? 'Starts' : el.align === 'middle' ? 'Centred' : 'Ends'
  const out: string[] = []
  if (vertical) out.push(el.direction === 'down' ? 'Turned to read downward' : 'Turned to read upward')
  if (el.placement === 'between') {
    // The band of the first line, in the axis across the text.
    const a = readingToPage(el, 0, 0)
    const b = readingToPage(el, 0, el.lineHeightDots)
    if (vertical) {
      out.push(`Between cols ${formatDot(Math.min(a.x, b.x))} and ${formatDot(Math.max(a.x, b.x))}`)
      out.push(`${anchor} at row ${formatDot(el.y)}`)
    } else {
      out.push(`Between rows ${formatDot(el.y)} and ${formatDot(el.y + el.lineHeightDots)}`)
      out.push(`${anchor} at col ${formatDot(el.x)}`)
    }
  } else if (vertical) {
    out.push(`Baseline along col ${formatDot(el.x)}, ${anchor.toLowerCase()} at row ${formatDot(el.y)}`)
  } else {
    out.push(`Baseline ${anchor === 'Centred' ? 'centred' : anchor.toLowerCase()} at ${formatPos(el.x, el.y)}`)
  }
  if (lines > 1) out.push(`${lines} lines, one every ${spacesLabel(el.lineHeightDots)}`)
  out.push(`Letter size ${spacesLabel(el.sizeDots)} (${mm(el.sizeDots)})`)
  return out
}
