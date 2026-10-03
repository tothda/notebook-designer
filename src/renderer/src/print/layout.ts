import { visiblePages } from '@shared/geometry'
import type { NotebookSpec, PageId, SpreadMode } from '@shared/model'

export type PrintLayout = 'notebook' | 'a4'

export interface PrintOptions {
  layout: PrintLayout
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
 * Lay out notebook pages onto paper at 100% scale.
 * - 'notebook': each page on its own sheet the exact size of the notebook page.
 * - 'a4': the whole spread on one landscape A4 sheet if it fits, otherwise one page per portrait sheet,
 *   with a calibration bar to confirm the printer did not scale.
 */
export function planPrint(spec: NotebookSpec, spread: SpreadMode, layout: PrintLayout): PrintPlan {
  const pages = visiblePages(spread)
  const W = spec.pageWidthMm
  const H = spec.pageHeightMm
  const exact = (fitsA4: boolean): PrintPlan => ({
    fitsA4,
    widthMm: W,
    heightMm: H,
    sheets: pages.map((page) => ({ pages: [{ page, x: 0, y: 0 }], calibration: false }))
  })
  if (layout === 'notebook') return exact(true)

  const fits = (w: number, h: number, sheetW: number, sheetH: number) =>
    w <= sheetW - 2 * SHEET_MARGIN && h <= sheetH - 2 * SHEET_MARGIN - CALIBRATION_SPACE

  const spreadW = W * pages.length
  if (pages.length === 2 && fits(spreadW, H, A4.h, A4.w)) {
    const x0 = (A4.h - spreadW) / 2
    const y0 = SHEET_MARGIN + (A4.w - 2 * SHEET_MARGIN - CALIBRATION_SPACE - H) / 2
    return {
      fitsA4: true,
      widthMm: A4.h,
      heightMm: A4.w,
      sheets: [
        {
          pages: pages.map((page, i) => ({ page, x: x0 + i * W, y: y0 })),
          foldX: x0 + W,
          calibration: true
        }
      ]
    }
  }

  const portrait = fits(W, H, A4.w, A4.h)
  if (!portrait && !fits(W, H, A4.h, A4.w)) return exact(false)
  const sheetW = portrait ? A4.w : A4.h
  const sheetH = portrait ? A4.h : A4.w
  const x0 = (sheetW - W) / 2
  const y0 = Math.max(SHEET_MARGIN, SHEET_MARGIN + (sheetH - 2 * SHEET_MARGIN - CALIBRATION_SPACE - H) / 2)
  return {
    fitsA4: true,
    widthMm: sheetW,
    heightMm: sheetH,
    sheets: pages.map((page) => ({ pages: [{ page, x: x0, y: y0 }], calibration: true }))
  }
}
