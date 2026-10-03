import { elementBounds, type Rect } from '@shared/geometry'
import type { Element } from '@shared/model'

let ctx: CanvasRenderingContext2D | null = null

/** Width of a text line in dot units, using the real font metrics. */
export function measureTextDots(text: string, font: string, bold: boolean, sizeDots: number): number {
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * sizeDots * 0.45
  ctx.font = `${bold ? 700 : 400} 100px "${font}"`
  return (ctx.measureText(text).width / 100) * sizeDots
}

export function boundsOf(el: Element): Rect {
  return elementBounds(el, measureTextDots)
}
