import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Play, Star, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

// Sample EXE data - This will be loaded from Discord commands later
const sampleExeData = {
  valorant: {
    name: 'Valorant',
    icon: '🎯',
    color: '#ff4655',
    exes: [
      { id: 'val-1', name: 'Valorant Tool v1.0', filename: 'valtool.exe', url: '', size: '12 MB' },
      { id: 'val-2', name: 'Valorant Helper v2.1', filename: 'valhelper.exe', url: '', size: '8 MB' },
      { id: 'val-3', name: 'Valorant Config', filename: 'valconfig.exe', url: '', size: '2 MB' }
    ]
  },
  fortnite: {
    name: 'Fortnite',
    icon: '🎮',
    color: '#9d4dff',
    exes: [
      { id: 'fn-1', name: 'Fortnite Tool v1.5', filename: 'fntool.exe', url: '', size: '15 MB' },
      { id: 'fn-2', name: 'Fortnite Helper', filename: 'fnhelper.exe', url: '', size: '10 MB' }
    ]
  },
  warzone: {
    name: 'Warzone',
    icon: '🔫',
    color: '#00ff00',
    exes: [
      { id: 'wz-1', name: 'Warzone Tool v3.0', filename: 'wztool.exe', url: '', size: '20 MB' },
      { id: 'wz-2', name: 'Warzone Helper', filename: 'wzhelper.exe', url: '', size: '12 MB' },
      { id: 'wz-3', name: 'Warzone Config', filename: 'wzconfig.exe', url: '', size: '5 MB' },
      { id: 'wz-4', name: 'Warzone Utility', filename: 'wzutil.exe', url: '', size: '8 MB' }
    ]
  },
  apex: {
    name: 'Apex Legends',
    icon: '🦅',
    color: '#ff0000',
    exes: [
      { id: 'apex-1', name: 'Apex Tool v2.0', filename: 'apextool.exe', url: '', size: '18 MB' },
      { id: 'apex-2', name: 'Apex Helper', filename: 'apexhelper.exe', url: '', size: '9 MB' }
    ]
  },
  rust: {
    name: 'Rust',
    icon: '🔧',
    color: '#cd412b',
    exes: [
      { id: 'rust-1', name: 'Rust Tool v1.2', filename: 'rusttool.exe', url: '', size: '14 MB' },
      { id: 'rust-2', name: 'Rust Helper', filename: 'rusthelper.exe', url: '', size: '7 MB' },
      { id: 'rust-3', name: 'Rust Config', filename: 'rustconfig.exe', url: '', size: '3 MB' }
    ]
  },
  utilities: {
    name: 'Utilities',
    icon: '⚙️',
    color: '#06b6d4',
    exes: [
      { id: 'util-1', name: 'System Cleaner', filename: 'cleaner.exe', url: '', size: '5 MB' },
      { id: 'util-2', name: 'Registry Fixer', filename: 'regfix.exe', url: '', size: '3 MB' },
      { id: 'util-3', name: 'Network Tool', filename: 'nettool.exe', url: '', size: '4 MB' },
      { id: 'util-4', name: 'PC Optimizer', filename: 'optimizer.exe', url: '', size: '8 MB' },
      { id: 'util-5', name: 'Driver Updater', filename: 'driverup.exe', url: '', size: '10 MB' }
    ]
  }
}

export default function Product() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [cachedExes, setCachedExes] = useState({})
  const [downloadingExes, setDownloadingExes] = useState({})

  useEffect(() => {
    // Load product data
    const productData = sampleExeData[productId]
    if (productData) {
      setProduct(productData)

      // Check cache for each exe
      productData.exes.forEach(async (exe) => {
        if (window.api) {
          const cacheStatus = await window.api.checkCache({
            productId: exe.id,
            filename: exe.filename
          })
          if (cacheStatus.cached) {
            setCachedExes(prev => ({ ...prev, [exe.id]: cacheStatus.path }))
          }
        }
      })
    }

    // Load favorites
    if (window.api) {
      window.api.getFavorites().then(setFavorites)
    }
  }, [productId])

  const handleBack = () => {
    navigate('/')
  }

  const handleToggleFavorite = async (exeId) => {
    if (window.api) {
      const newFavorites = await window.api.toggleFavorite(exeId)
      setFavorites(newFavorites)
    }
  }

  const handleDownload = async (exe) => {
    if (!exe.url) {
      toast.error('Download URL not configured')
      return
    }

    setDownloadingExes(prev => ({ ...prev, [exe.id]: true }))

    try {
      const result = await window.api.downloadExe({
        url: exe.url,
        filename: exe.filename,
        productId: exe.id
      })

      if (result.success) {
        setCachedExes(prev => ({ ...prev, [exe.id]: result.path }))
        toast.success(`${exe.name} downloaded!`)
      } else {
        toast.error(`Download failed: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Download failed: ${error.message}`)
    } finally {
      setDownloadingExes(prev => ({ ...prev, [exe.id]: false }))
    }
  }

  const handleLaunch = async (exe) => {
    const cachedPath = cachedExes[exe.id]

    if (!cachedPath) {
      // Download first if not cached
      await handleDownload(exe)
      return
    }

    try {
      const result = await window.api.launchExe({ path: cachedPath })
      if (result.success) {
        toast.success(`Launched ${exe.name}`)
      } else {
        toast.error(`Launch failed: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Launch failed: ${error.message}`)
    }
  }

  if (!product) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Product not found</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-card)] transition-colors"
        >
          <ArrowLeft size={20} className="text-[var(--color-text-secondary)]" />
        </button>

        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{
            background: `linear-gradient(135deg, ${product.color}20, ${product.color}40)`,
            border: `1px solid ${product.color}50`
          }}
        >
          {product.icon}
        </div>

        <div>
          <h1 className="text-lg font-semibold" style={{ color: product.color }}>
            {product.name}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {product.exes.length} product{product.exes.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      {/* EXE list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {product.exes.map((exe, index) => {
          const isCached = !!cachedExes[exe.id]
          const isDownloading = downloadingExes[exe.id]
          const isFavorite = favorites.includes(exe.id)

          return (
            <div
              key={exe.id}
              className="glass rounded-xl p-3 flex items-center justify-between animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Status indicator */}
                <div
                  className={`w-2 h-2 rounded-full ${
                    isCached ? 'bg-green-500' : 'bg-[var(--color-text-muted)]'
                  }`}
                />

                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text)]">
                    {exe.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {exe.size} {isCached && '• Cached'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Favorite button */}
                <button
                  onClick={() => handleToggleFavorite(exe.id)}
                  className="p-2 rounded-lg hover:bg-[var(--color-primary)]/10 transition-colors"
                >
                  <Star
                    size={16}
                    className={`transition-colors ${
                      isFavorite
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-[var(--color-text-muted)] hover:text-yellow-400'
                    }`}
                  />
                </button>

                {/* Action button */}
                <button
                  onClick={() => isCached ? handleLaunch(exe) : handleDownload(exe)}
                  disabled={isDownloading}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isCached
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Downloading...
                    </>
                  ) : isCached ? (
                    <>
                      <Play size={14} />
                      Launch
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          Products are cached locally for faster access
        </p>
      </div>
    </div>
  )
}
