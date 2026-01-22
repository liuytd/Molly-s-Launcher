import { useState, useEffect } from 'react'
import { Minus, X } from 'lucide-react'

export default function Titlebar() {
  const [version, setVersion] = useState('1.0.0')

  useEffect(() => {
    if (window.api) {
      window.api.getVersion().then(setVersion)
    }
  }, [])

  const handleMinimize = () => {
    window.api?.minimize()
  }

  const handleClose = () => {
    window.api?.close()
  }

  return (
    <div className="titlebar-drag h-10 flex items-center justify-center px-4 bg-gradient-to-r from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] border-b border-[var(--color-border)] relative">
      {/* Title - Centered */}
      <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
        <span className="text-sm font-semibold tracking-widest text-glow text-[var(--color-primary)]">
          MOLLYS LAUNCHER
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          V{version}
        </span>
      </div>

      {/* Window controls */}
      <div className="titlebar-no-drag flex items-center gap-1 absolute right-4">
        <button
          onClick={handleMinimize}
          className="p-1.5 rounded hover:bg-[var(--color-bg-card)] transition-colors"
          title="Minimize"
        >
          <Minus size={14} className="text-[var(--color-text-secondary)]" />
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 rounded hover:bg-red-500/20 transition-colors group"
          title="Close"
        >
          <X size={14} className="text-[var(--color-text-secondary)] group-hover:text-red-400" />
        </button>
      </div>
    </div>
  )
}
