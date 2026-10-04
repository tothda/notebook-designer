import type { TextDirection, TextElement, TextPlacement } from './model'

/** Vertical font metrics as fractions of the font size (em). */
export interface FontMetrics {
  /** Height of capital letters above the baseline. */
  cap: number
  /** Height of the tallest ascenders (b, d, h, l) above the baseline. */
  ascent: number
  /** Depth of descenders (g, p, y) below the baseline. */
  descent: number
}

export const DEFAULT_METRICS: FontMetrics = { cap: 0.7, ascent: 0.75, descent: 0.25 }

/** Baseline of line `i` in dot units. 'between' centres the capital height in its band. */
export function baselineDots(el: TextElement, i: number, m: FontMetrics): number {
  const top = el.y + i * el.lineHeightDots
  if (el.placement !== 'between') return top
  return top + el.lineHeightDots / 2 + (m.cap * el.sizeDots) / 2
}

/** Top and bottom of the inked text in dot units. */
export function textVerticalExtent(el: TextElement, m: FontMetrics): { top: number; bottom: number } {
  const lines = el.text.split('\n').length
  return {
    top: baselineDots(el, 0, m) - m.ascent * el.sizeDots,
    bottom: baselineDots(el, lines - 1, m) + m.descent * el.sizeDots
  }
}

/**
 * Largest letter size (in dot spaces) that keeps 'between' text clear of the dots
 * above and below, leaving `clearanceDots` of space around each dot.
 */
export function maxSizeBetween(lineHeightDots: number, clearanceDots: number, m: FontMetrics): number {
  const room = lineHeightDots / 2 - clearanceDots
  const reach = Math.max(m.ascent - m.cap / 2, m.cap / 2 + m.descent)
  return Math.max(0, room / reach)
}

/** SVG rotation of the text about its anchor, in degrees (clockwise positive). */
export function rotationDeg(direction: TextDirection | undefined): number {
  return direction === 'down' ? 90 : direction === 'up' ? -90 : 0
}

/**
 * Page position (dots) of a point given in the text's own reading frame: `u` along the
 * line of text and `v` across it (downwards for upright text), both relative to (x, y).
 */
export function readingToPage(el: Pick<TextElement, 'x' | 'y' | 'direction'>, u: number, v: number): { x: number; y: number } {
  switch (el.direction) {
    case 'down':
      return { x: el.x - v, y: el.y + u }
    case 'up':
      return { x: el.x + v, y: el.y - u }
    default:
      return { x: el.x + u, y: el.y + v }
  }
}

/**
 * Re-anchor text when switching placement so it stays in the same place on the page:
 * a baseline on row r corresponds to the band between rows r - lineHeight and r
 * (measured across the line, so this also works for rotated text).
 */
export function withPlacement(el: TextElement, placement: TextPlacement): TextElement {
  if ((el.placement ?? 'baseline') === placement) return el
  const shift = placement === 'between' ? -el.lineHeightDots : el.lineHeightDots
  const anchor = readingToPage(el, 0, shift)
  return { ...el, placement, x: anchor.x, y: anchor.y }
}
