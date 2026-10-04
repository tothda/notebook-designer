import { formatPos } from '@shared/format'
import { fitsOnPage } from '@shared/geometry'
import { pageNumber, spreadIndexOfPage } from '@shared/pages'
import { boundsOf } from '../measure'
import { useEditor } from '../store'

export function StatusBar() {
  const cursor = useEditor((s) => s.cursor)
  const zoom = useEditor((s) => s.zoom)
  const design = useEditor((s) => s.design)
  const spec = design.notebook
  const offPage = design.elements.filter((el) => !fitsOnPage(spec, boundsOf(el)))
  const { setZoom, select, goToSpread } = useEditor.getState()

  // Jump to the first spread with a problem and select the offending elements there.
  const showOffPage = () => {
    const index = spreadIndexOfPage(design, offPage[0].page)
    goToSpread(index)
    select(offPage.filter((el) => spreadIndexOfPage(design, el.page) === index).map((el) => el.id))
  }

  return (
    <footer className="statusbar">
      <span className="cursor-pos">
        {cursor
          ? `Page ${pageNumber(design, cursor.page)} · ${formatPos(cursor.x, cursor.y)}`
          : ' '}
      </span>
      {offPage.length > 0 && (
        <button className="warn-chip" onClick={showOffPage}>
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
