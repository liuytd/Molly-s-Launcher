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
    }
  }, [categoryId])

  const loadCategoryData = async () => {
    if (!window.api) return

    const result = await window.api.getAllProducts()
    if (result.success) {
      const categoryLoaders = result.products.filter(product => {
        const productCategoryId = product.category?.toLowerCase().replace(/\s+/g, '-')
        return productCategoryId === categoryId && !product.id.includes('-placeholder')
      })

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
      toast.error('URL de téléchargement non configurée')
      return
    }

    setDownloadingLoaders(prev => ({ ...prev, [loader.id]: true }))

    try {
      const result = await window.api.downloadToDownloads({
        url: loader.downloadUrl,
        filename: loader.originalFileName || `${loader.name}.exe`
      })

      if (result.success) {
        toast.success(`${loader.name} téléchargé dans Downloads`)
      } else {
        toast.error(`Échec: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Échec: ${error.message}`)
    } finally {
      setDownloadingLoaders(prev => ({ ...prev, [loader.id]: false }))
    }
  }

  const handleLaunch = async (loader) => {
    if (!loader.isDownloaded) {
      toast.error('Loader non installé')
      return
    }

    try {
      // Pass productId to find the most recent exe in the folder
      const result = await window.api.launchExeAsAdmin({
        path: loader.exePath,
        productId: loader.id
      })
      if (result.success) {
        toast.success(`${loader.name} lancé`)
      } else {
        toast.error(`Échec: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Échec: ${error.message}`)
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
        <p className="text-[var(--color-text-muted)]">Catégorie non trouvée</p>
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
              onError={(e) => { e.target.style.display = 'none' }}
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
            {loaders.length} loader{loaders.length !== 1 ? 's' : ''} disponible{loaders.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Loaders list */}
      <div className="flex-1 overflow-y-auto">
        {loaders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-[var(--color-text-muted)]">Aucun loader dans cette catégorie</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            {loaders.map((loader, index) => {
              const isDownloading = !!downloadingLoaders[loader.id]
              const isFavorite = favorites.includes(loader.id)

              return (
                <div
                  key={loader.id}
                  className="w-[80%] glass rounded-xl p-4 flex items-center justify-between animate-fade-in"
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
                      v{loader.version}
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

                  {/* Download button */}
                  <button
                    onClick={() => handleDownload(loader)}
                    disabled={isDownloading}
                    className="p-2 rounded-lg bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Télécharger"
                  >
                    {isDownloading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                  </button>

                  {/* Launch button */}
                  <button
                    onClick={() => handleLaunch(loader)}
                    disabled={!loader.isDownloaded}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      loader.isDownloaded
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Play size={14} />
                    Launch
                  </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
