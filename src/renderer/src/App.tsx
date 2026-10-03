import { useEffect, useState } from 'react'
import { DesignParseError, parseDesign, serializeDesign, newDesign } from '@shared/file'
import type { MenuCommand } from '@shared/ipc'
import type { Design } from '@shared/model'
import { SpreadView } from './canvas/SpreadView'
import { Inspector } from './panels/Inspector'
import { NotebookSettings } from './panels/NotebookSettings'
import { StatusBar } from './panels/StatusBar'
import { Toolbar } from './panels/Toolbar'
import { PrintDialog } from './print/PrintDialog'
import { PrintView } from './print/PrintView'
import type { PrintOptions } from './print/layout'
import { isDirty, redo, undo, useEditor, type Tool } from './store'
import { translateElement } from '@shared/geometry'

const TOOL_KEYS: Record<string, Tool> = { v: 'select', l: 'line', r: 'rect', o: 'ellipse', t: 'text', d: 'dot' }

interface Autosave {
  path: string | null
  dirty: boolean
  design: Design
}

export function App() {
  const sidebarTab = useEditor((s) => s.sidebarTab)
  const printOpen = useEditor((s) => s.printOpen)
  const filePath = useEditor((s) => s.filePath)
  const dirty = useEditor(isDirty)
  const [printOptions, setPrintOptions] = useState<PrintOptions>({ layout: 'a4', showDots: true, showBorder: true })
  const [restored, setRestored] = useState(false)
  const name = fileTitle(filePath)

  useEffect(() => {
    document.title = `${name}${dirty ? ' (edited)' : ''} — Notebook Designer`
  }, [name, dirty])

  // Restore the last session, then autosave every change.
  useEffect(() => {
    void window.api.autosaveRead().then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Autosave
          const design = parseDesign(JSON.stringify(saved.design))
          useEditor.getState().loadDesign(design, saved.path, !saved.dirty)
        } catch {
          // Ignore a corrupt autosave and start fresh.
        }
      }
      setRestored(true)
    })
  }, [])

  useEffect(() => {
    if (!restored) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.design === prev.design && s.filePath === prev.filePath && s.savedDesign === prev.savedDesign) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const cur = useEditor.getState()
        const payload: Autosave = { path: cur.filePath, dirty: isDirty(cur), design: cur.design }
        void window.api.autosaveWrite(JSON.stringify(payload))
      }, 600)
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [restored])

  // Menu commands and files opened from the main process.
  useEffect(() => {
    const offMenu = window.api.onMenu((cmd) => void handleMenu(cmd))
    const offFile = window.api.onFileLoaded(({ path, content }) => {
      if (!confirmDiscard()) return
      try {
        useEditor.getState().loadDesign(parseDesign(content), path, true)
      } catch (err) {
        alert(`Could not open ${path}:\n${err instanceof DesignParseError ? err.message : String(err)}`)
      }
    })
    return () => {
      offMenu()
      offFile()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKey(e)
    const clip = (fn: () => void) => (e: ClipboardEvent) => {
      if (isEditingText()) return
      e.preventDefault()
      fn()
    }
    const onCopy = clip(() => useEditor.getState().copySelection())
    const onCut = clip(() => useEditor.getState().cutSelection())
    const onPaste = clip(() => useEditor.getState().paste())
    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
  }, [])

  return (
    <>
      <div className="app">
        <Toolbar />
        <main className="workspace">
          <SpreadView />
          <aside className="sidebar">
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={sidebarTab === 'inspector'}
                className={sidebarTab === 'inspector' ? 'active' : ''}
                onClick={() => useEditor.getState().setSidebarTab('inspector')}
              >
                Selection
              </button>
              <button
                role="tab"
                aria-selected={sidebarTab === 'notebook'}
                className={sidebarTab === 'notebook' ? 'active' : ''}
                onClick={() => useEditor.getState().setSidebarTab('notebook')}
              >
                Notebook
              </button>
            </div>
            {sidebarTab === 'inspector' ? <Inspector /> : <NotebookSettings />}
          </aside>
        </main>
        <StatusBar />
        {printOpen && <PrintDialog options={printOptions} onChange={setPrintOptions} defaultName={name} />}
      </div>
      <PrintView options={printOptions} />
    </>
  )
}

function fileTitle(path: string | null): string {
  if (!path) return 'Untitled'
  return path.split(/[\\/]/).pop()!.replace(/\.nbdesign$/, '')
}

function confirmDiscard(): boolean {
  return !isDirty(useEditor.getState()) || confirm('Discard unsaved changes to the current design?')
}

function isEditingText(): boolean {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
}

async function save(as: boolean): Promise<void> {
  const s = useEditor.getState()
  const path = await window.api.saveFile(as ? null : s.filePath, serializeDesign(s.design), fileTitle(s.filePath))
  // Only mark saved if nothing changed while the dialog was open.
  if (path && useEditor.getState().design === s.design) useEditor.getState().markSaved(path)
  else if (path) useEditor.setState({ filePath: path })
}

async function handleMenu(cmd: MenuCommand): Promise<void> {
  const s = useEditor.getState()
  const editing = isEditingText()
  switch (cmd) {
    case 'new':
      if (confirmDiscard()) s.loadDesign({ ...newDesign(), notebook: s.design.notebook, spread: s.design.spread }, null, true)
      break
    case 'save':
      return save(false)
    case 'saveAs':
      return save(true)
    case 'exportPdf':
    case 'print':
      s.setPrintOpen(true)
      break
    case 'undo':
      if (editing) document.execCommand('undo')
      else undo()
      break
    case 'redo':
      if (editing) document.execCommand('redo')
      else redo()
      break
    case 'selectAll':
      if (editing) (document.activeElement as HTMLInputElement).select()
      else s.select(s.design.elements.filter((e) => s.design.spread === 'double' || e.page === 'left').map((e) => e.id))
      break
    case 'duplicate':
      if (!editing) s.duplicateSelection()
      break
    case 'bringForward':
      s.reorderSelection(1)
      break
    case 'sendBackward':
      s.reorderSelection(-1)
      break
    case 'zoomIn':
      s.setZoom(Math.min(40, s.zoom * 1.25))
      break
    case 'zoomOut':
      s.setZoom(Math.max(1, s.zoom / 1.25))
      break
    case 'zoomFit':
      s.setZoom(0)
      break
  }
}

function handleKey(e: KeyboardEvent): void {
  const s = useEditor.getState()
  if (e.key === 'Escape') {
    if (s.printOpen) s.setPrintOpen(false)
    else if (isEditingText()) (document.activeElement as HTMLElement).blur()
    else {
      s.select([])
      s.setTool('select')
    }
    return
  }
  if (isEditingText() || s.printOpen || e.metaKey || e.ctrlKey) return

  const tool = TOOL_KEYS[e.key.toLowerCase()]
  if (tool && !e.altKey) {
    s.setTool(tool)
    e.preventDefault()
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length) {
    s.deleteSelection()
    e.preventDefault()
    return
  }
  const arrows: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  }
  const dir = arrows[e.key]
  if (dir && s.selection.length) {
    const step = e.shiftKey ? 5 : e.altKey || s.halfDotSnap ? 0.5 : 1
    s.updateElements(s.selection, (el) => translateElement(el, dir[0] * step, dir[1] * step))
    e.preventDefault()
  }
}
