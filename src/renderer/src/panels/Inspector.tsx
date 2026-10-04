import { describeElement, formatPos, formatSpaces, formatMm } from '@shared/format'
import { fitsOnPage, gridSize, unionRects } from '@shared/geometry'
import type { Element, NotebookSpec, TextAlign } from '@shared/model'
import { boundsOf, maxBetweenSize } from '../measure'
import { useEditor } from '../store'
import { NumField } from './fields'

const TYPE_LABEL: Record<Element['type'], string> = {
  line: 'Line',
  rect: 'Box',
  ellipse: 'Ellipse',
  text: 'Text',
  dot: 'Dot'
}

export function Inspector() {
  const elements = useEditor((s) => s.design.elements)
  const selection = useEditor((s) => s.selection)
  const spec = useEditor((s) => s.design.notebook)
  const spread = useEditor((s) => s.design.spread)
  const selected = elements.filter((e) => selection.includes(e.id))

  if (selected.length === 0) return <NothingSelected spec={spec} count={elements.length} />
  if (selected.length > 1) return <MultiSelection els={selected} spec={spec} />
  return <SingleElement el={selected[0]} spec={spec} showPage={spread === 'double'} />
}

function NothingSelected({ spec, count }: { spec: NotebookSpec; count: number }) {
  const { cols, rows } = gridSize(spec)
  return (
    <div className="panel-body">
      <p className="muted">Nothing selected.</p>
      <dl className="facts">
        <dt>Notebook</dt>
        <dd>{spec.name}</dd>
        <dt>Dot grid</dt>
        <dd>
          {cols} × {rows} dots per page, {spec.dotPitchMm} mm apart
        </dd>
        <dt>Elements</dt>
        <dd>{count}</dd>
      </dl>
      <div className="tips">
        <h4>Tips</h4>
        <ul>
          <li>Everything snaps to dots. Hold <kbd>Alt</kbd> to place freely.</li>
          <li>Hold <kbd>Shift</kbd> for straight lines and square boxes.</li>
          <li>
            <kbd>⌘D</kbd> duplicates. Move the copy, then press <kbd>⌘D</kbd> again to repeat the same step,
            e.g. for calendar rows.
          </li>
          <li>Arrow keys nudge by one dot; <kbd>Shift</kbd>+arrow by five.</li>
          <li>Dot numbers count from 1 at the top-left dot of each page.</li>
        </ul>
      </div>
    </div>
  )
}

function MultiSelection({ els, spec }: { els: Element[]; spec: NotebookSpec }) {
  const pages = [...new Set(els.map((e) => e.page))]
  return (
    <div className="panel-body">
      <h3>{els.length} elements</h3>
      {pages.map((page) => {
        const b = unionRects(els.filter((e) => e.page === page).map(boundsOf))!
        return (
          <div className="copy-card" key={page}>
            {pages.length > 1 && <div className="card-label">{page === 'left' ? 'Left page' : 'Right page'}</div>}
            <p>Top-left {formatPos(b.x, b.y)}</p>
            <p>Bottom-right {formatPos(b.x + b.w, b.y + b.h)}</p>
            <p>
              Spans {formatSpaces(b.w)} × {formatSpaces(b.h)} spaces ({formatMm(b.w * spec.dotPitchMm)} ×{' '}
              {formatMm(b.h * spec.dotPitchMm)})
            </p>
          </div>
        )
      })}
      <SelectionActions />
    </div>
  )
}

