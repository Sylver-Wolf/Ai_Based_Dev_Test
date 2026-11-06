import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'path'

type IPCHandler = (...args: unknown[]) => unknown
type EventHandler = (...args: unknown[]) => void

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IPCHandler>(),
  appListeners: new Map<string, EventHandler>(),
  updaterListeners: new Map<string, EventHandler>(),
  windowListeners: new Map<string, EventHandler>(),
  windows: [] as Array<{
    options: unknown
    show: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    webContents: {
      send: ReturnType<typeof vi.fn>
      setWindowOpenHandler: ReturnType<typeof vi.fn>
    }
    loadURL: ReturnType<typeof vi.fn>
    loadFile: ReturnType<typeof vi.fn>
  }>,
  windowOpenHandler: undefined as ((details: { url: string }) => unknown) | undefined,
  userDataPath: 'C:\\mock-user-data',
  appDataPath: 'C:\\mock-app-data',
  appPath: 'C:\\mock-project',
  appName: 'Ai_Based_Dev_Test',
  isDev: false,
  appWhenReady: vi.fn(),
  appOn: vi.fn(),
  appSetPath: vi.fn(),
  appQuit: vi.fn(),
  setAppUserModelId: vi.fn(),
  watchWindowShortcuts: vi.fn(),
  ipcOn: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
  updaterOn: vi.fn(),
  openExternal: vi.fn()
}))

vi.mock('electron', () => {
  class BrowserWindow {
    constructor(options: unknown) {
      const instance = {
        options,
        show: vi.fn(),
        on: vi.fn((event: string, callback: EventHandler) => {
          mocks.windowListeners.set(event, callback)
        }),
        webContents: {
          send: vi.fn(),
          setWindowOpenHandler: vi.fn((handler: (details: { url: string }) => unknown) => {
            mocks.windowOpenHandler = handler
          })
        },
        loadURL: vi.fn(),
        loadFile: vi.fn()
      }
      mocks.windows.push(instance)
      return instance
    }

    static getAllWindows(): typeof mocks.windows {
      return mocks.windows
    }
  }

  return {
    app: {
      getPath: vi.fn((name: string) =>
        name === 'appData' ? mocks.appDataPath : mocks.userDataPath
      ),
      getName: vi.fn(() => mocks.appName),
      setPath: mocks.appSetPath,
      getAppPath: vi.fn(() => mocks.appPath),
      whenReady: mocks.appWhenReady,
      on: mocks.appOn,
      quit: mocks.appQuit
    },
    shell: { openExternal: mocks.openExternal },
    BrowserWindow,
    ipcMain: {
      on: mocks.ipcOn,
      handle: vi.fn((channel: string, handler: IPCHandler) => {
        mocks.handlers.set(channel, handler)
      })
    }
  }
})

vi.mock('fs/promises', () => ({
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  writeFile: mocks.writeFile
}))

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: mocks.setAppUserModelId },
  optimizer: { watchWindowShortcuts: mocks.watchWindowShortcuts },
  is: {
    get dev() {
      return mocks.isDev
    }
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    on: mocks.updaterOn,
    checkForUpdates: mocks.checkForUpdates,
    downloadUpdate: mocks.downloadUpdate,
    quitAndInstall: mocks.quitAndInstall
  }
}))

