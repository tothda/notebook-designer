import { create } from 'zustand'
import { temporal } from 'zundo'
import { newDesign, newPageId, newPages } from '@shared/file'
import { translateElement } from '@shared/geometry'
import type { Dash, Design, Element, NotebookSpec, PageId, SpreadMode, TextDirection, TextPlacement } from '@shared/model'
import { slotOf, pageInSlot, spreadIndexOfPage, spreadsOf } from '@shared/pages'
import { withPlacement } from '@shared/text'
import { fitBetween } from './measure'
import { DEFAULT_FONT, DEFAULT_PALETTE } from '@shared/palette'

export type Tool = 'select' | 'line' | 'rect' | 'ellipse' | 'text' | 'dot'

export interface Style {
  color: string
  strokeMm: number
  dash: Dash
  fill: string | null
  font: string
  bold: boolean
  sizeDots: number
  textPlacement: TextPlacement
  textDirection: TextDirection
  dotSizeMm: number
}

export type SidebarTab = 'inspector' | 'notebook'

interface EditorState {
  design: Design
  selection: string[]
  tool: Tool
  style: Style
  halfDotSnap: boolean
  zoom: number
  sidebarTab: SidebarTab
  filePath: string | null
  /** The design as last saved/opened; the document is dirty when it differs. */
  savedDesign: Design
  clipboard: Element[]
  /** Last duplicate: lets repeated Cmd+D continue the same step (handy for grids). */
  lastDuplicate: { sourceIds: string[]; copyIds: string[] } | null
  cursor: { page: PageId; x: number; y: number } | null
  printOpen: boolean
  /** Index of the spread (or page, in single mode) shown on the canvas. Not part of undo. */
  currentSpread: number
}

interface EditorActions {
  setTool(tool: Tool): void
  setStyle(patch: Partial<Style>): void
  setZoom(zoom: number): void
  setSidebarTab(tab: SidebarTab): void
  setHalfDotSnap(v: boolean): void
  setCursor(c: EditorState['cursor']): void
  setPrintOpen(v: boolean): void
  select(ids: string[]): void
  addElements(els: Element[], select?: boolean): void
  updateElements(ids: string[], fn: (el: Element) => Element): void
  replaceElements(els: Element[]): void
  deleteSelection(): void
  duplicateSelection(): void
  copySelection(): void
  cutSelection(): void
  paste(): void
  reorderSelection(dir: 1 | -1): void
  setNotebook(spec: NotebookSpec): void
  setSpread(spread: SpreadMode): void
  setPalette(palette: string[]): void
  goToSpread(index: number): void
  addSpread(): void
  duplicateSpread(): void
  deleteSpread(): void
  moveSpread(dir: 1 | -1): void
  loadDesign(design: Design, path: string | null, markSaved: boolean): void
  markSaved(path: string | null): void
}

const initial = newDesign()

const defaultStyle: Style = {
  color: DEFAULT_PALETTE[0],
  strokeMm: 0.3,
  dash: 'solid',
  fill: null,
  font: DEFAULT_FONT,
  bold: false,
  sizeDots: 1,
  textPlacement: 'baseline',
  textDirection: 'horizontal',
  dotSizeMm: 1
}

const withElements = (s: EditorState, elements: Element[]): Pick<EditorState, 'design'> => ({
  design: { ...s.design, elements }
})

export const newId = (): string => crypto.randomUUID()

