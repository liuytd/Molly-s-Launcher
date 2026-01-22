import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import log from 'electron-log'
import { setupCustomUpdater } from './customUpdater.js'
import { setupDownloader } from './downloader.js'

// Check if in development mode (will be set after app is ready)
let isDev = process.env.NODE_ENV === 'development' || !!(process.env.ELECTRON_RENDERER_URL)

// Initialize store for app data
const store = new Store({
  name: 'mollys-launcher-data',
  defaults: {
    favorites: [],
    products: [],
    lastCheck: null,
    settings: {
      autoUpdate: true,
      checkInterval: 30 // minutes
    }
  }
})

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 550,
    height: 500,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    icon: join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the app
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open devtools in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

// Store handlers
ipcMain.handle('store:get', (_, key) => {
  return store.get(key)
})

ipcMain.handle('store:set', (_, key, value) => {
  store.set(key, value)
  return true
})

// Favorites handlers
ipcMain.handle('favorites:get', () => {
  return store.get('favorites', [])
})

ipcMain.handle('favorites:add', (_, productId) => {
  const favorites = store.get('favorites', [])
  if (!favorites.includes(productId)) {
    favorites.push(productId)
    store.set('favorites', favorites)
  }
  return favorites
})

ipcMain.handle('favorites:remove', (_, productId) => {
  const favorites = store.get('favorites', [])
  const index = favorites.indexOf(productId)
  if (index > -1) {
    favorites.splice(index, 1)
    store.set('favorites', favorites)
  }
  return favorites
})

ipcMain.handle('favorites:toggle', (_, productId) => {
  const favorites = store.get('favorites', [])
  const index = favorites.indexOf(productId)
  if (index > -1) {
    favorites.splice(index, 1)
  } else {
    favorites.push(productId)
  }
  store.set('favorites', favorites)
  return favorites
})

// Get app version
ipcMain.handle('app:version', () => {
  return app.getVersion()
})

// Get app path for cache
ipcMain.handle('app:getPath', (_, name) => {
  return app.getPath(name)
})

app.whenReady().then(() => {
  // Set app user model id for windows
  app.setAppUserModelId('com.mollys.launcher')

  createWindow()

  // Setup custom updater
  setupCustomUpdater(mainWindow)

  // Setup downloader
  setupDownloader()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Log errors
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason)
})
