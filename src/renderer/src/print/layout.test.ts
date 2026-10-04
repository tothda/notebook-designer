import { describe, expect, it } from 'vitest'
import { NOTEBOOK_PRESETS } from '@shared/presets'
import { planPrint } from './layout'

const pocket = NOTEBOOK_PRESETS[0] // 90×140
const large = NOTEBOOK_PRESETS[1] // 130×210
const xl = NOTEBOOK_PRESETS[2] // 190×250

const pair = [['p1', 'p2']]
const two = [['p1', 'p2'], ['p3', 'p4']]

describe('planPrint', () => {
  it('prints each page at exact notebook size', () => {
    const plan = planPrint(pocket, pair, 'notebook')
    expect(plan).toMatchObject({ widthMm: 90, heightMm: 140 })
    expect(plan.sheets).toHaveLength(2)
  })

  it('fits a pocket spread on one landscape A4 sheet with a fold line', () => {
    const plan = planPrint(pocket, pair, 'a4')
    expect(plan).toMatchObject({ widthMm: 297, heightMm: 210 })
    expect(plan.sheets).toHaveLength(1)
    expect(plan.sheets[0].foldX).toBeCloseTo(297 / 2)
  })

  it('falls back to one page per sheet for large notebooks', () => {
    const plan = planPrint(large, pair, 'a4')
    expect(plan.sheets).toHaveLength(2)
    expect(plan).toMatchObject({ widthMm: 210, heightMm: 297, fitsA4: true })
  })

  it('reports pages too large for A4', () => {
    const plan = planPrint(xl, pair, 'a4')
    expect(plan).toMatchObject({ fitsA4: false, widthMm: 190, heightMm: 250 })
  })

  it('prints one A4 sheet per spread, including a lone last page', () => {
    const plan = planPrint(pocket, [...two, ['p5']], 'a4')
    expect(plan.sheets.map((s) => s.pages.map((p) => p.page))).toEqual([['p1', 'p2'], ['p3', 'p4'], ['p5']])
    expect(plan.sheets[2].foldX).toBeUndefined()
  })

  it('prints every page at exact size across spreads', () => {
    expect(planPrint(pocket, two, 'notebook').sheets).toHaveLength(4)
  })
})