function SingleElement({ el, spec, showPage }: { el: Element; spec: NotebookSpec; showPage: boolean }) {
  const update = (patch: Partial<Element>) =>
    useEditor.getState().updateElements([el.id], (e) => ({ ...e, ...patch }) as Element)
  const fits = fitsOnPage(spec, boundsOf(el))

  return (
    <div className="panel-body">
      <h3>
        {TYPE_LABEL[el.type]}
        {showPage && <span className="page-tag">{el.page === 'left' ? 'left page' : 'right page'}</span>}
      </h3>

      <div className="copy-card" aria-label="How to copy onto paper">
        <div className="card-label">On paper</div>
        {describeElement(el, spec).map((line) => (
          <p key={line}>{line}</p>
        ))}
        {!fits && <p className="warn">Runs off the edge of the page.</p>}
      </div>

      {el.type === 'text' && <TextEditor el={el} spec={spec} update={update} />}

      <div className="field-grid">
        {el.type === 'line' && (
          <>
            <NumField label="Start col" value={el.x1} displayOffset={1} step={0.5} onChange={(v) => update({ x1: v })} />
            <NumField label="Start row" value={el.y1} displayOffset={1} step={0.5} onChange={(v) => update({ y1: v })} />
            <NumField label="End col" value={el.x2} displayOffset={1} step={0.5} onChange={(v) => update({ x2: v })} />
            <NumField label="End row" value={el.y2} displayOffset={1} step={0.5} onChange={(v) => update({ y2: v })} />
          </>
        )}
        {(el.type === 'rect' || el.type === 'ellipse') && (
          <>
            <NumField label="Col" value={el.x} displayOffset={1} step={0.5} onChange={(v) => update({ x: v })} />
            <NumField label="Row" value={el.y} displayOffset={1} step={0.5} onChange={(v) => update({ y: v })} />
            <NumField label="Width" value={el.w} step={0.5} min={0.5} suffix="spaces" onChange={(v) => update({ w: v })} />
            <NumField label="Height" value={el.h} step={0.5} min={0.5} suffix="spaces" onChange={(v) => update({ h: v })} />
            {el.type === 'rect' && (
              <NumField
                label="Corner radius"
                value={el.radiusDots}
                step={0.25}
                min={0}
                suffix="spaces"
                onChange={(v) => update({ radiusDots: v })}
              />
            )}
          </>
        )}
        {(el.type === 'text' || el.type === 'dot') && (
          <>
            <NumField label="Col" value={el.x} displayOffset={1} step={0.5} onChange={(v) => update({ x: v })} />
            <NumField label="Row" value={el.y} displayOffset={1} step={0.5} onChange={(v) => update({ y: v })} />
          </>
        )}
        {el.type === 'dot' && (
          <NumField
            label="Size"
            value={el.sizeMm}
            step={0.25}
            min={0.25}
            suffix="mm"
            onChange={(v) => {
              update({ sizeMm: v })
              useEditor.setState((s) => ({ style: { ...s.style, dotSizeMm: v } }))
            }}
          />
        )}
      </div>
      <SelectionActions />
    </div>
  )
}

function TextEditor({
  el,
  spec,
  update
}: {
  el: Extract<Element, { type: 'text' }>
  spec: NotebookSpec
  update: (p: Partial<Element>) => void
}) {
  return (
    <div className="text-editor">
      <textarea
        value={el.text}
        rows={Math.min(6, el.text.split('\n').length + 1)}
        onChange={(e) => update({ text: e.target.value })}
        style={{ fontFamily: `"${el.font}", cursive`, fontWeight: el.bold ? 700 : 400 }}
        aria-label="Text"
      />
      <div className="segmented wide" role="group" aria-label="Placement">
        {(['baseline', 'between'] as const).map((p) => (
          <button
            key={p}
            className={el.placement === p ? 'active' : ''}
            onClick={() => useEditor.getState().setStyle({ textPlacement: p })}
          >
            {p === 'baseline' ? 'On a dot row' : 'Between rows'}
          </button>
        ))}
      </div>
      {el.placement === 'between' && <BetweenFit el={el} spec={spec} update={update} />}
      <div className="row">
        <div className="segmented" role="group" aria-label="Alignment">
          {(['start', 'middle', 'end'] as TextAlign[]).map((a) => (
            <button key={a} className={el.align === a ? 'active' : ''} onClick={() => update({ align: a })}>
              {a === 'start' ? 'Left' : a === 'middle' ? 'Centre' : 'Right'}
            </button>
          ))}
        </div>
        <NumField
          label="Line spacing"
          value={el.lineHeightDots}
          step={0.5}
          min={0.5}
          suffix="spaces"
          onChange={(v) => update({ lineHeightDots: v })}
        />
      </div>
    </div>
  )
}

/** Whether 'between' text clears the dots above and below, and the largest size that does. */
function BetweenFit({
  el,
  spec,
  update
}: {
  el: Extract<Element, { type: 'text' }>
  spec: NotebookSpec
  update: (p: Partial<Element>) => void
}) {
  const max = maxBetweenSize(el, spec)
  if (el.sizeDots <= max + 1e-6) {
    return <p className="muted small">Clear of the dots. Fits up to size {max}.</p>
  }
  return (
    <p className="small fit-warning">
      <span className="warn">Letters touch the dots.</span> Fits up to size {max}.{' '}
      <button className="link-btn" onClick={() => update({ sizeDots: max })}>
        Use size {max}
      </button>
    </p>
  )
}

function SelectionActions() {
  const { duplicateSelection, deleteSelection, reorderSelection } = useEditor.getState()
  return (
    <div className="actions">
      <button onClick={duplicateSelection}>Duplicate</button>
      <button onClick={() => reorderSelection(1)}>Forward</button>
      <button onClick={() => reorderSelection(-1)}>Backward</button>
      <button className="danger" onClick={deleteSelection}>
        Delete
      </button>
    </div>
  )
}
