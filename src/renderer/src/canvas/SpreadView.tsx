import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  fitsOnPage,
  gridSize,
  mmToDotX,
  mmToDotY,
  normalizeRect,
  pageOriginMm,
  pageShiftDots,
  rectsIntersect,
  slotAtMm,
  snap,
  spreadWidthMm,
  translateElement,
  type Rect
} from '@shared/geometry'
import type { Element, NotebookSpec, PageId, Slot, TextElement } from '@shared/model'
import { pageInSlot, slotOf } from '@shared/pages'
import { boundsOf, fitBetween } from '../measure'
import { currentGroup, newId, useEditor, type Style, type Tool } from '../store'
import { ElementShape, PageBackground } from './ElementShape'
import { InlineTextEditor } from './InlineTextEditor'

/** Space around the spread for rulers, in mm. */
const MARGIN_MM = 14
const MIN_ZOOM = 1
const MAX_ZOOM = 40
const SELECT_COLOR = '#2f7cf6'

interface Pt {
  x: number
  y: number
}

type Handle = 'p1' | 'p2' | 'nw' | 'ne' | 'sw' | 'se'

type Drag =
  | { kind: 'create'; tool: Tool; page: PageId; start: Pt; current: Pt; square: boolean }
  | { kind: 'move'; startMm: Pt; ids: string[]; dx: number; dy: number; step: number }
  | { kind: 'handle'; id: string; handle: Handle; current: Pt; square: boolean }
  | { kind: 'marquee'; startMm: Pt; currentMm: Pt; base: string[] }

