# Notebook Designer

Design layouts for dotted notebooks (e.g. a Moleskine A6 monthly spread) on a true-to-scale dot grid, then copy them onto paper by counting dots.

```bash
npm install
npm run dev     # launch the desktop app
npm test        # unit tests
```

- **Tools:** Select (V), Line (L), Box (R), Ellipse (O), Text (T), Dot/bullet (D). Everything snaps to dots; hold Alt to place freely, Shift for straight lines and squares.
- **Copying aid:** the *Selection* panel shows where each element starts and ends, as 1-based dot column/row numbers, plus its length in dot spaces and mm.
- **Repeat:** ⌘D duplicates. Move the copy, then ⌘D again repeats the same step (fast calendar grids).
- **Pages:** the strip under the canvas adds, duplicates, reorders and deletes spreads (or pages in single-page mode); PageUp/PageDown switch between them.
- **Notebook tab:** presets plus custom page size, dot spacing and first-dot offset. Measure your notebook and adjust. The ink palette is editable.
- **Print / Export PDF (⌘P):** true 100% scale, all pages or just the current spread, either on A4 with a 50 mm calibration ruler or at exact page size.
- Designs save as `.nbdesign` JSON files; the current design is also autosaved and restored on launch.
