import { ipcMain, app, shell } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { get } from 'https'
import { get as httpGet } from 'http'
import log from 'electron-log'
import Store from 'electron-store'
import { spawn } from 'child_process'

const store = new Store({ name: 'mollys-launcher-data' })

// Cache directory
const getCacheDir = () => {
  const cacheDir = join(app.getPath('userData'), 'cache')
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }
  return cacheDir
}

export function setupDownloader() {
  // Download an EXE file
  ipcMain.handle('download:exe', async (_, { url, filename, productId }) => {
    try {
      const cacheDir = getCacheDir()
      const filePath = join(cacheDir, filename)

      // Check if file already exists in cache
      if (existsSync(filePath)) {
        log.info(`File ${filename} already in cache`)
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

      // Update cache metadata
      const cacheData = store.get('cacheMetadata', {})
      cacheData[productId] = {
        filename,
        path: filePath,
        downloadedAt: Date.now(),
        url
      }
      store.set('cacheMetadata', cacheData)

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

  // Check if EXE is cached
  ipcMain.handle('download:checkCache', async (_, { productId, filename }) => {
    const cacheDir = getCacheDir()
    const filePath = join(cacheDir, filename)
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

  // Clear cache
  ipcMain.handle('cache:clear', async () => {
    try {
      const cacheDir = getCacheDir()
      const cacheData = store.get('cacheMetadata', {})

      for (const productId in cacheData) {
        const { path } = cacheData[productId]
        if (existsSync(path)) {
          unlinkSync(path)
        }
      }

      store.set('cacheMetadata', {})

      return { success: true }
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
      const cacheData = store.get('cacheMetadata', {})
      let totalSize = 0

      for (const productId in cacheData) {
        const { path } = cacheData[productId]
        if (existsSync(path)) {
          const stats = statSync(path)
          totalSize += stats.size
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

  // Open cache folder
  ipcMain.handle('cache:openFolder', () => {
    shell.openPath(getCacheDir())
  })
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
        unlinkSync(destPath)
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
