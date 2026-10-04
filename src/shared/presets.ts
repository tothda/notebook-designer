import type { NotebookSpec } from './model'

/** Offset that centres a grid of whole dot spaces on a page dimension. */
export function centeredOffset(lengthMm: number, pitchMm: number): number {
  const spaces = Math.floor(lengthMm / pitchMm + 1e-9) - 1
  return round2((lengthMm - Math.max(spaces, 0) * pitchMm) / 2)
}

/** Offset that centres a grid of exactly `dots` dots on a page dimension. */
function offsetForDots(lengthMm: number, pitchMm: number, dots: number): number {
  return round2((lengthMm - (dots - 1) * pitchMm) / 2)
}

/**
 * `dots` gives the known dots across and down; without it the grid is
 * centred with as many dots as fit.
 */
function preset(
  name: string,
  w: number,
  h: number,
  dots?: { cols: number; rows: number },
  pitch = 5,
  dot = 0.5
): NotebookSpec {
  return {
    name,
    pageWidthMm: w,
    pageHeightMm: h,
    dotPitchMm: pitch,
    gridOffsetXMm: dots ? offsetForDots(w, pitch, dots.cols) : centeredOffset(w, pitch),
    gridOffsetYMm: dots ? offsetForDots(h, pitch, dots.rows) : centeredOffset(h, pitch),
    dotDiameterMm: dot
  }
}

/**
 * Starting points only: measure your own notebook (page size, dot pitch and
 * where the first dot sits) and adjust in Notebook settings.
 */
export const NOTEBOOK_PRESETS: NotebookSpec[] = [
  preset('Moleskine Pocket (A6) dotted', 90, 140, { cols: 17, rows: 27 }),
  preset('Moleskine Large (A5) dotted', 130, 210, { cols: 25, rows: 41 }),
  preset('Moleskine XL dotted', 190, 250),
  preset('Leuchtturm1917 Pocket (A6) dotted', 90, 150),
  preset('Leuchtturm1917 Medium (A5) dotted', 145, 210),
  preset('Generic A6 dotted', 105, 148),
  preset('Generic A5 dotted', 148, 210)
]

export const DEFAULT_NOTEBOOK = NOTEBOOK_PRESETS[0]

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
