import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { FILE_EXTENSION } from '@shared/file'
import type { MenuCommand, PdfOptions } from '@shared/ipc'

const MAX_RECENT = 8
const recentPath = () => join(app.getPath('userData'), 'recent.json')
const autosavePath = () => join(app.getPath('userData'), `autosave.${FILE_EXTENSION}`)
const fileFilters = [{ name: 'Notebook design', extensions: [FILE_EXTENSION] }]

let win: BrowserWindow | null = null
let recent: string[] = []

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Notebook Designer',
    backgroundColor: '#e9e6df',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })
  win.on('closed', () => (win = null))
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function send(cmd: MenuCommand): void {
  win?.webContents.send('menu', cmd)
}

async function loadFile(path: string): Promise<void> {
  try {
    const content = await fs.readFile(path, 'utf8')
    win?.webContents.send('file:loaded', { path, content })
    await addRecent(path)
  } catch (err) {
    dialog.showErrorBox('Could not open file', `${path}\n\n${(err as Error).message}`)
    recent = recent.filter((p) => p !== path)
    await saveRecent()
  }
}

async function openWithDialog(): Promise<void> {
  if (!win) return
  const res = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: fileFilters })
  if (!res.canceled && res.filePaths[0]) await loadFile(res.filePaths[0])
}

async function addRecent(path: string): Promise<void> {
  recent = [path, ...recent.filter((p) => p !== path)].slice(0, MAX_RECENT)
  app.addRecentDocument(path)
  await saveRecent()
}

async function saveRecent(): Promise<void> {
  await fs.writeFile(recentPath(), JSON.stringify(recent))
  buildMenu()
}

async function loadRecent(): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(recentPath(), 'utf8'))
    if (Array.isArray(parsed)) recent = parsed.filter((p): p is string => typeof p === 'string')
  } catch {
    recent = []
  }
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const item = (label: string, cmd: MenuCommand, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(cmd)
  })
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        item('New', 'new', 'CmdOrCtrl+N'),
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => void openWithDialog() },
        {
          label: 'Open Recent',
          submenu: recent.length
            ? [
                ...recent.map((p) => ({ label: basename(p), sublabel: p, click: () => void loadFile(p) })),
                { type: 'separator' as const },
                { label: 'Clear Menu', click: () => void ((recent = []), saveRecent()) }
              ]
            : [{ label: 'No recent files', enabled: false }]
        },
        { type: 'separator' },
        item('Save', 'save', 'CmdOrCtrl+S'),
        item('Save As…', 'saveAs', 'CmdOrCtrl+Shift+S'),
        { type: 'separator' },
        item('Print / Export PDF…', 'exportPdf', 'CmdOrCtrl+P'),
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        item('Undo', 'undo', 'CmdOrCtrl+Z'),
        item('Redo', 'redo', 'CmdOrCtrl+Shift+Z'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        item('Duplicate', 'duplicate', 'CmdOrCtrl+D'),
        item('Select All', 'selectAll', 'CmdOrCtrl+A'),
        { type: 'separator' },
        item('Bring Forward', 'bringForward', 'CmdOrCtrl+]'),
        item('Send Backward', 'sendBackward', 'CmdOrCtrl+['),
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Zoom In', 'zoomIn', 'CmdOrCtrl+='),
        item('Zoom Out', 'zoomOut', 'CmdOrCtrl+-'),
        item('Zoom to Fit', 'zoomFit', 'CmdOrCtrl+0'),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }])
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function mmToInches(mm: number): number {
  return mm / 25.4
}

ipcMain.handle('file:open', () => openWithDialog())

ipcMain.handle('file:save', async (_e, path: string | null, content: string, defaultName: string) => {
  let target = path
  if (!target) {
    if (!win) return null
    const res = await dialog.showSaveDialog(win, { defaultPath: `${defaultName}.${FILE_EXTENSION}`, filters: fileFilters })
    if (res.canceled || !res.filePath) return null
    target = res.filePath
  }
  await fs.writeFile(target, content, 'utf8')
  await addRecent(target)
  return target
})

ipcMain.handle('autosave:write', (_e, content: string) => fs.writeFile(autosavePath(), content, 'utf8'))

ipcMain.handle('autosave:read', async () => {
  try {
    return await fs.readFile(autosavePath(), 'utf8')
  } catch {
    return null
  }
})

ipcMain.handle('pdf:export', async (_e, opts: PdfOptions) => {
  if (!win) return null
  const res = await dialog.showSaveDialog(win, {
    defaultPath: `${opts.defaultName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (res.canceled || !res.filePath) return null
  const data = await win.webContents.printToPDF({
    pageSize: { width: mmToInches(opts.widthMm), height: mmToInches(opts.heightMm) },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    printBackground: true,
    preferCSSPageSize: true
  })
  await fs.writeFile(res.filePath, data)
  void shell.openPath(res.filePath)
  return res.filePath
})

ipcMain.handle('print', (_e, opts: PdfOptions) => {
  return new Promise<boolean>((resolve) => {
    if (!win) return resolve(false)
    win.webContents.print(
      {
        printBackground: true,
        margins: { marginType: 'none' },
        // Electron's print() takes page sizes in microns.
        pageSize: { width: Math.round(opts.widthMm * 1000), height: Math.round(opts.heightMm * 1000) }
      },
      (success) => resolve(success)
    )
  })
})

app.whenReady().then(async () => {
  await loadRecent()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (win) void loadFile(path)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
