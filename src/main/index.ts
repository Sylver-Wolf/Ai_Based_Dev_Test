import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

const savedInputsPath = (): string => join(app.getPath('userData'), 'saved-inputs.json')

async function promptToInstallUpdate(version: string): Promise<void> {
  try {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${version} a été téléchargée.`,
      detail: 'Redémarrez l’application pour installer la mise à jour.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
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

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('error', (error) => {
    console.error('Automatic update error:', error)
  })
  autoUpdater.on('update-downloaded', (event) => {
    void promptToInstallUpdate(event.version)
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
  await writeFile(savedInputsPath(), `${JSON.stringify(savedInputs, null, 2)}\n`, 'utf8')
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
  await writeFile(savedInputsPath(), `${JSON.stringify(savedInputs, null, 2)}\n`, 'utf8')
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
