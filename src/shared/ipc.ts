/** Commands the main-process menu sends to the renderer. */
export type MenuCommand =
  | 'new'
  | 'save'
  | 'saveAs'
  | 'exportPdf'
  | 'print'
  | 'undo'
  | 'redo'
  | 'selectAll'
  | 'duplicate'
  | 'bringForward'
  | 'sendBackward'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'

export interface LoadedFile {
  path: string
  content: string
}

export interface PdfOptions {
  /** Paper size in mm, matching the CSS @page size of the print view. */
  widthMm: number
  heightMm: number
  defaultName: string
}

export interface Api {
  saveFile(path: string | null, content: string, defaultName: string): Promise<string | null>
  autosaveWrite(content: string): Promise<void>
  autosaveRead(): Promise<string | null>
  exportPdf(opts: PdfOptions): Promise<string | null>
  print(opts: PdfOptions): Promise<boolean>
  onMenu(cb: (cmd: MenuCommand) => void): () => void
  onFileLoaded(cb: (file: LoadedFile) => void): () => void
  openFile(): Promise<void>
}
