import { ipcMain, app } from 'electron'
import log from 'electron-log'

let autoUpdater = null
let mainWindow = null
let updateCheckInterval = null

// Initialize autoUpdater lazily after app is ready
function getAutoUpdater() {
  if (!autoUpdater) {
    const { autoUpdater: updater } = require('electron-updater')
    autoUpdater = updater

    // Configure logging
    autoUpdater.logger = log
    autoUpdater.logger.transports.file.level = 'info'

    // Enable auto download and install
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
  }
  return autoUpdater
}

export function setupUpdater(window) {
  mainWindow = window

  const updater = getAutoUpdater()

  // Auto-updater events
  updater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    sendToRenderer('updater:checking')
  })

  updater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    sendToRenderer('updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })

    // Auto download the update
    updater.downloadUpdate()
  })

  updater.on('update-not-available', () => {
    log.info('No updates available')
    sendToRenderer('updater:not-available')
  })

  updater.on('download-progress', (progress) => {
    sendToRenderer('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  updater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    sendToRenderer('updater:downloaded', {
      version: info.version
    })

    // Auto install after 2 seconds
    setTimeout(() => {
      updater.quitAndInstall(false, true)
    }, 2000)
  })

  updater.on('error', (error) => {
    log.error('Updater error:', error)
    sendToRenderer('updater:error', {
      message: error.message
    })
  })

  // Check for updates on startup
  setTimeout(() => {
    checkForUpdates()
  }, 3000) // Wait 3 seconds after startup

  // Check every 30 minutes
  updateCheckInterval = setInterval(() => {
    checkForUpdates()
  }, 30 * 60 * 1000) // 30 minutes

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    return await checkForUpdates()
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await getAutoUpdater().downloadUpdate()
      return { success: true }
    } catch (error) {
      log.error('Download error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('updater:install', () => {
    getAutoUpdater().quitAndInstall(false, true)
  })

  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion()
  })
}

async function checkForUpdates() {
  try {
    const updater = getAutoUpdater()
    const result = await updater.checkForUpdates()
    return {
      success: true,
      updateAvailable: result?.updateInfo?.version !== app.getVersion(),
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version
    }
  } catch (error) {
    log.error('Check for updates error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

function sendToRenderer(channel, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

export function stopUpdateChecker() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
  }
}
