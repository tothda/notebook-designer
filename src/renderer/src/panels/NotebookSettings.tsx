import { gridSize } from '@shared/geometry'
import type { NotebookSpec } from '@shared/model'
import { centeredOffset, NOTEBOOK_PRESETS } from '@shared/presets'
import { DEFAULT_PALETTE } from '@shared/palette'
import { useEditor } from '../store'
import { NumField } from './fields'

export function NotebookSettings() {
  const spec = useEditor((s) => s.design.notebook)
  const spread = useEditor((s) => s.design.spread)
  const palette = useEditor((s) => s.design.palette)
  const { setNotebook, setSpread, setPalette } = useEditor.getState()
  const { cols, rows } = gridSize(spec)
  const set = (patch: Partial<NotebookSpec>) => setNotebook({ ...spec, ...patch })
  const presetIndex = NOTEBOOK_PRESETS.findIndex((p) => p.name === spec.name)

  return (
    <div className="panel-body">
      <h3>Notebook</h3>
      <label className="stack-field">
        <span>Preset</span>
        <select
          value={presetIndex}
          onChange={(e) => {
            const i = Number(e.target.value)
            if (i >= 0) setNotebook({ ...NOTEBOOK_PRESETS[i] })
          }}
        >
          {presetIndex < 0 && <option value={-1}>Custom: {spec.name}</option>}
          {NOTEBOOK_PRESETS.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name} — {p.pageWidthMm}×{p.pageHeightMm} mm
            </option>
          ))}
        </select>
      </label>
      <label className="stack-field">
        <span>Name</span>
        <input value={spec.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="segmented wide" role="group" aria-label="Pages">
        <button className={spread === 'single' ? 'active' : ''} onClick={() => setSpread('single')}>
          Single page
        </button>
        <button className={spread === 'double' ? 'active' : ''} onClick={() => setSpread('double')}>
          Two-page spread
        </button>
      </div>

      <h4>Page and grid</h4>
      <p className="muted small">
        Presets are approximate. Measure your own notebook with a ruler and adjust: page size, the distance
        between dots, and how far the first dot sits from the top-left corner of the page.
      </p>
      <div className="field-grid">
        <NumField label="Page width" value={spec.pageWidthMm} step={0.5} min={10} suffix="mm" onChange={(v) => set({ pageWidthMm: v })} />
        <NumField label="Page height" value={spec.pageHeightMm} step={0.5} min={10} suffix="mm" onChange={(v) => set({ pageHeightMm: v })} />
        <NumField label="Dot spacing" value={spec.dotPitchMm} step={0.1} min={1} suffix="mm" onChange={(v) => set({ dotPitchMm: v })} />
        <NumField label="Dot size" value={spec.dotDiameterMm} step={0.1} min={0.1} suffix="mm" onChange={(v) => set({ dotDiameterMm: v })} />
        <NumField label="First dot from left" value={spec.gridOffsetXMm} step={0.1} min={0} suffix="mm" onChange={(v) => set({ gridOffsetXMm: v })} />
        <NumField label="First dot from top" value={spec.gridOffsetYMm} step={0.1} min={0} suffix="mm" onChange={(v) => set({ gridOffsetYMm: v })} />
      </div>
      <div className="row">
        <button
          onClick={() =>
            set({
              gridOffsetXMm: centeredOffset(spec.pageWidthMm, spec.dotPitchMm),
              gridOffsetYMm: centeredOffset(spec.pageHeightMm, spec.dotPitchMm)
            })
          }
        >
          Centre grid on page
        </button>
        <span className="muted small">
          {cols} × {rows} dots per page
        </span>
      </div>

      <h4>Ink palette</h4>
      <div className="palette-editor">
        {palette.map((c, i) => (
          <div className="palette-item" key={i}>
            <input
              type="color"
              value={c}
              aria-label={`Ink ${i + 1}`}
              onChange={(e) => setPalette(palette.map((p, j) => (j === i ? e.target.value : p)))}
            />
            {palette.length > 1 && (
              <button
                className="remove"
                title="Remove ink"
                aria-label={`Remove ink ${i + 1}`}
                onClick={() => setPalette(palette.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="add" title="Add ink" onClick={() => setPalette([...palette, '#2e7d4f'])}>
          +
        </button>
      </div>
      <button className="link-btn" onClick={() => setPalette([...DEFAULT_PALETTE])}>
        Reset to default inks
      </button>
    </div>
  )
}