export function SpreadView() {
  const design = useEditor((s) => s.design)
  const selection = useEditor((s) => s.selection)
  const tool = useEditor((s) => s.tool)
  const style = useEditor((s) => s.style)
  const zoom = useEditor((s) => s.zoom)
  const halfDotSnap = useEditor((s) => s.halfDotSnap)
  const cursor = useEditor((s) => s.cursor)
  const currentSpread = useEditor((s) => s.currentSpread)
  const spec = design.notebook
  /** Ids of the pages in view: [left] or [left, right]. */
  const group = useMemo(
    () => currentGroup({ design, currentSpread }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [design.pages, design.spread, currentSpread]
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const zoomAnchor = useRef<{ mm: Pt; client: Pt } | null>(null)
  /** Element under the last pointer press; double-clicks land on the SVG due to pointer capture. */
  const lastPressedId = useRef<string | null>(null)
  /** Text being edited in place. The draft is committed as one undo step when editing ends. */
  const [editing, setEditing] = useState<{ id: string; text: string; isNew: boolean } | null>(null)
  const [selectAllRequest, setSelectAllRequest] = useState(0)

  const totalW = spreadWidthMm(spec, group.length) + MARGIN_MM * 2
  const totalH = spec.pageHeightMm + MARGIN_MM * 2
  const pageAt = (xMm: number): PageId => pageInSlot(group, slotAtMm(spec, group.length, xMm))
  const originOf = (page: PageId) => pageOriginMm(spec, slotOf(group, page))

  const updateDrag = (d: Drag | null) => {
    dragRef.current = d
    setDrag(d)
  }

  // ---- zoom -------------------------------------------------------------

  const fit = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const z = Math.min((el.clientWidth - 48) / totalW, (el.clientHeight - 48) / totalH)
    useEditor.getState().setZoom(clampZoom(z))
  }, [totalW, totalH])

  useEffect(() => {
    if (zoom === 0) fit()
  }, [zoom, fit])

  // Re-fit when the paper size or spread mode changes.
  useEffect(() => {
    fit()
  }, [spec.pageWidthMm, spec.pageHeightMm, group.length, fit])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const svg = svgRef.current
      const z = useEditor.getState().zoom
      if (!svg || !z) return
      zoomAnchor.current = { mm: clientToMm(svg, e.clientX, e.clientY), client: { x: e.clientX, y: e.clientY } }
      useEditor.getState().setZoom(clampZoom(z * Math.exp(-e.deltaY * 0.01)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keep the point under the cursor fixed while pinch-zooming.
  useLayoutEffect(() => {
    const a = zoomAnchor.current
    const svg = svgRef.current
    const scroller = scrollRef.current
    if (!a || !svg || !scroller) return
    zoomAnchor.current = null
    const now = mmToClient(svg, a.mm)
    scroller.scrollLeft += now.x - a.client.x
    scroller.scrollTop += now.y - a.client.y
  }, [zoom])

  // ---- coordinates -------------------------------------------------------

  const stepFor = (e: { altKey: boolean }) => (e.altKey ? 0 : halfDotSnap ? 0.5 : 1)

  const eventMm = (e: React.PointerEvent): Pt => clientToMm(svgRef.current!, e.clientX, e.clientY)

  const pageDots = (mm: Pt, page: PageId, step: number): Pt => ({
    x: snap(mmToDotX(spec, mm.x - originOf(page)), step),
    y: snap(mmToDotY(spec, mm.y), step)
  })

  // ---- preview of in-progress edits ---------------------------------------

  const preview = useMemo(() => {
    const p = buildPreview(design.elements, drag, style)
    if (!editing) return p
    return {
      ...p,
      elements: p.elements.map((el) => (el.id === editing.id && el.type === 'text' ? { ...el, text: editing.text } : el))
    }
  }, [design.elements, drag, style, editing])

  const startEditing = (el: Element, isNew = false) => {
    if (el.type !== 'text') return
    useEditor.getState().select([el.id])
    setEditing({ id: el.id, text: el.text, isNew })
  }

  const finishEditing = () => {
    if (!editing) return
    setEditing(null)
    const store = useEditor.getState()
    const original = store.design.elements.find((e) => e.id === editing.id)
    if (!original || original.type !== 'text') return
    if (editing.text.trim() === '') {
      store.select([editing.id])
      store.deleteSelection()
    } else if (editing.text !== original.text) {
      store.updateElements([editing.id], (e) => ({ ...e, text: editing.text }) as Element)
    }
  }

  // ---- pointer handlers ---------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const svg = svgRef.current!
    svg.setPointerCapture(e.pointerId)
    const mm = eventMm(e)
    const page = pageAt(mm.x)
    const step = stepFor(e)
    const pt = pageDots(mm, page, step)
    const store = useEditor.getState()

    if (tool === 'select') {
      lastPressedId.current = null
      updateDrag({ kind: 'marquee', startMm: mm, currentMm: mm, base: e.shiftKey ? store.selection : [] })
      if (!e.shiftKey) store.select([])
      return
    }
    if (tool === 'dot') {
      store.addElements([{ id: newId(), type: 'dot', page, color: style.color, x: pt.x, y: pt.y, sizeMm: style.dotSizeMm }])
      return
    }
    if (tool === 'text') {
      // Keep the browser from moving focus to the page, which would end in-place editing at once.
      e.preventDefault()
      const textEl: TextElement = {
        id: newId(),
        type: 'text',
        page,
        color: style.color,
        ...newTextAnchor(style, { x: mmToDotX(spec, mm.x - originOf(page)), y: mmToDotY(spec, mm.y) }, pt, step),
        placement: style.textPlacement,
        direction: style.textDirection,
        text: 'Text',
        font: style.font,
        bold: style.bold,
        sizeDots: style.sizeDots,
        lineHeightDots: Math.max(1, Math.ceil(style.sizeDots)),
        align: 'start'
      }
      store.addElements([fitBetween(textEl, spec)])
      store.setTool('select')
      startEditing(textEl, true)
      return
    }
    updateDrag({ kind: 'create', tool, page, start: pt, current: pt, square: e.shiftKey })
  }

  const onElementPointerDown = (e: React.PointerEvent, el: Element) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    lastPressedId.current = el.id
    svgRef.current!.setPointerCapture(e.pointerId)
    const store = useEditor.getState()
    let ids = store.selection
    if (e.shiftKey) {
      ids = ids.includes(el.id) ? ids.filter((i) => i !== el.id) : [...ids, el.id]
      store.select(ids)
      if (!ids.includes(el.id)) return
    } else if (!ids.includes(el.id)) {
      ids = [el.id]
      store.select(ids)
    }
    updateDrag({ kind: 'move', startMm: eventMm(e), ids, dx: 0, dy: 0, step: stepFor(e) })
  }

  const onHandlePointerDown = (e: React.PointerEvent, id: string, handle: Handle) => {
    if (e.button !== 0) return
    e.stopPropagation()
    svgRef.current!.setPointerCapture(e.pointerId)
    const el = design.elements.find((x) => x.id === id)!
    updateDrag({ kind: 'handle', id, handle, current: handlePoint(el, handle), square: e.shiftKey })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const mm = eventMm(e)
    const step = stepFor(e)
    const hoverPage = pageAt(mm.x)
    const hover = pageDots(mm, hoverPage, step === 0 ? 0.5 : step)
    useEditor.getState().setCursor({ page: hoverPage, x: hover.x, y: hover.y })

    const d = dragRef.current
    if (!d) return
    switch (d.kind) {
      case 'create':
        updateDrag({ ...d, current: pageDots(mm, d.page, step), square: e.shiftKey })
        break
      case 'move': {
        let dx = snap((mm.x - d.startMm.x) / spec.dotPitchMm, step)
        let dy = snap((mm.y - d.startMm.y) / spec.dotPitchMm, step)
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        updateDrag({ ...d, dx, dy, step })
        break
      }
      case 'handle': {
        const el = design.elements.find((x) => x.id === d.id)
        if (el) updateDrag({ ...d, current: pageDots(mm, el.page, step), square: e.shiftKey })
        break
      }
      case 'marquee': {
        updateDrag({ ...d, currentMm: mm })
        useEditor.getState().select(marqueeSelection(design.elements, spec, group, d.startMm, mm, d.base))
        break
      }
    }
  }

  const onPointerUp = () => {
    const d = dragRef.current
    updateDrag(null)
    if (!d) return
    const store = useEditor.getState()
    if (d.kind === 'create') {
      const el = preview.created
      if (el && !isDegenerate(el)) store.addElements([{ ...normalizeElement(el), id: newId() }])
    } else if (d.kind === 'move') {
      if (d.dx === 0 && d.dy === 0) return
      const moved = preview.elements
        .filter((el) => d.ids.includes(el.id))
        .map((el) => reassignPage(el, spec, group, d.step))
      store.replaceElements(moved)
    } else if (d.kind === 'handle') {
      const el = preview.elements.find((x) => x.id === d.id)
      if (el && !isDegenerate(el)) store.replaceElements([normalizeElement(el)])
    }
  }

  const onPointerLeave = () => {
    if (!dragRef.current) useEditor.getState().setCursor(null)
  }

  // A triple-click's third click normally lands on the editor itself; this covers the case
  // where it lands on the canvas instead.
  const onClick = (e: React.MouseEvent) => {
    if (e.detail >= 3 && editing && editing.id === lastPressedId.current) setSelectAllRequest((n) => n + 1)
  }

  const onDoubleClick = () => {
    const el = design.elements.find((x) => x.id === lastPressedId.current)
    if (tool === 'select' && el) startEditing(el)
  }

  // ---- render --------------------------------------------------------------

  const px = zoom || 1
  const selected = new Set(selection)
  const { cols, rows } = gridSize(spec)
  const editingEl = editing
    ? preview.elements.find((el): el is TextElement => el.id === editing.id && el.type === 'text')
    : undefined

  return (
    <div className="canvas-scroll" ref={scrollRef}>
      <div className="canvas-inner">
        <div className="canvas-stage">
          <svg
            ref={svgRef}
            className={`canvas tool-${tool}`}
            width={totalW * px}
            height={totalH * px}
            viewBox={`${-MARGIN_MM} ${-MARGIN_MM} ${totalW} ${totalH}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onDoubleClick={onDoubleClick}
            onClick={onClick}
          >
            {group.map((page) => {
              const slot = slotOf(group, page)
              const pageEls = preview.elements.filter((el) => el.page === page)
              const created = preview.created?.page === page ? preview.created : null
              return (
                <g key={page} transform={`translate(${pageOriginMm(spec, slot)} 0)`}>
                  <PageBackground spec={spec} showDots showBorder />
                  <Rulers
                    spec={spec}
                    slot={slot}
                    double={group.length > 1}
                    cols={cols}
                    rows={rows}
                    px={px}
                    hover={cursor && cursor.page === page ? cursor : null}
                  />
                  <g pointerEvents="none">
                    {pageEls.map((el) => (
                      <ElementShape key={el.id} el={el} spec={spec} />
                    ))}
                    {created && <ElementShape el={created} spec={spec} />}
                  </g>
                  {tool === 'select' && (
                    <g>
                      {pageEls.map((el) => (
                        <HitArea
                          key={el.id}
                          el={el}
                          spec={spec}
                          px={px}
                          onPointerDown={(e) => onElementPointerDown(e, el)}
                        />
                      ))}
                    </g>
                  )}
                  <g pointerEvents="none">
                    {pageEls.map((el) => {
                      const b = boundsOf(el)
                      const off = !fitsOnPage(spec, b)
                      if (!selected.has(el.id) && !off) return null
                      return (
                        <BoundsOutline key={el.id} spec={spec} b={b} color={off ? '#d43a2f' : SELECT_COLOR} />
                      )
                    })}
                  </g>
                  {tool === 'select' && selection.length === 1 && (
                    <Handles
                      el={pageEls.find((el) => el.id === selection[0])}
                      spec={spec}
                      px={px}
                      onPointerDown={onHandlePointerDown}
                    />
                  )}
                  {tool !== 'select' && cursor && cursor.page === page && (
                    <circle
                      cx={spec.gridOffsetXMm + cursor.x * spec.dotPitchMm}
                      cy={spec.gridOffsetYMm + cursor.y * spec.dotPitchMm}
                      r={4 / px}
                      fill="none"
                      stroke={SELECT_COLOR}
                      strokeWidth={1.5 / px}
                      pointerEvents="none"
                    />
                  )}
                </g>
              )
            })}
            {drag?.kind === 'marquee' && <Marquee a={drag.startMm} b={drag.currentMm} />}
          </svg>
          {editingEl && (
            <InlineTextEditor
              key={editingEl.id}
              el={editingEl}
              spec={spec}
              px={px}
              marginMm={MARGIN_MM}
              originMm={originOf(editingEl.page)}
              selectAll={editing!.isNew}
              selectAllRequest={selectAllRequest}
              onChange={(text) => setEditing((cur) => (cur ? { ...cur, text } : cur))}
              onDone={finishEditing}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---- sub-components ------------------------------------------------------------

function Rulers(props: {
  spec: NotebookSpec
  slot: Slot
  double: boolean
  cols: number
  rows: number
  px: number
  hover: Pt | null
}) {
  const { spec, slot, double, cols, rows, px, hover } = props
  const p = spec.dotPitchMm
  const fontSize = 9 / px
  // Label every dot when there's room, otherwise every 5th.
  const every = p * px >= 14 ? 1 : 5
  const show = (i: number) => (i + 1) % every === 0 || i === 0
  const rowsOnRight = double && slot === 'right'
  const rowX = rowsOnRight ? spec.pageWidthMm + 3.5 : -3.5
  const isHover = (axis: 'x' | 'y', i: number) => hover !== null && Math.abs(hover[axis] - i) < 1e-6
  const label = (i: number, axis: 'x' | 'y') => ({
    fill: isHover(axis, i) ? SELECT_COLOR : (i + 1) % 5 === 0 ? '#6f6a60' : '#a39e93',
    fontWeight: isHover(axis, i) || (i + 1) % 5 === 0 ? 600 : 400
  })
  return (
    <g className="rulers" fontSize={fontSize} fontFamily="Inter, sans-serif" pointerEvents="none">
      {Array.from({ length: cols }, (_, i) =>
        show(i) || isHover('x', i) ? (
          <text key={`c${i}`} x={spec.gridOffsetXMm + i * p} y={-3} textAnchor="middle" {...label(i, 'x')}>
            {i + 1}
          </text>
        ) : null
      )}
      {Array.from({ length: rows }, (_, i) =>
        show(i) || isHover('y', i) ? (
          <text
            key={`r${i}`}
            x={rowX}
            y={spec.gridOffsetYMm + i * p}
            dy="0.35em"
            textAnchor={rowsOnRight ? 'start' : 'end'}
            {...label(i, 'y')}
          >
            {i + 1}
          </text>
        ) : null
      )}
    </g>
  )
}

function HitArea(props: {
  el: Element
  spec: NotebookSpec
  px: number
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const { el, spec, px, onPointerDown } = props
  const hitW = 10 / px
  const common = { onPointerDown, className: 'hit' }
  const X = (d: number) => spec.gridOffsetXMm + d * spec.dotPitchMm
  const Y = (d: number) => spec.gridOffsetYMm + d * spec.dotPitchMm
  switch (el.type) {
    case 'line':
      return (
        <line {...common} x1={X(el.x1)} y1={Y(el.y1)} x2={X(el.x2)} y2={Y(el.y2)} stroke="transparent" strokeWidth={hitW} strokeLinecap="round" />
      )
    case 'rect':
    case 'ellipse': {
      const b = normalizeRect(el)
      const shape = {
        ...common,
        stroke: 'transparent',
        strokeWidth: hitW,
        fill: el.fill ? 'transparent' : 'none'
      }
      return el.type === 'rect' ? (
        <rect {...shape} x={X(b.x)} y={Y(b.y)} width={b.w * spec.dotPitchMm} height={b.h * spec.dotPitchMm} />
      ) : (
        <ellipse
          {...shape}
          cx={X(b.x + b.w / 2)}
          cy={Y(b.y + b.h / 2)}
          rx={(b.w * spec.dotPitchMm) / 2}
          ry={(b.h * spec.dotPitchMm) / 2}
        />
      )
    }
    case 'text': {
      const b = boundsOf(el)
      return (
        <rect {...common} x={X(b.x)} y={Y(b.y)} width={b.w * spec.dotPitchMm} height={b.h * spec.dotPitchMm} fill="transparent" />
      )
    }
    case 'dot':
      return <circle {...common} cx={X(el.x)} cy={Y(el.y)} r={Math.max(el.sizeMm / 2, hitW / 2)} fill="transparent" />
  }
}

function BoundsOutline({ spec, b, color }: { spec: NotebookSpec; b: Rect; color: string }) {
  const pad = 0.8
  return (
    <rect
      x={spec.gridOffsetXMm + b.x * spec.dotPitchMm - pad}
      y={spec.gridOffsetYMm + b.y * spec.dotPitchMm - pad}
      width={b.w * spec.dotPitchMm + pad * 2}
      height={b.h * spec.dotPitchMm + pad * 2}
      fill="none"
      stroke={color}
      strokeWidth={1}
      strokeDasharray="4 3"
      vectorEffect="non-scaling-stroke"
    />
  )
}

function Handles(props: {
  el: Element | undefined
  spec: NotebookSpec
  px: number
  onPointerDown: (e: React.PointerEvent, id: string, h: Handle) => void
}) {
  const { el, spec, px, onPointerDown } = props
  if (!el || el.type === 'text' || el.type === 'dot') return null
  const handles: Handle[] = el.type === 'line' ? ['p1', 'p2'] : ['nw', 'ne', 'sw', 'se']
  const size = 9 / px
  return (
    <g>
      {handles.map((h) => {
        const pt = handlePoint(el, h)
        const cx = spec.gridOffsetXMm + pt.x * spec.dotPitchMm
        const cy = spec.gridOffsetYMm + pt.y * spec.dotPitchMm
        return (
          <rect
            key={h}
            className={`handle handle-${h}`}
            x={cx - size / 2}
            y={cy - size / 2}
            width={size}
            height={size}
            rx={el.type === 'line' ? size / 2 : 1 / px}
            fill="#fff"
            stroke={SELECT_COLOR}
            strokeWidth={1.5 / px}
            onPointerDown={(e) => onPointerDown(e, el.id, h)}
          />
        )
      })}
    </g>
  )
}

function Marquee({ a, b }: { a: Pt; b: Pt }) {
  return (
    <rect
      x={Math.min(a.x, b.x)}
      y={Math.min(a.y, b.y)}
      width={Math.abs(b.x - a.x)}
      height={Math.abs(b.y - a.y)}
      fill="rgba(47,124,246,0.08)"
      stroke={SELECT_COLOR}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  )
}

// ---- pure helpers ----------------------------------------------------------------

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

function clientToMm(svg: SVGSVGElement, x: number, y: number): Pt {
  const pt = svg.createSVGPoint()
  pt.x = x
  pt.y = y
  const r = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: r.x, y: r.y }
}

function mmToClient(svg: SVGSVGElement, mm: Pt): Pt {
  const pt = svg.createSVGPoint()
  pt.x = mm.x
  pt.y = mm.y
  const r = pt.matrixTransform(svg.getScreenCTM()!)
  return { x: r.x, y: r.y }
}

function handlePoint(el: Element, h: Handle): Pt {
  if (el.type === 'line') return h === 'p1' ? { x: el.x1, y: el.y1 } : { x: el.x2, y: el.y2 }
  if (el.type === 'rect' || el.type === 'ellipse') {
    const b = normalizeRect(el)
    return {
      x: h === 'nw' || h === 'sw' ? b.x : b.x + b.w,
      y: h === 'nw' || h === 'ne' ? b.y : b.y + b.h
    }
  }
  return { x: 0, y: 0 }
}

/** Constrain `p` relative to `origin`: lines to 45° steps, boxes to squares. */
function constrain(origin: Pt, p: Pt, mode: 'angle' | 'square'): Pt {
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  if (mode === 'square') {
    const s = Math.max(Math.abs(dx), Math.abs(dy))
    return { x: origin.x + Math.sign(dx || 1) * s, y: origin.y + Math.sign(dy || 1) * s }
  }
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (adx > ady * 2) return { x: p.x, y: origin.y }
  if (ady > adx * 2) return { x: origin.x, y: p.y }
  const s = Math.max(adx, ady)
  return { x: origin.x + Math.sign(dx) * s, y: origin.y + Math.sign(dy) * s }
}

function buildPreview(
  elements: Element[],
  drag: Drag | null,
  style: Style
): { elements: Element[]; created: Element | null } {
  if (!drag) return { elements, created: null }
  switch (drag.kind) {
    case 'create':
      return { elements, created: createElement(drag, style) }
    case 'move': {
      if (drag.dx === 0 && drag.dy === 0) return { elements, created: null }
      const ids = new Set(drag.ids)
      return {
        elements: elements.map((el) => (ids.has(el.id) ? translateElement(el, drag.dx, drag.dy) : el)),
        created: null
      }
    }
    case 'handle':
      return {
        elements: elements.map((el) => (el.id === drag.id ? resizeElement(el, drag) : el)),
        created: null
      }
    case 'marquee':
      return { elements, created: null }
  }
}

function createElement(d: Extract<Drag, { kind: 'create' }>, style: Style): Element | null {
  const base = { id: 'preview', page: d.page, color: style.color }
  const stroke = { strokeMm: style.strokeMm, dash: style.dash }
  if (d.tool === 'line') {
    const end = d.square ? constrain(d.start, d.current, 'angle') : d.current
    return { ...base, ...stroke, type: 'line', x1: d.start.x, y1: d.start.y, x2: end.x, y2: end.y }
  }
  if (d.tool === 'rect' || d.tool === 'ellipse') {
    const end = d.square ? constrain(d.start, d.current, 'square') : d.current
    const box = { x: d.start.x, y: d.start.y, w: end.x - d.start.x, h: end.y - d.start.y, fill: style.fill }
    return d.tool === 'rect'
      ? { ...base, ...stroke, ...box, type: 'rect', radiusDots: 0 }
      : { ...base, ...stroke, ...box, type: 'ellipse' }
  }
  return null
}

function resizeElement(el: Element, d: Extract<Drag, { kind: 'handle' }>): Element {
  if (el.type === 'line') {
    const other = d.handle === 'p1' ? { x: el.x2, y: el.y2 } : { x: el.x1, y: el.y1 }
    const p = d.square ? constrain(other, d.current, 'angle') : d.current
    return d.handle === 'p1' ? { ...el, x1: p.x, y1: p.y } : { ...el, x2: p.x, y2: p.y }
  }
  if (el.type === 'rect' || el.type === 'ellipse') {
    const opposite: Handle = ({ nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' } as const)[d.handle as 'nw']
    const fixed = handlePoint(el, opposite)
    const p = d.square ? constrain(fixed, d.current, 'square') : d.current
    return { ...el, x: fixed.x, y: fixed.y, w: p.x - fixed.x, h: p.y - fixed.y }
  }
  return el
}

/**
 * Anchor for new text at a click. On-row text starts at the nearest dot. Between-rows text
 * goes in the gap that was clicked: the band below the anchor for horizontal text, the
 * column gap to the left (reads downward) or right (reads upward) for turned text.
 */
function newTextAnchor(style: Style, raw: Pt, snapped: Pt, step: number): Pt {
  if (style.textPlacement !== 'between') return snapped
  const down = (v: number) => (step > 0 ? Math.floor(v / step + 1e-9) * step : v)
  const up = (v: number) => (step > 0 ? Math.ceil(v / step - 1e-9) * step : v)
  switch (style.textDirection) {
    case 'down':
      return { x: up(raw.x), y: snapped.y }
    case 'up':
      return { x: down(raw.x), y: snapped.y }
    default:
      return { x: snapped.x, y: down(raw.y) }
  }
}

function isDegenerate(el: Element): boolean {
  if (el.type === 'line') return el.x1 === el.x2 && el.y1 === el.y2
  if (el.type === 'rect' || el.type === 'ellipse') return el.w === 0 || el.h === 0
  return false
}

function normalizeElement(el: Element): Element {
  if (el.type === 'rect' || el.type === 'ellipse') return { ...el, ...normalizeRect(el) }
  return el
}

/** Move an element dragged across the gutter onto the other page of the spread. */
function reassignPage(el: Element, spec: NotebookSpec, group: PageId[], step: number): Element {
  const norm = normalizeElement(el)
  if (group.length < 2) return norm
  const [left, right] = group
  const b = boundsOf(norm)
  const centerMm = spec.gridOffsetXMm + (b.x + b.w / 2) * spec.dotPitchMm
  const shift = step > 0 ? snap(pageShiftDots(spec), step) : pageShiftDots(spec)
  if (el.page === left && centerMm > spec.pageWidthMm + 4) {
    return { ...translateElement(norm, -shift, 0), page: right }
  }
  if (el.page === right && centerMm < -4) {
    return { ...translateElement(norm, shift, 0), page: left }
  }
  return norm
}

function marqueeSelection(
  elements: Element[],
  spec: NotebookSpec,
  group: PageId[],
  a: Pt,
  b: Pt,
  base: string[]
): string[] {
  const ids = new Set(base)
  for (const page of group) {
    const ox = pageOriginMm(spec, slotOf(group, page))
    const r = normalizeRect({
      x: mmToDotX(spec, a.x - ox),
      y: mmToDotY(spec, a.y),
      w: (b.x - a.x) / spec.dotPitchMm,
      h: (b.y - a.y) / spec.dotPitchMm
    })
    for (const el of elements) {
      if (el.page === page && rectsIntersect(r, boundsOf(el))) ids.add(el.id)
    }
  }
  return [...ids]
}
