import type { Design, NotebookSpec, PageId } from '@shared/model'
import { spreadsOf } from '@shared/pages'

export type PrintLayout = 'notebook' | 'a4'

export type PrintScope = 'all' | 'current'

export interface PrintOptions {
  layout: PrintLayout
  scope: PrintScope
  showDots: boolean
  showBorder: boolean
}

export interface PlacedPage {
  page: PageId
  /** Position of the page's top-left corner on the sheet, in mm. */
  x: number
  y: number
}

export interface Sheet {
  pages: PlacedPage[]
  /** Fold line x-position for a spread on one sheet. */
  foldX?: number
  calibration: boolean
}

export interface PrintPlan {
  /** False when the A4 layout was requested but the page is too large for A4. */
  fitsA4: boolean
  widthMm: number
  heightMm: number
  sheets: Sheet[]
}

const A4 = { w: 210, h: 297 }
const SHEET_MARGIN = 12
/** Space reserved at the bottom of A4 sheets for the calibration bar. */
const CALIBRATION_SPACE = 18

/**
 * Lay out notebook pages onto paper at 100% scale. `spreads` are the page ids to print,
 * grouped as shown on screen (pairs for a two-page spread).
 * - 'notebook': each page on its own sheet the exact size of the notebook page.
 * - 'a4': each spread on one landscape A4 sheet if it fits, otherwise one page per sheet,
 *   with a calibration bar to confirm the printer did not scale.
 */
export function planPrint(spec: NotebookSpec, spreads: PageId[][], layout: PrintLayout): PrintPlan {
  const W = spec.pageWidthMm
  const H = spec.pageHeightMm
  const pages = spreads.flat()
  const exact = (fitsA4: boolean): PrintPlan => ({
    fitsA4,
    widthMm: W,
    heightMm: H,
    sheets: pages.map((page) => ({ pages: [{ page, x: 0, y: 0 }], calibration: false }))
  })
  if (layout === 'notebook') return exact(true)

  const fits = (w: number, h: number, sheetW: number, sheetH: number) =>
    w <= sheetW - 2 * SHEET_MARGIN && h <= sheetH - 2 * SHEET_MARGIN - CALIBRATION_SPACE
  const centredY = (sheetH: number) =>
    Math.max(SHEET_MARGIN, SHEET_MARGIN + (sheetH - 2 * SHEET_MARGIN - CALIBRATION_SPACE - H) / 2)

  // Two-page spreads side by side on landscape A4, like the open notebook.
  if (spreads.some((g) => g.length === 2) && fits(W * 2, H, A4.h, A4.w)) {
    const x0 = (A4.h - W * 2) / 2
    const y0 = centredY(A4.w)
    return {
      fitsA4: true,
      widthMm: A4.h,
      heightMm: A4.w,
      sheets: spreads.map((group) => ({
        pages: group.map((page, i) => ({ page, x: x0 + i * W, y: y0 })),
        foldX: group.length === 2 ? x0 + W : undefined,
        calibration: true
      }))
    }
  }

  const portrait = fits(W, H, A4.w, A4.h)
  if (!portrait && !fits(W, H, A4.h, A4.w)) return exact(false)
  const sheetW = portrait ? A4.w : A4.h
  const sheetH = portrait ? A4.h : A4.w
  const x0 = (sheetW - W) / 2
  const y0 = centredY(sheetH)
  return {
    fitsA4: true,
    widthMm: sheetW,
    heightMm: sheetH,
    sheets: pages.map((page) => ({ pages: [{ page, x: x0, y: y0 }], calibration: true }))
  }
}

/** The spreads a print job covers. */
export function spreadsToPrint(design: Design, current: PageId[], scope: PrintScope): PageId[][] {
  return scope === 'current' ? [current] : spreadsOf(design)
}
