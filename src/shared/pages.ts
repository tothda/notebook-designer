import type { Design, PageId, Slot } from './model'

/** Page ids grouped into what is shown together: pairs in 'double' mode, singles otherwise. */
export function spreadsOf(design: Pick<Design, 'pages' | 'spread'>): PageId[][] {
  const ids = design.pages.map((p) => p.id)
  if (design.spread === 'single') return ids.map((id) => [id])
  const groups: PageId[][] = []
  for (let i = 0; i < ids.length; i += 2) groups.push(ids.slice(i, i + 2))
  return groups
}

export function spreadIndexOfPage(design: Pick<Design, 'pages' | 'spread'>, pageId: PageId): number {
  const i = spreadsOf(design).findIndex((g) => g.includes(pageId))
  return Math.max(0, i)
}

export function slotOf(group: PageId[], pageId: PageId): Slot {
  return group.indexOf(pageId) === 1 ? 'right' : 'left'
}

/** Page at a slot of the group; a missing right page falls back to the left one. */
export function pageInSlot(group: PageId[], slot: Slot): PageId {
  return slot === 'right' && group.length > 1 ? group[1] : group[0]
}

/** 1-based page number as written in the notebook. */
export function pageNumber(design: Pick<Design, 'pages'>, pageId: PageId): number {
  return design.pages.findIndex((p) => p.id === pageId) + 1
}

/** "Page 3" or "Pages 3–4" for a spread. */
export function spreadLabel(design: Pick<Design, 'pages'>, group: PageId[]): string {
  const nums = group.map((id) => pageNumber(design, id))
  return nums.length > 1 ? `Pages ${nums[0]}–${nums[nums.length - 1]}` : `Page ${nums[0]}`
}
