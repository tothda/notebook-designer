import { create } from 'zustand'
import { temporal } from 'zundo'
import { newDesign } from '@shared/file'
import { translateElement } from '@shared/geometry'
import type { Dash, Design, Element, NotebookSpec, SpreadMode } from '@shared/model'
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
  cursor: { page: string; x: number; y: number } | null
  printOpen: boolean
  textFocusRequested: boolean
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
  loadDesign(design: Design, path: string | null, markSaved: boolean): void
  markSaved(path: string | null): void
  focusText(): void
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
      textFocusRequested: false,

      // Style changes made with a drawing tool active are meant for the next shape, not the selection.
      setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' ? s.selection : [] })),
      setZoom: (zoom) => set({ zoom }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setHalfDotSnap: (halfDotSnap) => set({ halfDotSnap }),
      setCursor: (cursor) => set({ cursor }),
      setPrintOpen: (printOpen) => set({ printOpen }),
      focusText: () => set({ textFocusRequested: true, sidebarTab: 'inspector' }),

      setStyle: (patch) => {
        set((s) => ({ style: { ...s.style, ...patch } }))
        const { selection } = get()
        if (selection.length) get().updateElements(selection, (el) => applyStyle(el, patch))
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
        const { clipboard } = get()
        if (!clipboard.length) return
        const copies = clipboard.map((e) => ({ ...translateElement(e, 1, 1), id: newId() }))
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
        set((s) => ({
          design: { ...s.design, spread },
          selection: spread === 'single' ? s.selection.filter((id) => pageOf(s, id) === 'left') : s.selection
        })),
      setPalette: (palette) => set((s) => ({ design: { ...s.design, palette } })),

      loadDesign: (design, path, markSaved) => {
        set({
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

function pageOf(s: EditorState, id: string): string | undefined {
  return s.design.elements.find((e) => e.id === id)?.page
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
      return { color: el.color, font: el.font, bold: el.bold, sizeDots: el.sizeDots }
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
  }
  if (el.type === 'dot' && p.dotSizeMm !== undefined) next.sizeMm = p.dotSizeMm
  return next as unknown as Element
}

export const isDirty = (s: Pick<EditorState, 'design' | 'savedDesign'>): boolean => s.design !== s.savedDesign
