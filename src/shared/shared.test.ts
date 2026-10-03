import { describe, expect, it } from 'vitest'
import { describeElement, formatDot, formatSpaces } from './format'
import { DesignParseError, newDesign, parseDesign, serializeDesign } from './file'
import { dotToMmX, elementBounds, fitsOnPage, gridSize, mmToDotX, pageAtMm, snap } from './geometry'
import { centeredOffset, NOTEBOOK_PRESETS } from './presets'
import type { LineElement, RectElement } from './model'

const spec = NOTEBOOK_PRESETS[0] // Moleskine Pocket 90×140, 5 mm

describe('presets', () => {
  it('centres the grid on the page', () => {
    expect(centeredOffset(90, 5)).toBe(2.5)
    expect(centeredOffset(92, 5)).toBe(3.5)
    expect(gridSize(spec)).toEqual({ cols: 18, rows: 28 })
  })
})

describe('geometry', () => {
  it('converts dots and millimetres both ways', () => {
    expect(dotToMmX(spec, 0)).toBe(2.5)
    expect(dotToMmX(spec, 10) - dotToMmX(spec, 0)).toBe(50)
    expect(mmToDotX(spec, dotToMmX(spec, 7.5))).toBeCloseTo(7.5)
  })

  it('snaps to whole and half dots', () => {
    expect(snap(3.3, 1)).toBe(3)
    expect(snap(3.3, 0.5)).toBe(3.5)
    expect(snap(3.3, 0)).toBe(3.3)
  })

  it('assigns spread positions to pages', () => {
    expect(pageAtMm(spec, 'double', 10)).toBe('left')
    expect(pageAtMm(spec, 'double', 120)).toBe('right')
    expect(pageAtMm(spec, 'single', 120)).toBe('left')
  })

  it('detects elements running off the paper', () => {
    const r: RectElement = {
      id: 'a', type: 'rect', page: 'left', color: '#000', strokeMm: 0.3, dash: 'solid',
      x: 0, y: 0, w: 17, h: 27, fill: null, radiusDots: 0
    }
    expect(fitsOnPage(spec, elementBounds(r))).toBe(true)
    expect(fitsOnPage(spec, elementBounds({ ...r, w: 18 }))).toBe(false)
    expect(fitsOnPage(spec, elementBounds({ ...r, x: -1 }))).toBe(false)
  })
})

describe('format', () => {
  it('numbers dots from 1 as counted on paper', () => {
    expect(formatDot(0)).toBe('1')
    expect(formatDot(2.5)).toBe('3½')
    expect(formatSpaces(12)).toBe('12')
    expect(formatSpaces(0.5)).toBe('½')
  })

  it('describes a line for copying', () => {
    const l: LineElement = {
      id: 'l', type: 'line', page: 'left', color: '#000', strokeMm: 0.3, dash: 'solid',
      x1: 2, y1: 4, x2: 12, y2: 4
    }
    expect(describeElement(l, spec)).toEqual([
      'From col 3, row 5',
      'To col 13, row 5',
      'Horizontal, 10 spaces (50 mm)'
    ])
  })
})

describe('file', () => {
  it('round-trips a design', () => {
    const d = newDesign()
    d.elements.push({ id: 'x', type: 'dot', page: 'right', color: '#c8312b', x: 1, y: 2, sizeMm: 1 })
    expect(parseDesign(serializeDesign(d))).toEqual(d)
  })

  it('rejects invalid files', () => {
    expect(() => parseDesign('nope')).toThrow(DesignParseError)
    expect(() => parseDesign('{"version": 99}')).toThrow(/newer version/)
    expect(() => parseDesign('{"version": 1, "elements": [{"type": "blob", "id": "1"}]}')).toThrow(DesignParseError)
  })
})
