import { app, ipcMain } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs'
import { get as httpsGet } from 'https'
import { exec } from 'child_process'
import log from 'electron-log'

// Use GitHub API instead of raw.githubusercontent.com to avoid aggressive caching
const VERSION_URL = 'https://api.github.com/repos/liuytd/Molly-s-Launcher/contents/version.ml.json'
const SKIP_VERSION_FILE = join(app.getPath('userData'), 'skip_update_version.txt')
let mainWindow = null
let updateCheckInterval = null

// Track versions we should skip (already tried and failed)
function getSkippedVersion() {
  try {
    if (existsSync(SKIP_VERSION_FILE)) {
      return readFileSync(SKIP_VERSION_FILE, 'utf-8').trim()
    }
  } catch (e) {
    log.error('Error reading skip version file:', e)
  }
  return null
}

function setSkippedVersion(version) {
  try {
    writeFileSync(SKIP_VERSION_FILE, version)
  } catch (e) {
    log.error('Error writing skip version file:', e)
  }
}

function clearSkippedVersion() {
  try {
    if (existsSync(SKIP_VERSION_FILE)) {
      unlinkSync(SKIP_VERSION_FILE)
    }
  } catch (e) {
    log.error('Error clearing skip version file:', e)
  }
}

export function setupCustomUpdater(window) {
  mainWindow = window

  // Check for updates on startup
  setTimeout(() => {
    checkForUpdates()
  }, 3000)

  // Check every 5 minutes
  updateCheckInterval = setInterval(() => {
    checkForUpdates()
  }, 5 * 60 * 1000)

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    return await checkForUpdates()
  })

  ipcMain.handle('updater:install', async (_, downloadUrl, targetVersion) => {
    return await downloadAndInstall(downloadUrl, targetVersion)
  })

  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion()
  })
}

async function checkForUpdates() {
  try {
    log.info('Checking for updates from GitHub...')

    // Add timestamp to bypass cache
    const cacheBustUrl = `${VERSION_URL}?ref=main&t=${Date.now()}`
    const apiResponse = await fetchJSON(cacheBustUrl)

    // Decode base64 content from GitHub API
    const content = Buffer.from(apiResponse.content, 'base64').toString('utf-8')
    const versionData = JSON.parse(content)

    const currentVersion = app.getVersion()
    const latestVersion = versionData.version
    const skippedVersion = getSkippedVersion()

    log.info(`Current version: ${currentVersion}, Latest version: ${latestVersion}, Skipped: ${skippedVersion}`)

    // Clear skipped version if we successfully updated to that version or newer
    if (skippedVersion && compareVersions(currentVersion, skippedVersion) >= 0) {
      log.info(`Successfully updated to ${currentVersion}, clearing skip for ${skippedVersion}`)
      clearSkippedVersion()
    }

    // If we already tried this version and it didn't work (we're still on old version), skip it
    if (skippedVersion === latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
      log.info(`Version ${latestVersion} was already attempted but we're still on ${currentVersion}, skipping to prevent loop`)
      sendToRenderer('updater:not-available')
      return {
        success: true,
        updateAvailable: false,
        currentVersion,
        latestVersion,
        skipped: true
      }
    }

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

async function downloadAndInstall(downloadUrl, targetVersion) {
  try {
    const currentVersion = app.getVersion()
    log.info('Downloading update from:', downloadUrl)
    log.info(`Updating from ${currentVersion} to ${targetVersion}`)

    // Prevent downloading same version (infinite loop protection)
    if (!targetVersion || targetVersion === currentVersion) {
      log.info('Target version is same as current or not provided, skipping download')
      if (targetVersion) {
        setSkippedVersion(targetVersion) // Mark as skipped to prevent future attempts
      }
      sendToRenderer('updater:not-available')
      return { success: false, error: 'Already on latest version' }
    }

    // Mark this version as attempted - if we crash/loop, we won't try again
    setSkippedVersion(targetVersion)

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

    // Create a VBScript to install and relaunch with proper elevation
    const vbsPath = join(app.getPath('temp'), 'update-and-relaunch.vbs')
    const installPath = 'C:\\Program Files\\Mollys Launcher\\Mollys Launcher.exe'

    // VBScript handles elevation and timing better than batch
    const vbsScript = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Install the update silently
WshShell.Run """${tempPath.replace(/\\/g, '\\\\')}""" & " /S", 0, True

' Wait for installation to complete (5 seconds)
WScript.Sleep 5000

' Launch the application
If fso.FileExists("${installPath.replace(/\\/g, '\\\\')}") Then
    WshShell.Run """${installPath.replace(/\\/g, '\\\\')}""", 1, False
End If

' Clean up
WScript.Sleep 1000
On Error Resume Next
fso.DeleteFile("${tempPath.replace(/\\/g, '\\\\')}"), True
fso.DeleteFile(WScript.ScriptFullName), True
`

    writeFileSync(vbsPath, vbsScript)

    // Launch the VBScript
    exec(`wscript.exe "${vbsPath}"`, { detached: true, stdio: 'ignore' })

    // DON'T clear skipped version here - let it persist
    // It will only be cleared when the app starts with the new version
    // This prevents infinite loops if the installer fails or installs wrong version

    // Wait a bit then quit to allow installer to run
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
    const options = {
      headers: {
        'User-Agent': 'Mollys-Launcher',
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }

    httpsGet(url, options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        fetchJSON(response.headers.location)
          .then(resolve)
          .catch(reject)
        return
      }

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
