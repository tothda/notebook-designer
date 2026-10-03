import { DESIGN_VERSION, type Design, type Element } from './model'
import { DEFAULT_NOTEBOOK } from './presets'
import { DEFAULT_PALETTE } from './palette'

export const FILE_EXTENSION = 'nbdesign'

export function newDesign(): Design {
  return {
    version: DESIGN_VERSION,
    notebook: { ...DEFAULT_NOTEBOOK },
    spread: 'double',
    palette: [...DEFAULT_PALETTE],
    elements: []
  }
}

export function serializeDesign(design: Design): string {
  return JSON.stringify(design, null, 2)
}

export class DesignParseError extends Error {}

const ELEMENT_TYPES = new Set<Element['type']>(['line', 'rect', 'ellipse', 'text', 'dot'])

/** Parse and validate a saved design, filling defaults for missing optional fields. */
export function parseDesign(json: string): Design {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new DesignParseError('File is not valid JSON')
  }
  if (!isObject(raw)) throw new DesignParseError('File does not contain a design')
  const version = raw.version
  if (typeof version !== 'number') throw new DesignParseError('Missing design version')
  if (version > DESIGN_VERSION) {
    throw new DesignParseError(`Design was saved by a newer version (v${version}) of Notebook Designer`)
  }
  const base = newDesign()
  const nb = isObject(raw.notebook) ? raw.notebook : {}
  const notebook = { ...base.notebook }
  for (const key of Object.keys(notebook) as (keyof typeof notebook)[]) {
    const v = nb[key]
    if (key === 'name') {
      if (typeof v === 'string') notebook.name = v
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      notebook[key] = v
    }
  }
  if (notebook.dotPitchMm <= 0) throw new DesignParseError('Dot pitch must be positive')
  const elements = Array.isArray(raw.elements) ? raw.elements : []
  for (const el of elements) {
    if (!isObject(el) || !ELEMENT_TYPES.has(el.type as Element['type']) || typeof el.id !== 'string') {
      throw new DesignParseError('Design contains an unknown element')
    }
  }
  return {
    version: DESIGN_VERSION,
    notebook,
    spread: raw.spread === 'single' ? 'single' : 'double',
    palette:
      Array.isArray(raw.palette) && raw.palette.every((c) => typeof c === 'string') && raw.palette.length > 0
        ? (raw.palette as string[])
        : base.palette,
    elements: (elements as unknown as Element[]).map((el) =>
      el.type === 'text' && el.placement !== 'between' ? { ...el, placement: 'baseline' } : el
    )
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
