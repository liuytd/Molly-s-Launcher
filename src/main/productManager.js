import { ipcMain, app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, unlinkSync } from 'fs'
import { get as httpsGet, request as httpsRequest } from 'https'
import { get as httpGet } from 'http'
import { spawn } from 'child_process'
import log from 'electron-log'

// Use GitHub API to avoid CDN caching issues
const LOADER_VERSIONS_API_URL = 'https://api.github.com/repos/liuytd/Molly-s-Launcher/contents/loader_versions.json'
const VERSION_ML_API_URL = 'https://api.github.com/repos/liuytd/Molly-s-Launcher/contents/version.ml.json'
const MOLLY_FOLDER = 'C:\\Launcher_Mollys'
const LOCAL_LOADER_VERSIONS = join(MOLLY_FOLDER, 'loader_versions.json')
const LOCAL_VERSION_ML = join(MOLLY_FOLDER, 'version.ml.json')

// Check interval: 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000

let mainWindow = null
let checkInterval = null
let isDownloadingNewLoaders = false

export function setupProductManager(window) {
  mainWindow = window

  // Ensure C:\Launcher_Mollys exists
  if (!existsSync(MOLLY_FOLDER)) {
    mkdirSync(MOLLY_FOLDER, { recursive: true })
    log.info('Created Launcher_Mollys folder')
  }

  // IPC handlers
  ipcMain.handle('products:getAll', async () => {
    return await getAllProducts()
  })

  ipcMain.handle('products:checkUpdates', async () => {
    return await checkProductUpdates()
  })

  ipcMain.handle('products:syncWithGithub', async () => {
    return await syncProductsWithGithub()
  })

  ipcMain.handle('products:downloadLoader', async (event, productId) => {
    return await downloadLoader(productId)
  })

  // Start automatic version check every 5 minutes
  startAutoCheck()
}

function startAutoCheck() {
  // Initial sync and download after 5 seconds
  setTimeout(async () => {
    log.info('[ProductManager] Running initial sync and download...')
    await checkAndDownloadNewLoaders()
  }, 5000)

  // Then check every 5 minutes
  checkInterval = setInterval(async () => {
    log.info('[ProductManager] Running scheduled loader version check...')
    await checkAndDownloadNewLoaders()
  }, CHECK_INTERVAL)

  log.info(`[ProductManager] Auto-check started (every ${CHECK_INTERVAL / 60000} minutes)`)
}

// Check for new loaders, download them and restart the app
async function checkAndDownloadNewLoaders() {
  if (isDownloadingNewLoaders) {
    log.info('[ProductManager] Already downloading new loaders, skipping...')
    return
  }

  try {
    const remoteData = await fetchLoaderVersionsFromAPI()

    // Get local data (or empty object if first time)
    let localData = {}
    if (existsSync(LOCAL_LOADER_VERSIONS)) {
      localData = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))
    }

    // Find NEW loaders (exist in remote but not in local, excluding placeholders)
    const newLoaders = []
    for (const [id, product] of Object.entries(remoteData)) {
      // Skip placeholders
      if (id.includes('-placeholder') || product.IsPlaceholder) continue
      // Skip if no download URL
      if (!product.DownloadUrl) continue
      // Check if this is a NEW loader (not in local data)
      if (!localData[id]) {
        newLoaders.push({
          id,
          name: product.DisplayName || id,
          downloadUrl: product.DownloadUrl,
          fileName: product.OriginalFileName
        })
      }
    }

    // Also check for loaders that exist locally but are not downloaded
    const notDownloadedLoaders = []
    for (const [id, product] of Object.entries(remoteData)) {
      if (id.includes('-placeholder') || product.IsPlaceholder) continue
      if (!product.DownloadUrl) continue

      const productFolder = join(MOLLY_FOLDER, id)
      const exePath = join(productFolder, product.OriginalFileName || '')

      // If loader exists in local JSON but file is not downloaded
      if (localData[id] && !existsSync(exePath)) {
        notDownloadedLoaders.push({
          id,
          name: product.DisplayName || id,
          downloadUrl: product.DownloadUrl,
          fileName: product.OriginalFileName
        })
      }
    }

    const allLoadersToDownload = [...newLoaders, ...notDownloadedLoaders]

    if (allLoadersToDownload.length > 0) {
      isDownloadingNewLoaders = true

      const loaderNames = allLoadersToDownload.map(l => l.name).join(', ')
      log.info(`[ProductManager] New loaders detected: ${loaderNames}`)

      // Send notification to renderer - show popup
      sendToRenderer('loader:new-loaders-detected', {
        loaders: allLoadersToDownload,
        count: allLoadersToDownload.length,
        names: loaderNames
      })

      // Sync first to update local JSON
      await syncProductsWithGithub()

      // Download all new loaders
      for (const loader of allLoadersToDownload) {
        log.info(`[ProductManager] Downloading new loader: ${loader.name}`)
        sendToRenderer('loader:downloading-new', {
          id: loader.id,
          name: loader.name,
          current: allLoadersToDownload.indexOf(loader) + 1,
          total: allLoadersToDownload.length
        })

        try {
          await downloadLoaderFile(loader.id, loader.downloadUrl, loader.fileName)
          log.info(`[ProductManager] Successfully downloaded ${loader.name}`)
        } catch (error) {
          log.error(`[ProductManager] Failed to download ${loader.name}:`, error)
        }
      }

      log.info('[ProductManager] All new loaders downloaded, restarting app...')
      sendToRenderer('loader:restarting', { message: 'Restarting to apply changes...' })

      // Wait a moment for UI to update, then restart
      setTimeout(() => {
        restartApp()
      }, 2000)

    } else {
      // No new loaders, just sync and check for updates
      await syncProductsWithGithub()
      await silentCheckForLoaderUpdates()
      sendToRenderer('loader:products-synced')
    }

  } catch (error) {
    log.error('[ProductManager] Error checking for new loaders:', error)
    isDownloadingNewLoaders = false
  }
}