export const useEditor = create<EditorState & EditorActions>()(
  temporal(
    (set, get) => ({
      design: initial,
      savedDesign: initial,
      selection: [],
      tool: 'select',
      style: defaultStyle,
      halfDotSnap: false,
      zoom: 0,
      sidebarTab: 'inspector',
      filePath: null,
      clipboard: [],
      lastDuplicate: null,
      cursor: null,
      printOpen: false,
      currentSpread: 0,

      // Style changes made with a drawing tool active are meant for the next shape, not the selection.
      setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' ? s.selection : [] })),
      setZoom: (zoom) => set({ zoom }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setHalfDotSnap: (halfDotSnap) => set({ halfDotSnap }),
      setCursor: (cursor) => set({ cursor }),
      setPrintOpen: (printOpen) => set({ printOpen }),

      setStyle: (patch) => {
        set((s) => ({ style: { ...s.style, ...patch } }))
        const { selection } = get()
        if (!selection.length) return
        const spec = get().design.notebook
        // Explicit size changes are respected; otherwise keep between-rows text clear of the dots.
        get().updateElements(selection, (el) => {
          const styled = applyStyle(el, patch)
          return patch.sizeDots === undefined ? fitBetween(styled, spec) : styled
        })
      },

      select: (ids) =>
        set((s) => {
          const first = s.design.elements.find((e) => e.id === ids[0])
          return { selection: ids, style: first ? { ...s.style, ...styleOf(first) } : s.style }
        }),

      addElements: (els, select = true) =>
        set((s) => ({
          ...withElements(s, [...s.design.elements, ...els]),
          ...(select ? { selection: els.map((e) => e.id) } : {})
        })),

      updateElements: (ids, fn) => {
        const idSet = new Set(ids)
        set((s) => withElements(s, s.design.elements.map((el) => (idSet.has(el.id) ? fn(el) : el))))
      },

      replaceElements: (els) => {
        const byId = new Map(els.map((e) => [e.id, e]))
        set((s) => withElements(s, s.design.elements.map((el) => byId.get(el.id) ?? el)))
      },

      deleteSelection: () =>
        set((s) => {
          const sel = new Set(s.selection)
          return { ...withElements(s, s.design.elements.filter((e) => !sel.has(e.id))), selection: [] }
        }),

      duplicateSelection: () => {
        const s = get()
        if (!s.selection.length) return
        const els = s.design.elements
        const byId = new Map(els.map((e) => [e.id, e]))
        // If the selection is the previous duplicate, repeat the offset it was moved by.
        let dx = 1
        let dy = 1
        const last = s.lastDuplicate
        if (last && sameIds(last.copyIds, s.selection)) {
          const src = byId.get(last.sourceIds[0])
          const copy = byId.get(last.copyIds[0])
          if (src && copy && src.page === copy.page) {
            ;[dx, dy] = offsetBetween(src, copy)
          }
        }
        const sources = els.filter((e) => s.selection.includes(e.id))
        const copies = sources.map((e) => ({ ...translateElement(e, dx, dy), id: newId() }))
        set({ lastDuplicate: { sourceIds: s.selection, copyIds: copies.map((c) => c.id) } })
        get().addElements(copies)
      },

      copySelection: () => {
        const s = get()
        set({ clipboard: s.design.elements.filter((e) => s.selection.includes(e.id)) })
      },

      cutSelection: () => {
        get().copySelection()
        get().deleteSelection()
      },

      paste: () => {
        const s = get()
        if (!s.clipboard.length) return
        // Paste onto the spread in view, keeping each element on the same side (left/right).
        const group = currentGroup(s)
        const groups = spreadsOf(s.design)
        const copies = s.clipboard.map((e) => {
          const page = group.includes(e.page)
            ? e.page
            : pageInSlot(group, slotOf(groups.find((g) => g.includes(e.page)) ?? group, e.page))
          return { ...translateElement(e, 1, 1), page, id: newId() }
        })
        set({ clipboard: copies })
        get().addElements(copies)
      },

      reorderSelection: (dir) =>
        set((s) => {
          const sel = new Set(s.selection)
          const els = [...s.design.elements]
          const order = dir === 1 ? [...els.keys()].reverse() : [...els.keys()]
          for (const i of order) {
            const j = i + dir
            if (sel.has(els[i].id) && j >= 0 && j < els.length && !sel.has(els[j].id)) {
              ;[els[i], els[j]] = [els[j], els[i]]
            }
          }
          return withElements(s, els)
        }),

      setNotebook: (notebook) => set((s) => ({ design: { ...s.design, notebook } })),
      setSpread: (spread) =>
        set((s) => {
          // Keep the page that was on the left in view.
          const design = { ...s.design, spread }
          return { design, selection: [], currentSpread: spreadIndexOfPage(design, currentGroup(s)[0]) }
        }),
      setPalette: (palette) => set((s) => ({ design: { ...s.design, palette } })),

      goToSpread: (index) =>
        set((s) => {
          const i = clampIndex(index, spreadsOf(s.design).length)
          return i === s.currentSpread ? {} : { currentSpread: i, selection: [], cursor: null }
        }),

      addSpread: () =>
        set((s) => {
          const group = currentGroup(s)
          const added = newPages(s.design.spread === 'double' ? 2 : 1)
          const pages = insertAfter(s.design.pages, group, added)
          const design = { ...s.design, pages }
          return { design, selection: [], currentSpread: spreadIndexOfPage(design, added[0].id) }
        }),

      duplicateSpread: () =>
        set((s) => {
          const group = currentGroup(s)
          const idMap = new Map(group.map((id) => [id, newPageId()]))
          const added = group.map((id) => ({ id: idMap.get(id)! }))
          const copies = s.design.elements
            .filter((e) => idMap.has(e.page))
            .map((e) => ({ ...e, id: newId(), page: idMap.get(e.page)! }))
          const design = {
            ...s.design,
            pages: insertAfter(s.design.pages, group, added),
            elements: [...s.design.elements, ...copies]
          }
          return { design, selection: [], currentSpread: spreadIndexOfPage(design, added[0].id) }
        }),

      deleteSpread: () =>
        set((s) => {
          const groups = spreadsOf(s.design)
          if (groups.length < 2) return {}
          const gone = new Set(currentGroup(s))
          const design = {
            ...s.design,
            pages: s.design.pages.filter((p) => !gone.has(p.id)),
            elements: s.design.elements.filter((e) => !gone.has(e.page))
          }
          return {
            design,
            selection: [],
            currentSpread: clampIndex(s.currentSpread, spreadsOf(design).length)
          }
        }),

      moveSpread: (dir) =>
        set((s) => {
          const groups = spreadsOf(s.design)
          const i = clampIndex(s.currentSpread, groups.length)
          const j = i + dir
          if (j < 0 || j >= groups.length) return {}
          ;[groups[i], groups[j]] = [groups[j], groups[i]]
          const byId = new Map(s.design.pages.map((p) => [p.id, p]))
          const design = { ...s.design, pages: groups.flat().map((id) => byId.get(id)!) }
          return { design, currentSpread: spreadIndexOfPage(design, groups[j][0]) }
        }),

      loadDesign: (design, path, markSaved) => {
        set({
          currentSpread: 0,
          design,
          filePath: path,
          savedDesign: markSaved ? design : newDesign(),
          selection: [],
          lastDuplicate: null
        })
        useEditor.temporal.getState().clear()
      },

      markSaved: (path) => set((s) => ({ filePath: path, savedDesign: s.design }))
    }),
    {
      partialize: (s) => ({ design: s.design }),
      equality: (a, b) => a.design === b.design,
      limit: 300
    }
  )
)

export const undo = (): void => useEditor.temporal.getState().undo()
export const redo = (): void => useEditor.temporal.getState().redo()

function clampIndex(i: number, length: number): number {
  return Math.min(Math.max(0, i), Math.max(0, length - 1))
}

/** Page ids of the spread in view (clamped, since undo can remove pages). */
export function currentGroup(s: Pick<EditorState, 'design' | 'currentSpread'>): PageId[] {
  const groups = spreadsOf(s.design)
  return groups[clampIndex(s.currentSpread, groups.length)]
}

function insertAfter<T extends { id: string }>(pages: T[], group: PageId[], added: T[]): T[] {
  const last = Math.max(...group.map((id) => pages.findIndex((p) => p.id === id)))
  return [...pages.slice(0, last + 1), ...added, ...pages.slice(last + 1)]
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

function anchor(el: Element): [number, number] {
  return el.type === 'line' ? [el.x1, el.y1] : [el.x, el.y]
}

function offsetBetween(a: Element, b: Element): [number, number] {
  const [ax, ay] = anchor(a)
  const [bx, by] = anchor(b)
  return [bx - ax, by - ay]
}

/** The toolbar style fields an element defines, so the toolbar reflects the selection. */
function styleOf(el: Element): Partial<Style> {
  switch (el.type) {
    case 'line':
      return { color: el.color, strokeMm: el.strokeMm, dash: el.dash }
    case 'rect':
    case 'ellipse':
      return { color: el.color, strokeMm: el.strokeMm, dash: el.dash, fill: el.fill }
    case 'text':
      return { color: el.color, font: el.font, bold: el.bold, sizeDots: el.sizeDots, textPlacement: el.placement, textDirection: el.direction }
    case 'dot':
      return { color: el.color, dotSizeMm: el.sizeMm }
  }
}

/** Apply the relevant parts of a toolbar style change to an existing element. */
function applyStyle(el: Element, p: Partial<Style>): Element {
  const next: Record<string, unknown> = { ...el }
  if (p.color !== undefined) next.color = p.color
  if (el.type === 'line' || el.type === 'rect' || el.type === 'ellipse') {
    if (p.strokeMm !== undefined) next.strokeMm = p.strokeMm
    if (p.dash !== undefined) next.dash = p.dash
  }
  if ((el.type === 'rect' || el.type === 'ellipse') && p.fill !== undefined) next.fill = p.fill
  if (el.type === 'text') {
    if (p.font !== undefined) next.font = p.font
    if (p.bold !== undefined) next.bold = p.bold
    if (p.sizeDots !== undefined) next.sizeDots = p.sizeDots
    // Turning text keeps its anchor (start of the first line) in place.
    if (p.textDirection !== undefined) next.direction = p.textDirection
    if (p.textPlacement !== undefined) return withPlacement(next as unknown as typeof el, p.textPlacement)
  }
  if (el.type === 'dot' && p.dotSizeMm !== undefined) next.sizeMm = p.dotSizeMm
  return next as unknown as Element
}

export const isDirty = (s: Pick<EditorState, 'design' | 'savedDesign'>): boolean => s.design !== s.savedDesign
