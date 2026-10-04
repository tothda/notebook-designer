import { useEffect, useLayoutEffect, useRef } from 'react'
import { pageOriginMm } from '@shared/geometry'
import type { NotebookSpec, TextElement } from '@shared/model'
import { baselineDots } from '@shared/text'
import { fontMetrics, measureTextDots } from '../measure'

interface Props {
  el: TextElement
  spec: NotebookSpec
  /** Screen pixels per mm. */
  px: number
  /** Space around the spread in mm (where the SVG's viewBox starts). */
  marginMm: number
  selectAll: boolean
  /** Incremented to select all text (e.g. a triple-click that landed on the canvas). */
  selectAllRequest: number
  onChange: (text: string) => void
  onDone: () => void
}

/**
 * A textarea laid exactly over a text element. Its own glyphs are transparent: the SVG
 * keeps rendering the draft, so what you see while typing is what gets printed, and the
 * textarea only supplies the caret, selection and keyboard handling.
 */
export function InlineTextEditor({ el, spec, px, marginMm, selectAll, selectAllRequest, onChange, onDone }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.focus()
    if (selectAll) ta.select()
    else ta.setSelectionRange(ta.value.length, ta.value.length)
    // Only on mount: later re-renders must not move the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectAllRequest) ref.current?.select()
  }, [selectAllRequest])

  // The box is sized to the text, so keep its contents from scrolling out of alignment.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0
  })

  const p = spec.dotPitchMm
  const sizeMm = el.sizeDots * p
  const lineMm = el.lineHeightDots * p
  const m = fontMetrics(el.font, el.bold)
  // Centre each textarea line box on the capital letters of the matching SVG line.
  const firstCentreMm = spec.gridOffsetYMm + baselineDots(el, 0, m) * p - (m.cap * sizeMm) / 2
  const topMm = firstCentreMm - lineMm / 2
  // As wide as the text plus room for the next letter, so it doesn't cover neighbouring
  // labels. The anchor edge stays put like the SVG text-anchor.
  const textWidthDots = Math.max(...el.text.split('\n').map((l) => measureTextDots(l, el.font, el.bold, el.sizeDots)))
  const slackDots = el.align === 'middle' ? el.sizeDots * 2 : el.sizeDots
  const widthMm = (textWidthDots + slackDots) * p
  const anchorMm = pageOriginMm(spec, el.page) + spec.gridOffsetXMm + el.x * p
  const leftMm = el.align === 'start' ? anchorMm : el.align === 'middle' ? anchorMm - widthMm / 2 : anchorMm - widthMm
  const lines = el.text.split('\n').length

  return (
    <textarea
      ref={ref}
      className="inline-text-editor"
      value={el.text}
      wrap="off"
      spellCheck={false}
      aria-label="Edit text"
      style={{
        left: (leftMm + marginMm) * px,
        top: (topMm + marginMm) * px,
        width: widthMm * px,
        height: lines * lineMm * px,
        font: `${el.bold ? 700 : 400} ${sizeMm * px}px "${el.font}", cursive`,
        lineHeight: `${lineMm * px}px`,
        textAlign: el.align === 'start' ? 'left' : el.align === 'middle' ? 'center' : 'right',
        caretColor: el.color
      }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        // Triple-click selects all the text, not just the clicked line.
        if (e.detail >= 3) {
          e.preventDefault()
          ref.current?.select()
        }
      }}
      onKeyDown={(e) => {
        // Escape (handled globally) blurs; ⌘/Ctrl+Enter also finishes. Plain Enter adds a line.
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          ref.current?.blur()
        }
      }}
    />
  )
}
