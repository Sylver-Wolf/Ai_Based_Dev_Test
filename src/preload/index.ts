import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { UpdateState } from '../shared/update'

// Custom APIs for renderer
const api = {
  loadSavedInputs: (): Promise<string[]> => ipcRenderer.invoke('saved-inputs:load'),
  saveInput: (input: string): Promise<string[]> => ipcRenderer.invoke('saved-inputs:save', input),
  deleteSavedInput: (index: number): Promise<string[]> =>
    ipcRenderer.invoke('saved-inputs:delete', index),
  getUpdateState: (): Promise<UpdateState | null> => ipcRenderer.invoke('updates:get-state'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('updates:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updates:install'),
  onUpdateState: (callback: (state: UpdateState | null) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState | null): void => {
      callback(state)
    }
    ipcRenderer.on('updates:state-changed', listener)
    return () => ipcRenderer.removeListener('updates:state-changed', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
