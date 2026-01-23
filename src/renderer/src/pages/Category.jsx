import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Play, Star, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

export default function Category() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState(null)
  const [loaders, setLoaders] = useState([])
  const [favorites, setFavorites] = useState([])
  const [downloadingLoaders, setDownloadingLoaders] = useState({})

  useEffect(() => {
    loadCategoryData()

    if (window.api) {
      window.api.getFavorites().then(setFavorites)

      // Listen for download events
      const unsubProgress = window.api.onLoaderDownloadProgress((data) => {
        setDownloadingLoaders(prev => ({
          ...prev,
          [data.id]: { ...prev[data.id], percent: data.percent }
        }))
      })

      const unsubComplete = window.api.onLoaderDownloadComplete((data) => {
        setDownloadingLoaders(prev => {
          const updated = { ...prev }
          delete updated[data.id]
          return updated
        })
        toast.success(`${data.name} downloaded!`)
        loadCategoryData() // Refresh to update isDownloaded status
      })

      const unsubError = window.api.onLoaderDownloadError((data) => {
        setDownloadingLoaders(prev => {
          const updated = { ...prev }
          delete updated[data.id]
          return updated
        })
        toast.error(`Download failed: ${data.error}`)
      })

      return () => {
        if (unsubProgress) unsubProgress()
        if (unsubComplete) unsubComplete()
        if (unsubError) unsubError()
      }
    }
  }, [categoryId])

  const loadCategoryData = async () => {
    if (!window.api) return

    const result = await window.api.getAllProducts()
    if (result.success) {
      // Find loaders for this category
      const categoryLoaders = result.products.filter(product => {
        const productCategoryId = product.category?.toLowerCase().replace(/\s+/g, '-')
        return productCategoryId === categoryId && !product.id.includes('-placeholder')
      })

      // Find placeholder for category info
      const placeholder = result.products.find(
        p => p.id.includes('-placeholder') &&
        p.category?.toLowerCase().replace(/\s+/g, '-') === categoryId
      )

      if (categoryLoaders.length > 0 || placeholder) {
        setCategory({
          id: categoryId,
          name: placeholder?.category || categoryLoaders[0]?.category || categoryId,
          icon: placeholder?.icon || '🎮',
          color: placeholder?.color || '#8b5cf6'
        })
        setLoaders(categoryLoaders)
      }
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  const handleToggleFavorite = async (loaderId) => {
    if (window.api) {
      const newFavorites = await window.api.toggleFavorite(loaderId)
      setFavorites(newFavorites)
    }
  }

  const handleDownload = async (loader) => {
    if (!loader.downloadUrl) {
      toast.error('Download URL not configured')
      return
    }

    setDownloadingLoaders(prev => ({
      ...prev,
      [loader.id]: { downloading: true, percent: 0 }
    }))

    try {
      const result = await window.api.downloadLoader(loader.id)
      if (!result.success) {
        toast.error(`Download failed: ${result.error}`)
        setDownloadingLoaders(prev => {
          const updated = { ...prev }
          delete updated[loader.id]
          return updated
        })
      }
    } catch (error) {
      toast.error(`Download failed: ${error.message}`)
      setDownloadingLoaders(prev => {
        const updated = { ...prev }
        delete updated[loader.id]
        return updated
      })
    }
  }

  const handleLaunch = async (loader) => {
    if (!loader.isDownloaded) {
      await handleDownload(loader)
      return
    }

    try {
      const result = await window.api.launchExe({ path: loader.exePath })
      if (result.success) {
        toast.success(`Launched ${loader.name}`)
      } else {
        toast.error(`Launch failed: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Launch failed: ${error.message}`)
    }
  }

  // Check if icon is a URL
  const isImageIcon = category?.icon && (
    category.icon.startsWith('http://') ||
    category.icon.startsWith('https://')
  )

  if (!category) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Category not found</p>
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
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${category.color}20, ${category.color}40)`,
            border: `1px solid ${category.color}50`
          }}
        >
          {isImageIcon ? (
            <img
              src={category.icon}
              alt={category.name}
              className="w-8 h-8 object-contain"
            />
          ) : (
            category.icon
          )}
        </div>

        <div>
          <h1 className="text-lg font-semibold" style={{ color: category.color }}>
            {category.name}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {loaders.length} loader{loaders.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      {/* Loaders list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loaders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-[var(--color-text-muted)]">No loaders in this category</p>
          </div>
        ) : (
          loaders.map((loader, index) => {
            const isDownloading = !!downloadingLoaders[loader.id]
            const downloadPercent = downloadingLoaders[loader.id]?.percent || 0
            const isFavorite = favorites.includes(loader.id)

            return (
              <div
                key={loader.id}
                className="glass rounded-xl p-3 flex items-center justify-between animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <div
                    className={`w-2 h-2 rounded-full ${
                      loader.isDownloaded ? 'bg-green-500' : 'bg-[var(--color-text-muted)]'
                    }`}
                  />

                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text)]">
                      {loader.name}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      v{loader.version} {loader.isDownloaded && '• Downloaded'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Favorite button */}
                  <button
                    onClick={() => handleToggleFavorite(loader.id)}
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
                    onClick={() => loader.isDownloaded ? handleLaunch(loader) : handleDownload(loader)}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-w-[100px] justify-center ${
                      loader.isDownloaded
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {downloadPercent}%
                      </>
                    ) : loader.isDownloaded ? (
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
          })
        )}
      </div>

      {/* Bottom info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          Loaders are stored in C:\Launcher_Mollys
        </p>
      </div>
    </div>
  )
}
