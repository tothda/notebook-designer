import { describe, expect, it } from 'vitest'
import { describeElement } from './format'
import { parseDesign } from './file'
import { elementBounds } from './geometry'
import type { TextElement } from './model'
import { NOTEBOOK_PRESETS } from './presets'
import { baselineDots, DEFAULT_METRICS, maxSizeBetween, readingToPage, textVerticalExtent, withPlacement } from './text'

const m = { cap: 0.6, ascent: 0.7, descent: 0.2 }
const text: TextElement = {
  id: 't', type: 'text', page: 'left', color: '#000', x: 2, y: 4, text: 'Mon\nTue', font: 'Caveat',
  bold: false, sizeDots: 0.6, lineHeightDots: 1, align: 'start', placement: 'between', direction: 'horizontal'
}

describe('between-rows text', () => {
  it('centres capital letters in the gap between two dot rows', () => {
    const base = baselineDots(text, 0, m)
    const capTop = base - m.cap * text.sizeDots
    expect((base + capTop) / 2).toBeCloseTo(4.5)
    expect(baselineDots(text, 1, m) - base).toBeCloseTo(1)
  })

  it('keeps ink inside the band when the size fits', () => {
    const max = maxSizeBetween(1, 0.1, m)
    const { top, bottom } = textVerticalExtent({ ...text, text: 'x', sizeDots: max }, m)
    expect(top).toBeGreaterThanOrEqual(4.1 - 1e-9)
    expect(bottom).toBeLessThanOrEqual(4.9 + 1e-9)
  })

  it('bounds cover the bands the text occupies', () => {
    expect(elementBounds(text, () => 3)).toMatchObject({ y: 4, h: 2 })
  })

  it('keeps text in place when switching placement', () => {
    const onRow = withPlacement(text, 'baseline')
    expect(onRow).toMatchObject({ placement: 'baseline', y: 5 })
    expect(withPlacement(onRow, 'between')).toMatchObject({ y: 4 })
    expect(baselineDots(onRow, 0, DEFAULT_METRICS)).toBe(5)
  })

  it('describes the rows to write between', () => {
    expect(describeElement(text, NOTEBOOK_PRESETS[0])).toEqual([
      'Between rows 5 and 6',
      'Starts at col 3',
      '2 lines, one every 1 space',
      'Letter size 0.6 space (3 mm)'
    ])
  })

  it('defaults older saved text to sitting on a row', () => {
    const { placement: _omit, ...old } = text
    const d = parseDesign(JSON.stringify({ version: 1, elements: [old] }))
    expect((d.elements[0] as TextElement).placement).toBe('baseline')
  })
})

describe('vertical text', () => {
  const word = { ...text, text: 'Week', x: 4, y: 2, sizeDots: 1, placement: 'baseline' as const }

  it('maps the reading frame onto the page', () => {
    expect(readingToPage({ x: 4, y: 2, direction: 'down' }, 3, 1)).toEqual({ x: 3, y: 5 })
    expect(readingToPage({ x: 4, y: 2, direction: 'up' }, 3, 1)).toEqual({ x: 5, y: -1 })
  })

  it('turns the bounds with the text', () => {
    // 3 dots long along the line; in the reading frame it spans v = -0.75 .. 0.25.
    const measure = () => 3
    expect(elementBounds({ ...word, direction: 'down' }, measure, () => DEFAULT_METRICS)).toEqual({ x: 3.75, y: 2, w: 1, h: 3 })
    expect(elementBounds({ ...word, direction: 'up' }, measure, () => DEFAULT_METRICS)).toEqual({ x: 3.25, y: -1, w: 1, h: 3 })
  })

  it('places between-rows text between dot columns', () => {
    const down = { ...text, x: 4, y: 2, direction: 'down' as const }
    expect(elementBounds(down, () => 3)).toEqual({ x: 2, y: 2, w: 2, h: 3 })
    expect(describeElement(down, NOTEBOOK_PRESETS[0]).slice(0, 3)).toEqual([
      'Turned to read downward',
      'Between cols 4 and 5',
      'Starts at row 3'
    ])
    expect(describeElement({ ...down, direction: 'up' }, NOTEBOOK_PRESETS[0])[1]).toBe('Between cols 5 and 6')
  })

  it('describes on-row vertical text along a column', () => {
    expect(describeElement({ ...word, direction: 'up' }, NOTEBOOK_PRESETS[0]).slice(0, 2)).toEqual([
      'Turned to read upward',
      'Baseline along col 5, starts at row 3'
    ])
  })

  it('keeps turned text in place when switching placement', () => {
    // Reads down: the line's baseline column x=4 becomes the band between columns 4 and 5 (0-based 3..4).
    const between = withPlacement({ ...word, direction: 'down' }, 'between')
    expect(between).toMatchObject({ x: 5, y: 2 })
    expect(withPlacement(between, 'baseline')).toMatchObject({ x: 4, y: 2 })
  })

  it('defaults older saved text to horizontal', () => {
    const { direction: _omit, ...old } = text
    const d = parseDesign(JSON.stringify({ version: 2, pages: [{ id: 'left' }], elements: [old] }))
    expect((d.elements[0] as TextElement).direction).toBe('horizontal')
  })
})

