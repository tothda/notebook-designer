import type { Dash } from '@shared/model'
import { FONTS, PEN_WIDTHS_MM } from '@shared/palette'
import { useEditor, type Tool } from '../store'
import { icons } from './icons'

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Select', key: 'V' },
  { id: 'line', label: 'Line', key: 'L' },
  { id: 'rect', label: 'Box', key: 'R' },
  { id: 'ellipse', label: 'Ellipse', key: 'O' },
  { id: 'text', label: 'Text', key: 'T' },
  { id: 'dot', label: 'Dot / bullet', key: 'D' }
]

export function Toolbar() {
  const tool = useEditor((s) => s.tool)
  const style = useEditor((s) => s.style)
  const palette = useEditor((s) => s.design.palette)
  const halfDotSnap = useEditor((s) => s.halfDotSnap)
  const { setTool, setStyle, setHalfDotSnap, setPrintOpen } = useEditor.getState()

  return (
    <header className="toolbar">
      <div className="group tools" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`icon-btn${tool === t.id ? ' active' : ''}`}
            title={`${t.label} (${t.key})`}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
          >
            {icons[t.id]}
          </button>
        ))}
      </div>

      <div className="group" aria-label="Ink colour">
        {palette.map((c) => (
          <button
            key={c}
            className={`swatch${style.color === c ? ' active' : ''}`}
            style={{ background: c }}
            title={c}
            aria-label={`Colour ${c}`}
            onClick={() => setStyle({ color: c })}
          />
        ))}
      </div>

      <div className="group">
        <label className="field-inline" title="Pen width">
          <span>Pen</span>
          <select value={style.strokeMm} onChange={(e) => setStyle({ strokeMm: Number(e.target.value) })}>
            {PEN_WIDTHS_MM.map((w) => (
              <option key={w} value={w}>
                {w} mm
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline" title="Line style">
          <select value={style.dash} onChange={(e) => setStyle({ dash: e.target.value as Dash })}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
        <label className="check" title="Highlighter fill for boxes and ellipses, in the ink colour">
          <input
            type="checkbox"
            checked={style.fill !== null}
            onChange={(e) => setStyle({ fill: e.target.checked ? style.color : null })}
          />
          Fill
        </label>
      </div>

      <div className="group">
        <label className="field-inline" title="Handwriting font">
          <span>Font</span>
          <select value={style.font} onChange={(e) => setStyle({ font: e.target.value })} style={{ fontFamily: style.font }}>
            {FONTS.map((f) => (
              <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline" title="Letter size in dot spaces">
          <span>Size</span>
          <input
            type="number"
            min={0.3}
            max={10}
            step={0.1}
            value={style.sizeDots}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v > 0) setStyle({ sizeDots: v })
            }}
          />
        </label>
        <button
          className={`text-btn bold${style.bold ? ' active' : ''}`}
          title="Bold"
          aria-pressed={style.bold}
          onClick={() => setStyle({ bold: !style.bold })}
        >
          B
        </button>
      </div>

      <div className="group">
        <label className="check" title="Snap to half-dot positions (hold Alt to place freely)">
          <input type="checkbox" checked={halfDotSnap} onChange={(e) => setHalfDotSnap(e.target.checked)} />
          Half-dot snap
        </label>
      </div>

      <div className="spacer" />
      <button className="primary-btn" onClick={() => setPrintOpen(true)} title="Print or export at real size (⌘P)">
        Print / PDF
      </button>
    </header>
  )
}
