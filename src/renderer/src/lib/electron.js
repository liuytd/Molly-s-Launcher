// Helper functions for Electron API calls

export const invoke = async ({ channel, payload = {} }) => {
  if (window.api) {
    return await window.api[channel](payload)
  }
  throw new Error('Electron API not available')
}

export const isElectron = () => {
  return typeof window !== 'undefined' && window.api !== undefined
}
