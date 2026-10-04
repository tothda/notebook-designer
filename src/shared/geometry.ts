import { DEFAULT_METRICS, textVerticalExtent, type FontMetrics } from './text'
import { SPREAD_GAP_MM, type Element, type NotebookSpec, type Slot } from './model'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Number of dot columns and rows that fit on a page (grid assumed symmetric). */
export function gridSize(spec: NotebookSpec): { cols: number; rows: number } {
  const count = (len: number, off: number) =>
    Math.max(0, Math.floor((len - 2 * off) / spec.dotPitchMm + 1e-6) + 1)
  return {
    cols: count(spec.pageWidthMm, spec.gridOffsetXMm),
    rows: count(spec.pageHeightMm, spec.gridOffsetYMm)
  }
}

export function dotToMmX(spec: NotebookSpec, d: number): number {
  return spec.gridOffsetXMm + d * spec.dotPitchMm
}

export function dotToMmY(spec: NotebookSpec, d: number): number {
  return spec.gridOffsetYMm + d * spec.dotPitchMm
}

export function mmToDotX(spec: NotebookSpec, mm: number): number {
  return (mm - spec.gridOffsetXMm) / spec.dotPitchMm
}

export function mmToDotY(spec: NotebookSpec, mm: number): number {
  return (mm - spec.gridOffsetYMm) / spec.dotPitchMm
}

export function snap(v: number, step: number): number {
  if (step <= 0) return v
  return Math.round(v / step) * step
}

export const SLOTS: Slot[] = ['left', 'right']

/** X position of a page's left edge within the spread, in mm. */
export function pageOriginMm(spec: NotebookSpec, slot: Slot): number {
  return slot === 'left' ? 0 : spec.pageWidthMm + SPREAD_GAP_MM
}

/** Width of a spread showing `pageCount` (1 or 2) pages side by side. */
export function spreadWidthMm(spec: NotebookSpec, pageCount: number): number {
  return pageCount > 1 ? spec.pageWidthMm * 2 + SPREAD_GAP_MM : spec.pageWidthMm
}

/** Which slot a spread x-coordinate (mm) belongs to; the gap splits halfway. */
export function slotAtMm(spec: NotebookSpec, pageCount: number, xMm: number): Slot {
  if (pageCount < 2) return 'left'
  return xMm < spec.pageWidthMm + SPREAD_GAP_MM / 2 ? 'left' : 'right'
}

/** Dot distance from the left page's grid to the right page's grid. */
export function pageShiftDots(spec: NotebookSpec): number {
  return (spec.pageWidthMm + SPREAD_GAP_MM) / spec.dotPitchMm
}

/** Rough text width in dot units when no font metrics are available. */
export function approxTextWidthDots(text: string, sizeDots: number): number {
  const longest = text.split('\n').reduce((m, l) => Math.max(m, l.length), 0)
  return longest * sizeDots * 0.45
}

export type TextMeasurer = (text: string, font: string, bold: boolean, sizeDots: number) => number
export type MetricsLookup = (font: string, bold: boolean) => FontMetrics

const approxMeasure: TextMeasurer = (t, _f, _b, s) => approxTextWidthDots(t, s)

/** Bounding box of an element in dot units (page-relative). */
export function elementBounds(
  el: Element,
  measure: TextMeasurer = approxMeasure,
  metrics: MetricsLookup = () => DEFAULT_METRICS
): Rect {
  switch (el.type) {
    case 'line':
      return {
        x: Math.min(el.x1, el.x2),
        y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1),
        h: Math.abs(el.y2 - el.y1)
      }
    case 'rect':
    case 'ellipse':
      return normalizeRect({ x: el.x, y: el.y, w: el.w, h: el.h })
    case 'dot':
      return { x: el.x, y: el.y, w: 0, h: 0 }
    case 'text': {
      const lines = el.text.split('\n')
      const w = Math.max(...lines.map((l) => measure(l, el.font, el.bold, el.sizeDots)))
      const x = el.align === 'start' ? el.x : el.align === 'middle' ? el.x - w / 2 : el.x - w
      if (el.placement === 'between') {
        // The bands between dot rows, so the outline shows which rows the text sits between.
        return { x, y: el.y, w, h: lines.length * el.lineHeightDots }
      }
      const { top, bottom } = textVerticalExtent(el, metrics(el.font, el.bold))
      return { x, y: top, w, h: bottom - top }
    }
  }
}

export function normalizeRect(r: Rect): Rect {
  return {
    x: r.w < 0 ? r.x + r.w : r.x,
    y: r.h < 0 ? r.y + r.h : r.y,
    w: Math.abs(r.w),
    h: Math.abs(r.h)
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const x1 = Math.min(...rects.map((r) => r.x))
  const y1 = Math.min(...rects.map((r) => r.y))
  const x2 = Math.max(...rects.map((r) => r.x + r.w))
  const y2 = Math.max(...rects.map((r) => r.y + r.h))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Shift an element by a dot offset. */
export function translateElement<T extends Element>(el: T, dx: number, dy: number): T {
  switch (el.type) {
    case 'line':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy }
    default:
      return { ...el, x: (el as { x: number }).x + dx, y: (el as { y: number }).y + dy }
  }
}

/**
 * Whether an element's ink stays on the page. Elements may extend past the
 * last dot (into the margin) but not past the paper edge.
 */
export function fitsOnPage(spec: NotebookSpec, b: Rect): boolean {
  const eps = 1e-6
  return (
    dotToMmX(spec, b.x) >= -eps &&
    dotToMmY(spec, b.y) >= -eps &&
    dotToMmX(spec, b.x + b.w) <= spec.pageWidthMm + eps &&
    dotToMmY(spec, b.y + b.h) <= spec.pageHeightMm + eps
  )
}
