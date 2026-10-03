import { describe, expect, it } from 'vitest'
import { NOTEBOOK_PRESETS } from '@shared/presets'
import { planPrint } from './layout'

const pocket = NOTEBOOK_PRESETS[0] // 90×140
const large = NOTEBOOK_PRESETS[1] // 130×210
const xl = NOTEBOOK_PRESETS[2] // 190×250

describe('planPrint', () => {
  it('prints each page at exact notebook size', () => {
    const plan = planPrint(pocket, 'double', 'notebook')
    expect(plan).toMatchObject({ widthMm: 90, heightMm: 140 })
    expect(plan.sheets).toHaveLength(2)
  })

  it('fits a pocket spread on one landscape A4 sheet with a fold line', () => {
    const plan = planPrint(pocket, 'double', 'a4')
    expect(plan).toMatchObject({ widthMm: 297, heightMm: 210 })
    expect(plan.sheets).toHaveLength(1)
    expect(plan.sheets[0].foldX).toBeCloseTo(297 / 2)
  })

  it('falls back to one page per sheet for large notebooks', () => {
    const plan = planPrint(large, 'double', 'a4')
    expect(plan.sheets).toHaveLength(2)
    expect(plan).toMatchObject({ widthMm: 210, heightMm: 297, fitsA4: true })
  })

  it('reports pages too large for A4', () => {
    const plan = planPrint(xl, 'double', 'a4')
    expect(plan).toMatchObject({ fitsA4: false, widthMm: 190, heightMm: 250 })
  })
})
