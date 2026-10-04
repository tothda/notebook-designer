import { useEffect, useRef } from 'react'
import { fitsOnPage, pageOriginMm, spreadWidthMm } from '@shared/geometry'
import type { Design, Element, NotebookSpec, PageId } from '@shared/model'
import { slotOf, spreadLabel, spreadsOf } from '@shared/pages'
import { ElementShape, PageBackground } from '../canvas/ElementShape'
import { boundsOf } from '../measure'
import { useEditor } from '../store'

const THUMB_HEIGHT = 64

/** Strip of spread thumbnails under the canvas, with page management actions. */
export function PageStrip() {
  const design = useEditor((s) => s.design)
  const currentSpread = useEditor((s) => s.currentSpread)
  const { goToSpread, addSpread, duplicateSpread, deleteSpread, moveSpread } = useEditor.getState()
  const groups = spreadsOf(design)
  const current = Math.min(currentSpread, groups.length - 1)
  const unit = design.spread === 'double' ? 'spread' : 'page'
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current, groups.length])

  const onDelete = () => {
    const group = new Set(groups[current])
    const count = design.elements.filter((e) => group.has(e.page)).length
    if (count === 0 || confirm(`Delete ${spreadLabel(design, groups[current])} and the ${count} element${count > 1 ? 's' : ''} on ${group.size > 1 ? 'them' : 'it'}? You can undo this.`)) {
      deleteSpread()
    }
  }

  return (
    <nav className="page-strip" aria-label="Pages">
      <div className="thumbs">
        {groups.map((group, i) => (
          <button
            key={group.join('|')}
            ref={i === current ? activeRef : undefined}
            className={`thumb${i === current ? ' active' : ''}`}
            onClick={() => goToSpread(i)}
            title={spreadLabel(design, group)}
            aria-current={i === current ? 'page' : undefined}
          >
            <Thumbnail spec={design.notebook} group={group} elements={design.elements} />
            <span className="thumb-label">
              {spreadLabel(design, group).replace(/^Pages? /, '')}
              {hasOffPage(design, group) && <span className="thumb-warn" title="Something runs off the page" />}
            </span>
          </button>
        ))}
        <button className="thumb add" onClick={addSpread} title={`Add a ${unit} after this one`}>
          <span aria-hidden>+</span>
          <span className="thumb-label">Add {unit}</span>
        </button>
      </div>
      <div className="strip-actions">
        <button onClick={() => moveSpread(-1)} disabled={current === 0} title={`Move ${unit} earlier`} aria-label={`Move ${unit} earlier`}>
          ←
        </button>
        <button
          onClick={() => moveSpread(1)}
          disabled={current === groups.length - 1}
          title={`Move ${unit} later`}
          aria-label={`Move ${unit} later`}
        >
          →
        </button>
        <button onClick={duplicateSpread} title={`Copy this ${unit}, with everything on it`}>
          Duplicate
        </button>
        <button className="danger" onClick={onDelete} disabled={groups.length < 2} title={`Delete this ${unit}`}>
          Delete
        </button>
      </div>
    </nav>
  )
}

function hasOffPage(design: Design, group: PageId[]): boolean {
  return design.elements.some((el) => group.includes(el.page) && !fitsOnPage(design.notebook, boundsOf(el)))
}

function Thumbnail({ spec, group, elements }: { spec: NotebookSpec; group: PageId[]; elements: Element[] }) {
  const w = spreadWidthMm(spec, group.length)
  const h = spec.pageHeightMm
  return (
    <svg width={(THUMB_HEIGHT * w) / h} height={THUMB_HEIGHT} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {group.map((page) => (
        <g key={page} transform={`translate(${pageOriginMm(spec, slotOf(group, page))} 0)`}>
          <PageBackground spec={spec} showDots={false} showBorder />
          {elements
            .filter((el) => el.page === page)
            .map((el) => (
              <ElementShape key={el.id} el={el} spec={spec} />
            ))}
        </g>
      ))}
    </svg>
  )
}
