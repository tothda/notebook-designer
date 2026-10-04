import { useMemo } from 'react'
import { spreadLabel } from '@shared/pages'
import { currentGroup, useEditor } from '../store'
import { ElementShape, PageBackground } from '../canvas/ElementShape'
import { planPrint, spreadsToPrint, type PrintOptions } from './layout'

/**
 * Print-only markup: hidden on screen, shown under @media print. Every size is in
 * CSS millimetres so Chromium prints at true physical scale.
 */
export function PrintView({ options }: { options: PrintOptions }) {
  const design = useEditor((s) => s.design)
  const currentSpread = useEditor((s) => s.currentSpread)
  const spec = design.notebook
  const plan = useMemo(
    () => planPrint(spec, spreadsToPrint(design, currentGroup({ design, currentSpread }), options.scope), options.layout),
    [design, currentSpread, spec, options.scope, options.layout]
  )

  return (
    <div className="print-root" aria-hidden>
      <style>{`@page { size: ${plan.widthMm}mm ${plan.heightMm}mm; margin: 0; }`}</style>
      {plan.sheets.map((sheet, i) => (
        <div className="sheet" key={i} style={{ width: `${plan.widthMm}mm`, height: `${plan.heightMm}mm` }}>
          <svg
            width={`${plan.widthMm}mm`}
            height={`${plan.heightMm}mm`}
            viewBox={`0 0 ${plan.widthMm} ${plan.heightMm}`}
          >
            {sheet.pages.map(({ page, x, y }) => (
              <g key={page} transform={`translate(${x} ${y})`}>
                <PageBackground
                  spec={spec}
                  showDots={options.showDots}
                  showBorder={options.showBorder}
                  dotColor="#9a968d"
                />
                {design.elements
                  .filter((el) => el.page === page)
                  .map((el) => (
                    <ElementShape key={el.id} el={el} spec={spec} />
                  ))}
              </g>
            ))}
            {sheet.foldX !== undefined && options.showBorder && (
              <line
                x1={sheet.foldX}
                x2={sheet.foldX}
                y1={sheet.pages[0].y}
                y2={sheet.pages[0].y + spec.pageHeightMm}
                stroke="#9c978c"
                strokeWidth={0.2}
                strokeDasharray="1.5 1"
              />
            )}
            {sheet.calibration && (
              <CalibrationBar
                y={plan.heightMm - 14}
                name={`${spec.name} · ${spreadLabel(design, sheet.pages.map((p) => p.page))}`}
              />
            )}
          </svg>
        </div>
      ))}
    </div>
  )
}

/** A 50 mm ruler: if it doesn't measure 50 mm on paper, the printer scaled the page. */
function CalibrationBar({ y, name }: { y: number; name: string }) {
  const x = 12
  return (
    <g fontFamily="Inter, sans-serif" fill="#555">
      <line x1={x} x2={x + 50} y1={y} y2={y} stroke="#333" strokeWidth={0.25} />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <line x1={x + i * 10} x2={x + i * 10} y1={y - 1.8} y2={y} stroke="#333" strokeWidth={0.25} />
          <text x={x + i * 10} y={y - 2.6} fontSize={2.2} textAnchor="middle">
            {i * 10}
          </text>
        </g>
      ))}
      <text x={x} y={y + 4} fontSize={2.6}>
        Check this ruler measures exactly 50 mm. If not, print again with scaling set to 100% / Actual size.
      </text>
      <text x={x} y={y + 7.5} fontSize={2.4} fill="#888">
        {name}
      </text>
    </g>
  )
}