// Restart the application
function restartApp() {
  const appPath = app.getPath('exe')
  log.info(`[ProductManager] Restarting app from: ${appPath}`)

  // Spawn a new instance
  spawn(appPath, [], {
    detached: true,
    stdio: 'ignore'
  }).unref()

  // Quit current instance
  app.quit()
}

async function downloadAllLoaders() {
  try {
    const remoteData = await fetchLoaderVersionsFromAPI()

    for (const [id, product] of Object.entries(remoteData)) {
      // Skip placeholders
      if (id.includes('-placeholder')) continue
      // Skip if no download URL
      if (!product.DownloadUrl) continue

      const productFolder = join(MOLLY_FOLDER, id)
      const exePath = join(productFolder, product.OriginalFileName || '')

      // Skip if already downloaded
      if (existsSync(exePath)) {
        log.info(`[ProductManager] ${product.DisplayName || id} already downloaded`)
        continue
      }

      log.info(`[ProductManager] Auto-downloading ${product.DisplayName || id}...`)
      sendToRenderer('loader:download-started', { id, name: product.DisplayName || id })

      try {
        await downloadLoaderFile(id, product.DownloadUrl, product.OriginalFileName)
        log.info(`[ProductManager] Successfully downloaded ${product.DisplayName || id}`)
        sendToRenderer('loader:download-complete', { id, name: product.DisplayName || id })
      } catch (error) {
        log.error(`[ProductManager] Failed to download ${product.DisplayName || id}:`, error)
        sendToRenderer('loader:download-error', { id, name: product.DisplayName || id, error: error.message })
      }
    }

    log.info('[ProductManager] All loaders download check complete')
  } catch (error) {
    log.error('[ProductManager] Error in downloadAllLoaders:', error)
  }
}

async function silentCheckForLoaderUpdates() {
  try {
    // Fetch remote data using GitHub API
    const remoteData = await fetchLoaderVersionsFromAPI()

    if (!existsSync(LOCAL_LOADER_VERSIONS)) {
      // First time - sync everything
      await syncProductsWithGithub()
      sendToRenderer('loader:products-synced')
      return
    }

    const localData = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))

    // Find loaders that need updates (only for downloaded ones)
    const updatesToDownload = []

    for (const [id, remoteProduct] of Object.entries(remoteData)) {
      const localProduct = localData[id]
      const productFolder = join(MOLLY_FOLDER, id)
      const exePath = join(productFolder, remoteProduct.OriginalFileName || '')

      // Check if this loader is already downloaded
      const isDownloaded = existsSync(exePath)

      if (isDownloaded) {
        // Check if version changed
        if (!localProduct || localProduct.Version !== remoteProduct.Version) {
          log.info(`[ProductManager] Update available for ${remoteProduct.DisplayName}: ${localProduct?.Version || 'N/A'} -> ${remoteProduct.Version}`)
          updatesToDownload.push({
            id,
            name: remoteProduct.DisplayName || id,
            oldVersion: localProduct?.Version || 'N/A',
            newVersion: remoteProduct.Version,
            downloadUrl: remoteProduct.DownloadUrl,
            fileName: remoteProduct.OriginalFileName
          })
        }
      }
    }

    // Auto-download updates for downloaded loaders
    if (updatesToDownload.length > 0) {
      log.info(`[ProductManager] Auto-downloading ${updatesToDownload.length} loader update(s)...`)

      sendToRenderer('loader:updates-available', {
        updates: updatesToDownload,
        count: updatesToDownload.length
      })

      for (const update of updatesToDownload) {
        try {
          sendToRenderer('loader:download-started', { id: update.id, name: update.name })

          await downloadLoaderFile(update.id, update.downloadUrl, update.fileName)

          log.info(`[ProductManager] Successfully updated ${update.name}`)
          sendToRenderer('loader:download-complete', { id: update.id, name: update.name })
        } catch (error) {
          log.error(`[ProductManager] Failed to update ${update.name}:`, error)
          sendToRenderer('loader:download-error', { id: update.id, name: update.name, error: error.message })
        }
      }
    }

    // Sync the local JSON with remote
    await syncProductsWithGithub()

    // Notify renderer to refresh products list
    sendToRenderer('loader:products-synced')

  } catch (error) {
    log.error('[ProductManager] Error during silent check:', error)
  }
}

