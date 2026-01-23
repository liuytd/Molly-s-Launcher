import { ipcMain, shell } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync, unlinkSync, statSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { get } from 'https'
import { get as httpGet } from 'http'
import log from 'electron-log'
import { spawn } from 'child_process'

const MOLLY_FOLDER = 'C:\\Launcher_Mollys'
const LOCAL_LOADER_VERSIONS = join(MOLLY_FOLDER, 'loader_versions.json')

export function setupDownloader() {
  // Ensure C:\MOLLY_Multiloader exists
  if (!existsSync(MOLLY_FOLDER)) {
    mkdirSync(MOLLY_FOLDER, { recursive: true })
  }

  // Download an EXE file
  ipcMain.handle('download:exe', async (_, { url, filename, productId }) => {
    try {
      // Create product folder
      const productFolder = join(MOLLY_FOLDER, productId)
      if (!existsSync(productFolder)) {
        mkdirSync(productFolder, { recursive: true })
      }

      const filePath = join(productFolder, filename)

      // Check if file already exists
      if (existsSync(filePath)) {
        log.info(`File ${filename} already exists at ${filePath}`)
        return {
          success: true,
          path: filePath,
          cached: true
        }
      }

      // Download the file
      log.info(`Downloading ${filename} from ${url}`)

      await downloadFile(url, filePath, (progress) => {
        // Send progress to renderer if needed
      })

      // Update loader_versions.json with LastCheck timestamp
      updateProductLastCheck(productId)

      return {
        success: true,
        path: filePath,
        cached: false
      }
    } catch (error) {
      log.error('Download error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // Check if EXE is downloaded
  ipcMain.handle('download:checkCache', async (_, { productId, filename }) => {
    const productFolder = join(MOLLY_FOLDER, productId)
    const filePath = join(productFolder, filename)
    const exists = existsSync(filePath)

    if (exists) {
      const stats = statSync(filePath)
      return {
        cached: true,
        path: filePath,
        size: stats.size,
        modifiedAt: stats.mtime
      }
    }

    return { cached: false }
  })

  // Launch an EXE
  ipcMain.handle('exe:launch', async (_, { path, args = [] }) => {
    try {
      if (!existsSync(path)) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      log.info(`Launching ${path}`)

      const child = spawn(path, args, {
        detached: true,
        stdio: 'ignore'
      })

      child.unref()

      return { success: true }
    } catch (error) {
      log.error('Launch error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // Launch an EXE as Administrator
  ipcMain.handle('exe:launchAsAdmin', async (_, { path }) => {
    try {
      if (!existsSync(path)) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      log.info(`Launching ${path} as Administrator`)

      // Use PowerShell to run as admin
      const child = spawn('powershell.exe', [
        '-Command',
        `Start-Process -FilePath "${path}" -Verb RunAs`
      ], {
        detached: true,
        stdio: 'ignore',
        shell: true
      })

      child.unref()

      return { success: true }
    } catch (error) {
      log.error('Launch as admin error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // Clear all cached files
  ipcMain.handle('cache:clear', async () => {
    try {
      if (!existsSync(LOCAL_LOADER_VERSIONS)) {
        return { success: true, message: 'No cache to clear' }
      }

      const loaderVersions = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))

      for (const [productId, product] of Object.entries(loaderVersions)) {
        const productFolder = join(MOLLY_FOLDER, productId)
        if (existsSync(productFolder)) {
          const files = readdirSync(productFolder)
          for (const file of files) {
            const filePath = join(productFolder, file)
            if (existsSync(filePath)) {
              unlinkSync(filePath)
            }
          }
        }
      }

      return { success: true, message: 'Cache cleared' }
    } catch (error) {
      log.error('Clear cache error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // Get cache size
  ipcMain.handle('cache:getSize', async () => {
    try {
      let totalSize = 0

      if (existsSync(LOCAL_LOADER_VERSIONS)) {
        const loaderVersions = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))

        for (const [productId, product] of Object.entries(loaderVersions)) {
          const filePath = product.ExecutablePath
          if (existsSync(filePath)) {
            const stats = statSync(filePath)
            totalSize += stats.size
          }
        }
      }

      return {
        success: true,
        size: totalSize,
        sizeFormatted: formatBytes(totalSize)
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  // Open MOLLY_Multiloader folder
  ipcMain.handle('cache:openFolder', () => {
    shell.openPath(MOLLY_FOLDER)
  })
}

// Update LastCheck timestamp in loader_versions.json
function updateProductLastCheck(productId) {
  try {
    if (!existsSync(LOCAL_LOADER_VERSIONS)) return

    const loaderVersions = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))

    if (loaderVersions[productId]) {
      loaderVersions[productId].LastCheck = new Date().toISOString()
      writeFileSync(LOCAL_LOADER_VERSIONS, JSON.stringify(loaderVersions, null, 2))
    }
  } catch (error) {
    log.error('Error updating LastCheck:', error)
  }
}

// Download file helper
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? get : httpGet

    const request = protocol(url, (response) => {
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
    })

    request.on('error', (err) => {
      reject(err)
    })
  })
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
