import { ElectronAPI } from '@electron-toolkit/preload'
import type { UpdateState } from '../shared/update'

interface AppAPI {
  loadSavedInputs: () => Promise<string[]>
  saveInput: (input: string) => Promise<string[]>
  deleteSavedInput: (index: number) => Promise<string[]>
  getUpdateState: () => Promise<UpdateState | null>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateState: (callback: (state: UpdateState | null) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
