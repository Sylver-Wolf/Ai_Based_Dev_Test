import { ElectronAPI } from '@electron-toolkit/preload'

interface AppAPI {
  loadSavedInputs: () => Promise<string[]>
  saveInput: (input: string) => Promise<string[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
