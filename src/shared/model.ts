/**
 * Design model.
 *
 * All element coordinates are in *dot units* relative to the first dot of a
 * page: (0, 0) is the top-left dot, (1, 0) the dot to its right. Values may be
 * fractional (half-dot snapping, or free placement with Alt). Physical sizes
 * that do not follow the grid (pen width, dot-mark size) are in millimetres.
 */

export const DESIGN_VERSION = 1

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

export type PageId = 'left' | 'right'
export type SpreadMode = 'single' | 'double'
export type Dash = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'start' | 'middle' | 'end'

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
  /** Start of the first baseline (sits on a dot row, like writing on a line). */
  x: number
  y: number
  text: string
  font: string
  bold: boolean
  /** Font size expressed in dot spaces (1 = one dot pitch). */
  sizeDots: number
  /** Distance between baselines of consecutive lines, in dot spaces. */
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
  spread: SpreadMode
  palette: string[]
  elements: Element[]
}

export const SPREAD_GAP_MM = 8
