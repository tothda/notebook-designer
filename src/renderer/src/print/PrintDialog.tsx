import { useState } from 'react'
import { spreadLabel, spreadsOf } from '@shared/pages'
import { currentGroup, useEditor } from '../store'
import { planPrint, spreadsToPrint, type PrintOptions } from './layout'

interface Props {
  options: PrintOptions
  onChange: (o: PrintOptions) => void
  defaultName: string
}

export function PrintDialog({ options, onChange, defaultName }: Props) {
  const design = useEditor((s) => s.design)
  const currentSpread = useEditor((s) => s.currentSpread)
  const spec = design.notebook
  const close = () => useEditor.getState().setPrintOpen(false)
  const [busy, setBusy] = useState(false)
  const group = currentGroup({ design, currentSpread })
  const plan = planPrint(spec, spreadsToPrint(design, group, options.scope), options.layout)
  const multiple = spreadsOf(design).length > 1
  const paper = { widthMm: plan.widthMm, heightMm: plan.heightMm, defaultName }

  const run = async (action: 'pdf' | 'print') => {
    setBusy(true)
    try {
      if (action === 'pdf') await window.api.exportPdf(paper)
      else await window.api.print(paper)
      close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal aria-labelledby="print-title">
        <h2 id="print-title">Print / Export PDF</h2>
        <p className="muted small">Everything is output at 100% scale, so a printout lines up with your notebook.</p>

        <fieldset>
          <legend>Paper</legend>
          <label className="radio">
            <input
              type="radio"
              checked={options.layout === 'a4'}
              onChange={() => onChange({ ...options, layout: 'a4' })}
            />
            <span>
              <strong>A4, for printing at home</strong>
              <br />
              <span className="muted small">
                Pages on A4 with a 50 mm calibration ruler. Print at "Actual size" / 100%.
              </span>
            </span>
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={options.layout === 'notebook'}
              onChange={() => onChange({ ...options, layout: 'notebook' })}
            />
            <span>
              <strong>
                Exact page size ({spec.pageWidthMm} × {spec.pageHeightMm} mm)
              </strong>
              <br />
              <span className="muted small">One PDF page per notebook page. Good for viewing on a tablet or reference.</span>
            </span>
          </label>
        </fieldset>

        {multiple && (
          <fieldset>
            <legend>Pages</legend>
            <div className="segmented wide" role="group" aria-label="Pages to print">
              <button className={options.scope === 'all' ? 'active' : ''} onClick={() => onChange({ ...options, scope: 'all' })}>
                All {design.pages.length} pages
              </button>
              <button
                className={options.scope === 'current' ? 'active' : ''}
                onClick={() => onChange({ ...options, scope: 'current' })}
              >
                {spreadLabel(design, group)} only
              </button>
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>Show</legend>
          <label className="check">
            <input type="checkbox" checked={options.showDots} onChange={(e) => onChange({ ...options, showDots: e.target.checked })} />
            Dot grid
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.showBorder}
              onChange={(e) => onChange({ ...options, showBorder: e.target.checked })}
            />
            Page outline (trim line)
          </label>
        </fieldset>

        <p className="small">
          {plan.fitsA4 ? (
            <>
              Output: {plan.sheets.length} sheet{plan.sheets.length > 1 ? 's' : ''} of {plan.widthMm} × {plan.heightMm} mm.
            </>
          ) : (
            <span className="warn">This page is too large for A4; it will be output at exact page size instead.</span>
          )}
        </p>

        <div className="modal-actions">
          <button onClick={close}>Cancel</button>
          <button disabled={busy} onClick={() => void run('print')}>
            Print…
          </button>
          <button className="primary-btn" disabled={busy} onClick={() => void run('pdf')}>
            Export PDF…
          </button>
        </div>
      </div>
    </div>
  )
}
