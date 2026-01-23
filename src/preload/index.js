import { contextBridge, ipcRenderer } from 'electron'

// Custom API for renderer
const api = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPath: (name) => ipcRenderer.invoke('app:getPath', name),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  addFavorite: (productId) => ipcRenderer.invoke('favorites:add', productId),
  removeFavorite: (productId) => ipcRenderer.invoke('favorites:remove', productId),
  toggleFavorite: (productId) => ipcRenderer.invoke('favorites:toggle', productId),

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: (downloadUrl, targetVersion) => ipcRenderer.invoke('updater:install', downloadUrl, targetVersion),
  getUpdaterVersion: () => ipcRenderer.invoke('updater:getVersion'),

  // Updater events
  onUpdateAvailable: (callback) => ipcRenderer.on('updater:available', (_, data) => callback(data)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('updater:not-available', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('updater:progress', (_, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('updater:downloaded', (_, data) => callback(data)),
  onUpdateDownloading: (callback) => ipcRenderer.on('updater:downloading', callback),
  onUpdateError: (callback) => ipcRenderer.on('updater:error', (_, data) => callback(data)),

  // Downloader
  downloadExe: (options) => ipcRenderer.invoke('download:exe', options),
  checkCache: (options) => ipcRenderer.invoke('download:checkCache', options),
  launchExe: (options) => ipcRenderer.invoke('exe:launch', options),
  launchExeAsAdmin: (options) => ipcRenderer.invoke('exe:launchAsAdmin', options),
  downloadToDownloads: (options) => ipcRenderer.invoke('download:toDownloads', options),

  // Cache management
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  getCacheSize: () => ipcRenderer.invoke('cache:getSize'),
  openCacheFolder: () => ipcRenderer.invoke('cache:openFolder'),

  // Product management
  getAllProducts: () => ipcRenderer.invoke('products:getAll'),
  checkProductUpdates: () => ipcRenderer.invoke('products:checkUpdates'),
  syncProductsWithGithub: () => ipcRenderer.invoke('products:syncWithGithub'),
  downloadLoader: (productId) => ipcRenderer.invoke('products:downloadLoader', productId),

  // Loader update events (return unsubscribe functions)
  onLoaderUpdatesAvailable: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('loader:updates-available', handler)
    return () => ipcRenderer.removeListener('loader:updates-available', handler)
  },
  onLoaderDownloadStarted: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('loader:download-started', handler)
    return () => ipcRenderer.removeListener('loader:download-started', handler)
  },
  onLoaderDownloadProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('loader:download-progress', handler)
    return () => ipcRenderer.removeListener('loader:download-progress', handler)
  },
  onLoaderDownloadComplete: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('loader:download-complete', handler)
    return () => ipcRenderer.removeListener('loader:download-complete', handler)
  },
  onLoaderDownloadError: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('loader:download-error', handler)
    return () => ipcRenderer.removeListener('loader:download-error', handler)
  },
  onLoaderProductsSynced: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('loader:products-synced', handler)
    return () => ipcRenderer.removeListener('loader:products-synced', handler)
  },

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}
