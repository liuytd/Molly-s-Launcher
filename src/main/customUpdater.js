import { app, ipcMain } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, unlinkSync } from 'fs'
import { get as httpsGet } from 'https'
import { exec } from 'child_process'
import log from 'electron-log'

const VERSION_URL = 'https://raw.githubusercontent.com/liuytd/Molly-s-Launcher/main/version.ml.json'
let mainWindow = null
let updateCheckInterval = null

export function setupCustomUpdater(window) {
  mainWindow = window

  // Check for updates on startup
  setTimeout(() => {
    checkForUpdates()
  }, 3000)

  // Check every 30 minutes
  updateCheckInterval = setInterval(() => {
    checkForUpdates()
  }, 30 * 60 * 1000)

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    return await checkForUpdates()
  })

  ipcMain.handle('updater:install', async (_, downloadUrl) => {
    return await downloadAndInstall(downloadUrl)
  })

  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion()
  })
}

async function checkForUpdates() {
  try {
    log.info('Checking for updates from GitHub...')

    const versionData = await fetchJSON(VERSION_URL)
    const currentVersion = app.getVersion()
    const latestVersion = versionData.version

    log.info(`Current version: ${currentVersion}, Latest version: ${latestVersion}`)

    if (compareVersions(latestVersion, currentVersion) > 0) {
      log.info('Update available!')
      sendToRenderer('updater:available', {
        version: latestVersion,
        downloadUrl: versionData.downloadUrl,
        changelog: versionData.changelog
      })

      return {
        success: true,
        updateAvailable: true,
        currentVersion,
        latestVersion,
        downloadUrl: versionData.downloadUrl
      }
    } else {
      log.info('No updates available')
      sendToRenderer('updater:not-available')
      return {
        success: true,
        updateAvailable: false,
        currentVersion,
        latestVersion
      }
    }
  } catch (error) {
    log.error('Check for updates error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function downloadAndInstall(downloadUrl) {
  try {
    log.info('Downloading update from:', downloadUrl)
    sendToRenderer('updater:downloading')

    const tempPath = join(app.getPath('temp'), 'MollysLauncher-update.exe')

    // Delete old temp file if exists
    if (existsSync(tempPath)) {
      unlinkSync(tempPath)
    }

    // Download the file
    await downloadFile(downloadUrl, tempPath, (progress) => {
      sendToRenderer('updater:progress', progress)
    })

    log.info('Download complete, installing...')
    sendToRenderer('updater:downloaded')

    // Launch installer and quit
    exec(`"${tempPath}" /S`, (error) => {
      if (error) {
        log.error('Install error:', error)
      }
    })

    // Wait a bit then quit
    setTimeout(() => {
      app.quit()
    }, 500)

    return { success: true }
  } catch (error) {
    log.error('Download and install error:', error)
    sendToRenderer('updater:error', { message: error.message })
    return {
      success: false,
      error: error.message
    }
  }
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    httpsGet(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'], 10)
      let downloadedSize = 0

      const file = createWriteStream(destPath)

      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        if (onProgress && totalSize) {
          onProgress({
            percent: (downloadedSize / totalSize) * 100,
            downloaded: downloadedSize,
            total: totalSize
          })
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        resolve(destPath)
      })

      file.on('error', (err) => {
        if (existsSync(destPath)) {
          unlinkSync(destPath)
        }
        reject(err)
      })
    }).on('error', reject)
  })
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    httpsGet(url, (response) => {
      let data = ''

      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0

    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }

  return 0
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
