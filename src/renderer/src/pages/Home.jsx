import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, MessageCircle, Globe, Key, LayoutGrid } from 'lucide-react'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [favorites, setFavorites] = useState([])
  const [cacheSize, setCacheSize] = useState('0 B')
  const [filter, setFilter] = useState('all') // 'all' or 'favorites'

  useEffect(() => {
    // Load favorites and products
    if (window.api) {
      window.api.getFavorites().then(setFavorites)
      window.api.getCacheSize().then(result => {
        if (result.success) {
          setCacheSize(result.sizeFormatted)
        }
      })

      // Load products from loader_versions.json
      window.api.getAllProducts().then(result => {
        if (result.success) {
          // Transform products to match UI format
          const transformedProducts = result.products.map(product => ({
            id: product.id,
            name: product.name,
            icon: product.icon,
            description: product.category,
            exeCount: product.executables.length,
            isDownloaded: product.isDownloaded,
            version: product.version
          }))
          setProducts(transformedProducts)
        }
      })

      // Sync products with GitHub on load
      window.api.syncProductsWithGithub()
    }
  }, [])

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`)
  }

  const handleToggleFavorite = async (productId, e) => {
    e.stopPropagation()
    if (window.api) {
      const newFavorites = await window.api.toggleFavorite(productId)
      setFavorites(newFavorites)
    }
  }

  const filteredProducts = filter === 'favorites'
    ? products.filter(p => favorites.includes(p.id))
    : products

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-16 flex flex-col items-center justify-center gap-4 py-4 border-r border-[var(--color-border)]">
        {/* All Products */}
        <button
          onClick={() => setFilter('all')}
          className={`p-3 rounded-lg transition-all ${
            filter === 'all'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10'
          }`}
          title="All Products"
        >
          <LayoutGrid size={20} />
        </button>

        {/* Favorites */}
        <button
          onClick={() => setFilter('favorites')}
          className={`p-3 rounded-lg transition-all ${
            filter === 'favorites'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10'
          }`}
          title="Favorites"
        >
          <Star size={20} className={filter === 'favorites' ? 'fill-current' : ''} />
        </button>

        <div className="w-8 h-px bg-[var(--color-border)]"></div>

        {/* Discord */}
        <button
          onClick={() => window.open('https://discord.gg/your-server', '_blank')}
          className="p-3 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
          title="Discord"
        >
          <MessageCircle size={20} />
        </button>

        {/* Website */}
        <button
          onClick={() => window.open('https://your-website.com', '_blank')}
          className="p-3 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
          title="Website"
        >
          <Globe size={20} />
        </button>

        {/* Settings/Key */}
        <button
          onClick={() => navigate('/settings')}
          className="p-3 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
          title="Settings"
        >
          <Key size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Star size={48} className="text-[var(--color-text-muted)] mb-4" />
            <p className="text-[var(--color-text-secondary)]">
              {filter === 'favorites' ? 'No favorites yet' : 'No products available'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {filter === 'favorites' && 'Click the star icon to add favorites'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => handleProductClick(product.id)}
                style={{ animationDelay: `${index * 50}ms` }}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