async function downloadLoader(productId) {
  try {
    // Get product info from local or remote
    let products
    if (existsSync(LOCAL_LOADER_VERSIONS)) {
      products = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))
    } else {
      products = await fetchLoaderVersionsFromAPI()
    }

    const product = products[productId]
    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    sendToRenderer('loader:download-started', { id: productId, name: product.DisplayName })

    await downloadLoaderFile(productId, product.DownloadUrl, product.OriginalFileName)

    sendToRenderer('loader:download-complete', { id: productId, name: product.DisplayName })

    return { success: true }
  } catch (error) {
    log.error(`[ProductManager] Error downloading loader ${productId}:`, error)
    sendToRenderer('loader:download-error', { id: productId, error: error.message })
    return { success: false, error: error.message }
  }
}

async function downloadLoaderFile(productId, downloadUrl, fileName) {
  return new Promise((resolve, reject) => {
    const productFolder = join(MOLLY_FOLDER, productId)
    const filePath = join(productFolder, fileName)

    // Ensure folder exists
    if (!existsSync(productFolder)) {
      mkdirSync(productFolder, { recursive: true })
    }

    // Delete old file if exists
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath)
      } catch (e) {
        log.warn(`Could not delete old file: ${e.message}`)
      }
    }

    log.info(`[ProductManager] Downloading ${fileName} to ${filePath}`)

    const file = createWriteStream(filePath)

    const doRequest = (url) => {
      const isHttps = url.startsWith('https')
      const getter = isHttps ? httpsGet : httpGet

      getter(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          const redirectUrl = response.headers.location
          log.info(`[ProductManager] Following redirect to ${redirectUrl}`)
          doRequest(redirectUrl)
          return
        }

        if (response.statusCode !== 200) {
          file.close()
          unlinkSync(filePath)
          reject(new Error(`Download failed with status ${response.statusCode}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'], 10) || 0
        let downloadedSize = 0

        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          if (totalSize > 0) {
            const percent = Math.round((downloadedSize / totalSize) * 100)
            sendToRenderer('loader:download-progress', {
              id: productId,
              percent,
              downloaded: downloadedSize,
              total: totalSize
            })
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          log.info(`[ProductManager] Download complete: ${filePath}`)
          resolve()
        })
      }).on('error', (error) => {
        file.close()
        if (existsSync(filePath)) {
          unlinkSync(filePath)
        }
        reject(error)
      })
    }

    doRequest(downloadUrl)
  })
}

async function getAllProducts() {
  try {
    // First check if local loader_versions.json exists
    if (!existsSync(LOCAL_LOADER_VERSIONS)) {
      log.info('Local loader_versions.json not found, fetching from GitHub...')
      await syncProductsWithGithub()
    }

    const data = readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8')
    const products = JSON.parse(data)

    // Transform to array format for UI
    const productsArray = Object.entries(products).map(([id, product]) => ({
      id,
      name: product.DisplayName || id,
      category: product.Category || 'Unknown',
      icon: product.Icon || '🎮',
      version: product.Version,
      downloadUrl: product.DownloadUrl,
      exePath: product.ExecutablePath,
      originalFileName: product.OriginalFileName,
      executables: product.AssociatedExecutables || [],
      lastCheck: product.LastCheck,
      isDownloaded: existsSync(product.ExecutablePath)
    }))

    return {
      success: true,
      products: productsArray
    }
  } catch (error) {
    log.error('Error getting products:', error)
    return {
      success: false,
      error: error.message,
      products: []
    }
  }
}

async function checkProductUpdates() {
  try {
    // Fetch latest loader_versions.json from GitHub API
    const remoteData = await fetchLoaderVersionsFromAPI()

    if (!existsSync(LOCAL_LOADER_VERSIONS)) {
      return {
        success: true,
        updatesAvailable: true,
        message: 'Local version file not found'
      }
    }

    const localData = JSON.parse(readFileSync(LOCAL_LOADER_VERSIONS, 'utf-8'))

    // Compare versions
    const updates = []
    for (const [id, remoteProduct] of Object.entries(remoteData)) {
      const localProduct = localData[id]
      if (!localProduct || localProduct.Version !== remoteProduct.Version) {
        updates.push({
          id,
          name: remoteProduct.DisplayName || id,
          oldVersion: localProduct?.Version || 'N/A',
          newVersion: remoteProduct.Version,
          downloadUrl: remoteProduct.DownloadUrl,
          originalFileName: remoteProduct.OriginalFileName
        })
      }
    }

    return {
      success: true,
      updatesAvailable: updates.length > 0,
      updates
    }
  } catch (error) {
    log.error('Error checking product updates:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function syncProductsWithGithub() {
  try {
    log.info('Syncing products with GitHub...')

    // Fetch latest loader_versions.json using GitHub API
    const remoteData = await fetchLoaderVersionsFromAPI()

    // Update LastCheck timestamp for all products
    const now = new Date().toISOString()
    for (const product of Object.values(remoteData)) {
      product.LastCheck = now
    }

    // Save to local file
    writeFileSync(LOCAL_LOADER_VERSIONS, JSON.stringify(remoteData, null, 2))
    log.info('Products synced successfully')

    // Fetch and save version.ml.json using GitHub API (avoids CDN caching)
    try {
      const versionData = await fetchVersionMlFromAPI()
      writeFileSync(LOCAL_VERSION_ML, JSON.stringify(versionData, null, 2))
      log.info('version.ml.json synced successfully')
    } catch (error) {
      log.error('Error syncing version.ml.json:', error)
    }

    // Create product folders if they don't exist (skip placeholders)
    for (const [id, product] of Object.entries(remoteData)) {
      // Skip placeholders - they don't need folders
      if (id.includes('-placeholder') || product.IsPlaceholder) continue

      const productFolder = join(MOLLY_FOLDER, id)
      if (!existsSync(productFolder)) {
        mkdirSync(productFolder, { recursive: true })
        log.info(`Created folder for ${id}`)
      }
    }

    return {
      success: true,
      message: 'Products synced with GitHub'
    }
  } catch (error) {
    log.error('Error syncing products:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function fetchLoaderVersionsFromAPI() {
  return new Promise((resolve, reject) => {
    const url = `${LOADER_VERSIONS_API_URL}?ref=main&t=${Date.now()}`

    const options = {
      headers: {
        'User-Agent': 'MollysLauncher',
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    }

    httpsGet(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`GitHub API failed: ${response.statusCode}`))
        return
      }

      let data = ''
      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          const apiResponse = JSON.parse(data)
          // Decode base64 content from GitHub API
          const content = Buffer.from(apiResponse.content, 'base64').toString('utf-8')
          const loaderVersions = JSON.parse(content)
          resolve(loaderVersions)
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

async function fetchVersionMlFromAPI() {
  return new Promise((resolve, reject) => {
    const url = `${VERSION_ML_API_URL}?ref=main&t=${Date.now()}`

    const options = {
      headers: {
        'User-Agent': 'MollysLauncher',
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    }

    httpsGet(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`GitHub API failed for version.ml.json: ${response.statusCode}`))
        return
      }

      let data = ''
      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          const apiResponse = JSON.parse(data)
          // Decode base64 content from GitHub API
          const content = Buffer.from(apiResponse.content, 'base64').toString('utf-8')
          const versionData = JSON.parse(content)
          resolve(versionData)
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    httpsGet(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        fetchJSON(response.headers.location).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch: ${response.statusCode}`))
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

function sendToRenderer(channel, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    log.info(`[ProductManager] Sending to renderer: ${channel}`)
    mainWindow.webContents.send(channel, data)
  } else {
    log.warn(`[ProductManager] Cannot send ${channel}: mainWindow not available`)
  }
}