describe('main process IPC', () => {
  let platformDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handlers.clear()
    mocks.appListeners.clear()
    mocks.updaterListeners.clear()
    mocks.windowListeners.clear()
    mocks.windows.splice(0)
    mocks.windowOpenHandler = undefined
    mocks.userDataPath = 'C:\\mock-user-data'
    mocks.appDataPath = 'C:\\mock-app-data'
    mocks.appPath = 'C:\\mock-project'
    mocks.appName = 'Ai_Based_Dev_Test'
    mocks.isDev = false
    mocks.appWhenReady.mockResolvedValue(undefined)
    mocks.appOn.mockImplementation((event: string, listener: EventHandler) => {
      mocks.appListeners.set(event, listener)
    })
    mocks.updaterOn.mockImplementation((event: string, listener: EventHandler) => {
      mocks.updaterListeners.set(event, listener)
    })
    mocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.checkForUpdates.mockResolvedValue(undefined)
    mocks.downloadUpdate.mockResolvedValue(undefined)

    platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    vi.resetModules()
  })

  afterEach(() => {
    if (platformDescriptor) {
      Object.defineProperty(process, 'platform', platformDescriptor)
    }
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function startMain(platform: NodeJS.Platform = 'win32'): Promise<void> {
    Object.defineProperty(process, 'platform', { configurable: true, value: platform })
    await import('../index')
    await vi.waitFor(() => expect(mocks.handlers.has('saved-inputs:load')).toBe(true))
  }

  async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = mocks.handlers.get(channel)
    if (!handler) throw new Error(`No IPC handler registered for ${channel}.`)
    return handler({}, ...args)
  }

  function emitUpdater(event: string, ...args: unknown[]): void {
    const listener = mocks.updaterListeners.get(event)
    if (!listener) throw new Error(`No updater listener registered for ${event}.`)
    listener(...args)
  }

  it('initializes the app window and opens external links outside Electron', async () => {
    await startMain()

    expect(mocks.appSetPath).not.toHaveBeenCalled()
    expect(mocks.setAppUserModelId).toHaveBeenCalledWith('com.electron')
    expect(mocks.windows).toHaveLength(1)
    expect(mocks.windows[0].loadFile).toHaveBeenCalledOnce()
    mocks.appListeners.get('browser-window-created')?.({}, mocks.windows[0])
    expect(mocks.watchWindowShortcuts).toHaveBeenCalled()

    const openHandler = mocks.windowOpenHandler
    expect(openHandler?.({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com')

    mocks.windowListeners.get('ready-to-show')?.()
    expect(mocks.windows[0].show).toHaveBeenCalledOnce()
  })

  it('checks for updates periodically without registering duplicate updater listeners', async () => {
    vi.useFakeTimers()
    await startMain()

    expect(mocks.checkForUpdates).toHaveBeenCalledOnce()
    expect(mocks.updaterListeners.size).toBe(5)

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    expect(mocks.checkForUpdates).toHaveBeenCalledTimes(2)
    expect(mocks.updaterListeners.size).toBe(5)
  })

  it('loads missing storage as empty and validates stored JSON contents', async () => {
    await startMain()
    expect(await invoke('saved-inputs:load')).toEqual([])

    mocks.readFile.mockResolvedValueOnce('["first","second"]')
    expect(await invoke('saved-inputs:load')).toEqual(['first', 'second'])

    mocks.readFile.mockResolvedValueOnce('{"not":"an array"}')
    await expect(invoke('saved-inputs:load')).rejects.toThrow(
      'Saved inputs file must contain a JSON array of strings.'
    )
    mocks.readFile.mockResolvedValueOnce('["valid",42]')
    await expect(invoke('saved-inputs:load')).rejects.toThrow(
      'Saved inputs file must contain a JSON array of strings.'
    )

    mocks.readFile.mockRejectedValueOnce(new Error('permission denied'))
    await expect(invoke('saved-inputs:load')).rejects.toThrow('permission denied')
  })

  it('saves text, rejects non-text input, and propagates storage failures', async () => {
    await startMain()
    mocks.readFile.mockResolvedValueOnce('["existing"]')

    expect(await invoke('saved-inputs:save', 'added')).toEqual(['existing', 'added'])
    expect(mocks.writeFile).toHaveBeenCalledWith(
      join(mocks.userDataPath, 'saved-inputs.json'),
      '[\n  "existing",\n  "added"\n]\n',
      'utf8'
    )
    expect(mocks.mkdir).toHaveBeenCalledWith(mocks.userDataPath, { recursive: true })

    await expect(invoke('saved-inputs:save', 42)).rejects.toThrow('Input must be text.')
    mocks.writeFile.mockRejectedValueOnce(new Error('disk full'))
    await expect(invoke('saved-inputs:save', 'new')).rejects.toThrow('disk full')
  })

  it('stores development inputs in the project test-data folder', async () => {
    mocks.isDev = true
    await startMain()
    expect(mocks.appSetPath).toHaveBeenCalledWith(
      'userData',
      join(mocks.appDataPath, `${mocks.appName}-dev`)
    )
    expect(mocks.appSetPath.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appWhenReady.mock.invocationCallOrder[0]
    )
    mocks.readFile.mockResolvedValueOnce('[]')

    expect(await invoke('saved-inputs:save', 'test input')).toEqual(['test input'])
    expect(mocks.readFile).toHaveBeenCalledWith(
      join(mocks.appPath, 'test-data', 'saved-inputs.json'),
      'utf8'
    )
    expect(mocks.mkdir).toHaveBeenCalledWith(join(mocks.appPath, 'test-data'), {
      recursive: true
    })
    expect(mocks.writeFile).toHaveBeenCalledWith(
      join(mocks.appPath, 'test-data', 'saved-inputs.json'),
      '[\n  "test input"\n]\n',
      'utf8'
    )
  })

  it('deletes only an existing integer index and persists the remaining items', async () => {
    await startMain()
    mocks.readFile.mockResolvedValue('["first","second"]')

    expect(await invoke('saved-inputs:delete', 0)).toEqual(['second'])
    expect(mocks.writeFile).toHaveBeenCalledWith(
      join(mocks.userDataPath, 'saved-inputs.json'),
      '[\n  "second"\n]\n',
      'utf8'
    )
    await expect(invoke('saved-inputs:delete', 2)).rejects.toThrow('Saved input does not exist.')
    await expect(invoke('saved-inputs:delete', -1)).rejects.toThrow('Saved input does not exist.')
    await expect(invoke('saved-inputs:delete', 0.5)).rejects.toThrow(
      'Saved input index must be an integer.'
    )
    await expect(invoke('saved-inputs:delete', '0')).rejects.toThrow(
      'Saved input index must be an integer.'
    )
  })

  it('tracks update availability, download progress, failures, and completion', async () => {
    await startMain()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    emitUpdater('update-available', { version: '2.1.0' })
    expect(await invoke('updates:get-state')).toEqual({
      status: 'available',
      version: '2.1.0'
    })
    expect(mocks.windows[0].webContents.send).toHaveBeenCalledWith('updates:state-changed', {
      status: 'available',
      version: '2.1.0'
    })

    emitUpdater('download-progress', { percent: 5 })
    emitUpdater('error', new Error('unrelated updater error'))
    expect(await invoke('updates:get-state')).toEqual({
      status: 'available',
      version: '2.1.0'
    })

    const download = invoke('updates:download')
    expect(await invoke('updates:get-state')).toEqual({
      status: 'downloading',
      version: '2.1.0',
      percent: 0
    })
    emitUpdater('download-progress', { percent: 54.6 })
    expect(await invoke('updates:get-state')).toEqual({
      status: 'downloading',
      version: '2.1.0',
      percent: 54.6
    })
    await download
    expect(mocks.downloadUpdate).toHaveBeenCalledOnce()

    emitUpdater('error', new Error('network error'))
    mocks.downloadUpdate.mockRejectedValueOnce(new Error('network error'))
    await expect(invoke('updates:download')).rejects.toThrow('network error')
    expect(await invoke('updates:get-state')).toEqual({
      status: 'available',
      version: '2.1.0',
      error: 'The download failed. You can try again.'
    })
    expect(consoleError).toHaveBeenCalledTimes(3)

    emitUpdater('update-not-available')
    expect(await invoke('updates:get-state')).toBeNull()
  })

  it('rejects update downloads when no update is available', async () => {
    await startMain()
    await expect(invoke('updates:download')).rejects.toThrow('No update is available to download.')
    expect(mocks.downloadUpdate).not.toHaveBeenCalled()
  })

  it('installs a downloaded update when requested over IPC', async () => {
    await startMain()
    await expect(invoke('updates:install')).rejects.toThrow(
      'No downloaded update is ready to install.'
    )

    emitUpdater('update-downloaded', { version: '2.1.0' })

    expect(await invoke('updates:get-state')).toEqual({
      status: 'downloaded',
      version: '2.1.0'
    })
    await invoke('updates:install')
    expect(mocks.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('does not install an update before its download is complete', async () => {
    await startMain()
    emitUpdater('update-available', { version: '2.1.0' })
    await expect(invoke('updates:install')).rejects.toThrow(
      'No downloaded update is ready to install.'
    )
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
  })

  it('skips update checks on Linux and configures the Linux window icon', async () => {
    await startMain('linux')

    expect(mocks.checkForUpdates).not.toHaveBeenCalled()
    expect((mocks.windows[0].options as { icon?: string }).icon).toContain('icon.png?asset')
    expect(mocks.updaterListeners.size).toBe(0)
  })

  it('keeps the app running on macOS when all windows are closed', async () => {
    await startMain('darwin')
    mocks.appListeners.get('window-all-closed')?.()

    expect(mocks.appQuit).not.toHaveBeenCalled()
  })

  it('logs update-check failures while keeping IPC available', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.checkForUpdates.mockRejectedValue(new Error('update server unavailable'))
    await startMain()

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledOnce())
    expect(consoleError).toHaveBeenCalledWith('Unable to check for updates:', expect.any(Error))
    expect(await invoke('updates:get-state')).toBeNull()
  })

  it('quits outside macOS when all windows are closed and recreates a window on activate', async () => {
    await startMain()
    mocks.appListeners.get('window-all-closed')?.()
    expect(mocks.appQuit).toHaveBeenCalledOnce()

    mocks.windows.splice(0)
    mocks.appListeners.get('activate')?.()
    expect(mocks.windows).toHaveLength(1)
  })
})
