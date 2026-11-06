import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../shared/update'
import icon from '../../resources/icon.png?asset'

const savedInputsPath = (): string =>
  is.dev
    ? join(app.getAppPath(), 'test-data', 'saved-inputs.json')
    : join(app.getPath('userData'), 'saved-inputs.json')

if (is.dev) {
  app.setPath('userData', join(app.getPath('appData'), `${app.getName()}-dev`))
}

let updateState: UpdateState | null = null

function setUpdateState(state: UpdateState | null): void {
  updateState = state
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('updates:state-changed', state)
  }
}

async function promptToInstallUpdate(version: string): Promise<void> {
  try {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Version ${version} has been downloaded.`,
      detail:
        'Would you like to restart now? Otherwise, the update will be installed when you close the application.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })

    if (response === 0) {
      autoUpdater.quitAndInstall(false, true)
    }
  } catch (error) {
    console.error('Unable to prompt to install the downloaded update:', error)
  }
}

function checkForUpdates(): void {
  if (is.dev || process.platform !== 'win32') return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-available', (info) => {
    setUpdateState({ status: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    setUpdateState(null)
  })
  autoUpdater.on('download-progress', (progress) => {
    if (updateState?.status === 'downloading') {
      setUpdateState({
        ...updateState,
        percent: progress.percent
      })
    }
  })
  autoUpdater.on('update-downloaded', (event) => {
    autoUpdater.autoInstallOnAppQuit = true
    setUpdateState({ status: 'downloaded', version: event.version })
    void promptToInstallUpdate(event.version)
  })
  autoUpdater.on('error', (error) => {
    console.error('Automatic update error:', error)
    if (updateState?.status === 'downloading') {
      setUpdateState({
        status: 'available',
        version: updateState.version,
        error: 'The download failed. You can try again.'
      })
    }
  })

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error('Unable to check for updates:', error)
  })
}

async function loadSavedInputs(): Promise<string[]> {
  let contents: string
  try {
    contents = await readFile(savedInputsPath(), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const parsed: unknown = JSON.parse(contents)
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
    throw new Error('Saved inputs file must contain a JSON array of strings.')
  }

  return parsed
}

async function saveInput(input: unknown): Promise<string[]> {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be text.')
  }

  const savedInputs = await loadSavedInputs()
  savedInputs.push(input)
  const filePath = savedInputsPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(savedInputs, null, 2)}\n`, 'utf8')
  return savedInputs
}

async function deleteSavedInput(index: unknown): Promise<string[]> {
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    throw new TypeError('Saved input index must be an integer.')
  }

  const savedInputs = await loadSavedInputs()
  if (index < 0 || index >= savedInputs.length) {
    throw new RangeError('Saved input does not exist.')
  }

  savedInputs.splice(index, 1)
  const filePath = savedInputsPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(savedInputs, null, 2)}\n`, 'utf8')
  return savedInputs
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('saved-inputs:load', () => loadSavedInputs())
  ipcMain.handle('saved-inputs:save', (_event, input: unknown) => saveInput(input))
  ipcMain.handle('saved-inputs:delete', (_event, index: unknown) => deleteSavedInput(index))
  ipcMain.handle('updates:get-state', () => updateState)
  ipcMain.handle('updates:download', async () => {
    if (updateState?.status !== 'available') {
      throw new Error('No update is available to download.')
    }

    const { version } = updateState
    setUpdateState({ status: 'downloading', version, percent: 0 })
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      console.error('Unable to download the update:', error)
      setUpdateState({
        status: 'available',
        version,
        error: 'The download failed. You can try again.'
      })
      throw error
    }
  })

  createWindow()
  checkForUpdates()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
