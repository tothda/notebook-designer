import { describe, expect, it } from 'vitest'
import { parseDesign } from './file'
import type { Design } from './model'
import { pageInSlot, pageNumber, slotOf, spreadIndexOfPage, spreadLabel, spreadsOf } from './pages'

const design = (n: number, spread: Design['spread'] = 'double') => ({
  pages: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` })),
  spread
})

describe('pages', () => {
  it('pairs pages into spreads, with a lone last page', () => {
    expect(spreadsOf(design(5))).toEqual([['p1', 'p2'], ['p3', 'p4'], ['p5']])
    expect(spreadsOf(design(3, 'single'))).toEqual([['p1'], ['p2'], ['p3']])
  })

  it('finds spreads, slots and numbers', () => {
    const d = design(4)
    expect(spreadIndexOfPage(d, 'p4')).toBe(1)
    expect(slotOf(['p3', 'p4'], 'p4')).toBe('right')
    expect(pageInSlot(['p5'], 'right')).toBe('p5')
    expect(pageNumber(d, 'p3')).toBe(3)
    expect(spreadLabel(d, ['p3', 'p4'])).toBe('Pages 3–4')
    expect(spreadLabel(d, ['p3'])).toBe('Page 3')
  })

  it('opens version 1 files as a single two-page spread', () => {
    const v1 = {
      version: 1,
      spread: 'double',
      elements: [
        { id: 'a', type: 'dot', page: 'left', color: '#000', x: 0, y: 0, sizeMm: 1 },
        { id: 'b', type: 'dot', page: 'right', color: '#000', x: 0, y: 0, sizeMm: 1 }
      ]
    }
    const d = parseDesign(JSON.stringify(v1))
    expect(d.version).toBe(2)
    expect(d.pages).toHaveLength(2)
    expect(d.elements.map((e) => e.page)).toEqual([d.pages[0].id, d.pages[1].id])
  })

  it('moves elements on unknown pages to the first page', () => {
    const d = parseDesign(
      JSON.stringify({
        version: 2,
        pages: [{ id: 'x' }],
        elements: [{ id: 'a', type: 'dot', page: 'gone', color: '#000', x: 0, y: 0, sizeMm: 1 }]
      })
    )
    expect(d.elements[0].page).toBe('x')
  })
})
