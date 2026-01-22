import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'

export default function UpdatePopup({ version, onClose }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('downloading')

  useEffect(() => {
    if (window.api) {
      window.api.onUpdateProgress((data) => {
        setProgress(data.percent)
      })

      window.api.onUpdateDownloaded(() => {
        setStatus('installing')
      })
    }

    return () => {
      if (window.api) {
        window.api.removeAllListeners('updater:progress')
        window.api.removeAllListeners('updater:downloaded')
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass rounded-xl p-6 w-80 text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
          {status === 'downloading' ? (
            <Download size={32} className="text-[var(--color-primary)]" />
          ) : (
            <RefreshCw size={32} className="text-[var(--color-primary)] animate-spin" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-glow mb-2">
          {status === 'downloading' ? 'New Version Found!' : 'Installing Update...'}
        </h2>

        {/* Version info */}
        {version && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Version {version} is available
          </p>
        )}

        {/* Progress bar */}
        <div className="w-full h-2 bg-[var(--color-bg-dark)] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress text */}
        <p className="text-xs text-[var(--color-text-muted)]">
          {status === 'downloading'
            ? `Downloading... ${Math.round(progress)}%`
            : 'Restarting application...'}
        </p>

        {/* Info */}
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          The application will restart automatically
        </p>
      </div>
    </div>
  )
}
