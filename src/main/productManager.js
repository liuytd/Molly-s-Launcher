import { ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { get as httpsGet } from 'https'
import log from 'electron-log'

const LOADER_VERSIONS_URL = 'https://raw.githubusercontent.com/liuytd/Molly-s-Launcher/main/loader_versions.json'
const MOLLY_FOLDER = 'C:\\MOLLY_Multiloader'
const LOCAL_LOADER_VERSIONS = join(MOLLY_FOLDER, 'loader_versions.json')
const LOCAL_VERSION_ML = join(MOLLY_FOLDER, 'version.ml.json')

let mainWindow = null

export function setupProductManager(window) {
  mainWindow = window

  // Ensure C:\MOLLY_Multiloader exists
  if (!existsSync(MOLLY_FOLDER)) {
    mkdirSync(MOLLY_FOLDER, { recursive: true })
    log.info('Created MOLLY_Multiloader folder')
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
    // Fetch latest loader_versions.json from GitHub
    const remoteData = await fetchJSON(LOADER_VERSIONS_URL)

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
          newVersion: remoteProduct.Version
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

    // Fetch latest loader_versions.json
    const remoteData = await fetchJSON(LOADER_VERSIONS_URL)

    // Update LastCheck timestamp for all products
    const now = new Date().toISOString()
    for (const product of Object.values(remoteData)) {
      product.LastCheck = now
    }

    // Save to local file
    writeFileSync(LOCAL_LOADER_VERSIONS, JSON.stringify(remoteData, null, 2))
    log.info('Products synced successfully')

    // Create product folders if they don't exist
    for (const [id, product] of Object.entries(remoteData)) {
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
    mainWindow.webContents.send(channel, data)
  }
}
