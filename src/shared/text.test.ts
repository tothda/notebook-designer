import { describe, expect, it } from 'vitest'
import { describeElement } from './format'
import { parseDesign } from './file'
import { elementBounds } from './geometry'
import type { TextElement } from './model'
import { NOTEBOOK_PRESETS } from './presets'
import { baselineDots, DEFAULT_METRICS, maxSizeBetween, textVerticalExtent, withPlacement } from './text'

const m = { cap: 0.6, ascent: 0.7, descent: 0.2 }
const text: TextElement = {
  id: 't', type: 'text', page: 'left', color: '#000', x: 2, y: 4, text: 'Mon\nTue', font: 'Caveat',
  bold: false, sizeDots: 0.6, lineHeightDots: 1, align: 'start', placement: 'between'
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
