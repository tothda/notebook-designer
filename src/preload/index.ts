import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Api, LoadedFile, MenuCommand } from '@shared/ipc'

function listen<T>(channel: string, cb: (arg: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, arg: T) => cb(arg)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  saveFile: (path, content, defaultName) => ipcRenderer.invoke('file:save', path, content, defaultName),
  openFile: () => ipcRenderer.invoke('file:open'),
  ready: () => ipcRenderer.invoke('app:ready'),
  autosaveWrite: (content) => ipcRenderer.invoke('autosave:write', content),
  autosaveRead: () => ipcRenderer.invoke('autosave:read'),
  exportPdf: (opts) => ipcRenderer.invoke('pdf:export', opts),
  print: (opts) => ipcRenderer.invoke('print', opts),
  onMenu: (cb) => listen<MenuCommand>('menu', cb),
  onFileLoaded: (cb) => listen<LoadedFile>('file:loaded', cb)
}

contextBridge.exposeInMainWorld('api', api)
