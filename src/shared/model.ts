/**
 * Design model.
 *
 * All element coordinates are in *dot units* relative to the first dot of a
 * page: (0, 0) is the top-left dot, (1, 0) the dot to its right. Values may be
 * fractional (half-dot snapping, or free placement with Alt). Physical sizes
 * that do not follow the grid (pen width, dot-mark size) are in millimetres.
 */

export const DESIGN_VERSION = 2

export interface NotebookSpec {
  name: string
  pageWidthMm: number
  pageHeightMm: number
  dotPitchMm: number
  /** Distance from the page's left edge to the first dot column. */
  gridOffsetXMm: number
  /** Distance from the page's top edge to the first dot row. */
  gridOffsetYMm: number
  dotDiameterMm: number
}

/** Stable id of a page; elements refer to their page by id so pages can be reordered. */
export type PageId = string
/** Position of a page within the spread on screen. */
export type Slot = 'left' | 'right'
export type SpreadMode = 'single' | 'double'

export interface Page {
  id: PageId
}
export type Dash = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'start' | 'middle' | 'end'
/**
 * 'baseline': letters stand on a dot row, like writing on a ruled line.
 * 'between': each line is centred in the gap between two dot rows, clear of the dots.
 */
export type TextPlacement = 'baseline' | 'between'
/**
 * 'horizontal': normal text. 'down': turned 90° clockwise, reads top to bottom (like a
 * book spine). 'up': turned 90° anticlockwise, reads bottom to top.
 */
export type TextDirection = 'horizontal' | 'down' | 'up'

interface ElementBase {
  id: string
  page: PageId
  color: string
}

interface Stroked {
  strokeMm: number
  dash: Dash
}

export interface LineElement extends ElementBase, Stroked {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface RectElement extends ElementBase, Stroked {
  type: 'rect'
  x: number
  y: number
  w: number
  h: number
  /** Light highlighter-style fill colour, or null for none. */
  fill: string | null
  radiusDots: number
}

export interface EllipseElement extends ElementBase, Stroked {
  type: 'ellipse'
  x: number
  y: number
  w: number
  h: number
  fill: string | null
}

export interface TextElement extends ElementBase {
  type: 'text'
  /**
   * Horizontal anchor, and the vertical reference: the first baseline row for
   * 'baseline' placement, or the dot row above the first line for 'between'.
   */
  x: number
  y: number
  placement: TextPlacement
  /** Rotated text is laid out as if horizontal, then turned about (x, y). */
  direction: TextDirection
  text: string
  font: string
  bold: boolean
  /** Font size expressed in dot spaces (1 = one dot pitch). */
  sizeDots: number
  /** Distance between consecutive lines, in dot spaces (the band height for 'between'). */
  lineHeightDots: number
  align: TextAlign
}

export interface DotElement extends ElementBase {
  type: 'dot'
  x: number
  y: number
  sizeMm: number
}

export type Element = LineElement | RectElement | EllipseElement | TextElement | DotElement
export type ElementType = Element['type']

export interface Design {
  version: number
  notebook: NotebookSpec
  /**
   * Pages in notebook order. In 'double' mode they pair up into spreads:
   * pages 1–2, 3–4, … (a trailing odd page forms a spread on its own).
   */
  pages: Page[]
  spread: SpreadMode
  palette: string[]
  elements: Element[]
}

export const SPREAD_GAP_MM = 8
