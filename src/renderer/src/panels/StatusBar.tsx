import { formatPos } from '@shared/format'
import { fitsOnPage } from '@shared/geometry'
import { boundsOf } from '../measure'
import { useEditor } from '../store'

export function StatusBar() {
  const cursor = useEditor((s) => s.cursor)
  const zoom = useEditor((s) => s.zoom)
  const spread = useEditor((s) => s.design.spread)
  const spec = useEditor((s) => s.design.notebook)
  const elements = useEditor((s) => s.design.elements)
  const offPage = elements.filter((el) => !fitsOnPage(spec, boundsOf(el)))
  const { setZoom, select } = useEditor.getState()

  return (
    <footer className="statusbar">
      <span className="cursor-pos">
        {cursor
          ? `${spread === 'double' ? (cursor.page === 'left' ? 'Left page · ' : 'Right page · ') : ''}${formatPos(cursor.x, cursor.y)}`
          : ' '}
      </span>
      {offPage.length > 0 && (
        <button className="warn-chip" onClick={() => select(offPage.map((e) => e.id))}>
          {offPage.length} element{offPage.length > 1 ? 's' : ''} off the page
        </button>
      )}
      <span className="spacer" />
      <span className="muted">Zoom</span>
      <button className="link-btn" onClick={() => setZoom(Math.max(1, zoom / 1.25))} aria-label="Zoom out">
        −
      </button>
      <span className="zoom">{Math.round((zoom / (96 / 25.4)) * 100)}%</span>
      <button className="link-btn" onClick={() => setZoom(Math.min(40, zoom * 1.25))} aria-label="Zoom in">
        +
      </button>
      <button className="link-btn" onClick={() => setZoom(0)}>
        Fit
      </button>
    </footer>
  )
}
