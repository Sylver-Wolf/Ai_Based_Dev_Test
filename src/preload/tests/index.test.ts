import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../shared/update'

type ExposedPreloadApi = {
  loadSavedInputs: () => Promise<string[]>
  saveInput: (input: string) => Promise<string[]>
  deleteSavedInput: (index: number) => Promise<string[]>
  getUpdateState: () => Promise<UpdateState | null>
  downloadUpdate: () => Promise<void>
  onUpdateState: (callback: (state: UpdateState | null) => void) => () => void
}

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  electronAPI: { test: 'electron-api' }
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener
  }
}))

vi.mock('@electron-toolkit/preload', () => ({ electronAPI: mocks.electronAPI }))

describe('preload API', () => {
  let contextIsolationDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    contextIsolationDescriptor = Object.getOwnPropertyDescriptor(process, 'contextIsolated')
  })

  afterEach(() => {
    if (contextIsolationDescriptor) {
      Object.defineProperty(process, 'contextIsolated', contextIsolationDescriptor)
    } else {
      Reflect.deleteProperty(process, 'contextIsolated')
    }
    vi.resetModules()
  })

  async function loadPreload(contextIsolated: boolean): Promise<void> {
    Object.defineProperty(process, 'contextIsolated', {
      configurable: true,
      value: contextIsolated
    })
    await import('../index')
  }

  function exposedApi(): ExposedPreloadApi {
    const call = mocks.exposeInMainWorld.mock.calls.find((args) => args[0] === 'api')
    if (!call) throw new Error('Preload API was not exposed.')
    return call[1] as ExposedPreloadApi
  }

  it('exposes Electron and app APIs through contextBridge when isolation is enabled', async () => {
    await loadPreload(true)

    expect(mocks.exposeInMainWorld).toHaveBeenNthCalledWith(1, 'electron', mocks.electronAPI)
    expect(mocks.exposeInMainWorld).toHaveBeenNthCalledWith(2, 'api', expect.any(Object))
  })

  it('maps saved-input and update methods to their IPC channels', async () => {
    await loadPreload(true)
    const api = exposedApi()
    mocks.invoke.mockResolvedValue([])

    await api.loadSavedInputs()
    await api.saveInput('text')
    await api.deleteSavedInput(3)
    await api.getUpdateState()
    await api.downloadUpdate()

    expect(mocks.invoke.mock.calls).toEqual([
      ['saved-inputs:load'],
      ['saved-inputs:save', 'text'],
      ['saved-inputs:delete', 3],
      ['updates:get-state'],
      ['updates:download']
    ])
  })

  it('forwards update events and removes the exact IPC listener on unsubscribe', async () => {
    await loadPreload(true)
    const api = exposedApi()
    const callback = vi.fn<(state: UpdateState | null) => void>()
    const state: UpdateState = { status: 'available', version: '2.0.0' }

    api.onUpdateState(callback)
    const [channel] = mocks.on.mock.calls[0]
    const listener = mocks.on.mock.calls[0][1] as (
      event: unknown,
      state: UpdateState | null
    ) => void
    expect(channel).toBe('updates:state-changed')
    listener({}, state)
    expect(callback).toHaveBeenCalledWith(state)

    const unsubscribe = api.onUpdateState(callback)
    const secondListener = mocks.on.mock.calls[1][1]
    unsubscribe()
    expect(mocks.removeListener).toHaveBeenCalledWith('updates:state-changed', secondListener)
  })

  it('assigns the APIs to window when context isolation is disabled', async () => {
    await loadPreload(false)

    expect(Reflect.get(window, 'electron')).toBe(mocks.electronAPI)
    expect(Reflect.get(window, 'api')).toEqual(
      expect.objectContaining({
        loadSavedInputs: expect.any(Function),
        onUpdateState: expect.any(Function)
      })
    )
    expect(mocks.exposeInMainWorld).not.toHaveBeenCalled()
  })
})
