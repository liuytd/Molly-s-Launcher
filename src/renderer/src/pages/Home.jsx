import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Package, HardDrive } from 'lucide-react'
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
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        {/* Filter buttons */}
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
            filter === 'all'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/50'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <Package size={14} />
          All Products
        </button>
        <button
          onClick={() => setFilter('favorites')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
            filter === 'favorites'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/50'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <Star size={14} />
          Favorites ({favorites.length})
        </button>
      </div>

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
                isFavorite={favorites.includes(product.id)}
                onToggleFavorite={handleToggleFavorite}
                onClick={() => handleProductClick(product.id)}
                style={{ animationDelay: `${index * 50}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
