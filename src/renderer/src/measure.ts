import { elementBounds, type Rect } from '@shared/geometry'
import type { Element, NotebookSpec, TextElement } from '@shared/model'
import { DEFAULT_METRICS, maxSizeBetween, type FontMetrics } from '@shared/text'

let ctx: CanvasRenderingContext2D | null = null
const metricsCache = new Map<string, FontMetrics>()

function context(): CanvasRenderingContext2D | null {
  ctx ??= document.createElement('canvas').getContext('2d')
  return ctx
}

const cssFont = (font: string, bold: boolean, px: number) => `${bold ? 700 : 400} ${px}px "${font}"`

/** Width of a text line in dot units, using the real font metrics. */
export function measureTextDots(text: string, font: string, bold: boolean, sizeDots: number): number {
  const c = context()
  if (!c) return text.length * sizeDots * 0.45
  c.font = cssFont(font, bold, 100)
  return (c.measureText(text).width / 100) * sizeDots
}

/** Cap height, ascender and descender of a font, as fractions of its size. */
export function fontMetrics(font: string, bold: boolean): FontMetrics {
  const key = `${font}|${bold}`
  const cached = metricsCache.get(key)
  if (cached) return cached
  const c = context()
  // Don't cache fallback-font metrics measured before the web font has loaded.
  if (!c || !document.fonts.check(cssFont(font, bold, 100))) return DEFAULT_METRICS
  c.font = cssFont(font, bold, 100)
  const m = {
    cap: c.measureText('H').actualBoundingBoxAscent / 100,
    ascent: c.measureText('bdfhklt').actualBoundingBoxAscent / 100,
    descent: c.measureText('gjpqy').actualBoundingBoxDescent / 100
  }
  metricsCache.set(key, m)
  return m
}

export function boundsOf(el: Element): Rect {
  return elementBounds(el, measureTextDots, fontMetrics)
}

/** Space kept between letters and the edge of a dot, in mm. */
const DOT_CLEARANCE_MM = 0.3

/** Largest letter size (rounded down to 0.05) at which 'between' text clears the dots. */
export function maxBetweenSize(
  el: Pick<TextElement, 'font' | 'bold' | 'lineHeightDots'>,
  spec: NotebookSpec
): number {
  const clearance = (spec.dotDiameterMm / 2 + DOT_CLEARANCE_MM) / spec.dotPitchMm
  const max = maxSizeBetween(el.lineHeightDots, clearance, fontMetrics(el.font, el.bold))
  return Math.floor(max * 20 + 1e-6) / 20
}

/** Shrink 'between' text that would touch the dots; other elements are returned unchanged. */
export function fitBetween<T extends Element>(el: T, spec: NotebookSpec): T {
  if (el.type !== 'text' || el.placement !== 'between') return el
  const max = maxBetweenSize(el, spec)
  return el.sizeDots > max ? { ...el, sizeDots: max } : el
}
