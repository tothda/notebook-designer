import { useEffect, useState } from 'react'

interface NumFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  /** Shown to the user as value + displayOffset (e.g. 1 for 1-based dot numbers). */
  displayOffset?: number
  suffix?: string
  title?: string
}

/** Number input that commits on Enter/blur, so typing doesn't spam undo history. */
export function NumField({ label, value, onChange, step = 1, min, displayOffset = 0, suffix, title }: NumFieldProps) {
  const shown = round(value + displayOffset)
  const [text, setText] = useState(String(shown))
  useEffect(() => setText(String(shown)), [shown])

  const commit = () => {
    const v = Number(text)
    if (text.trim() === '' || !Number.isFinite(v) || (min !== undefined && v < min)) {
      setText(String(shown))
      return
    }
    if (round(v) !== shown) onChange(v - displayOffset)
  }

  return (
    <label className="num-field" title={title}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setText(String(shown))
        }}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  )
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000
}
