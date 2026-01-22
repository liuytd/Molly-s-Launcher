import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Package, HardDrive } from 'lucide-react'
import ProductCard from '../components/ProductCard'

// Sample products data - This will be loaded from Discord commands later
const sampleProducts = [
  {
    id: 'valorant',
    name: 'Valorant',
    icon: '🎯',
    color: '#ff4655',
    description: 'Valorant products',
    exeCount: 3
  },
  {
    id: 'fortnite',
    name: 'Fortnite',
    icon: '🎮',
    color: '#9d4dff',
    description: 'Fortnite products',
    exeCount: 2
  },
  {
    id: 'warzone',
    name: 'Warzone',
    icon: '🔫',
    color: '#00ff00',
    description: 'Warzone products',
    exeCount: 4
  },
  {
    id: 'apex',
    name: 'Apex Legends',
    icon: '🦅',
    color: '#ff0000',
    description: 'Apex products',
    exeCount: 2
  },
  {
    id: 'rust',
    name: 'Rust',
    icon: '🔧',
    color: '#cd412b',
    description: 'Rust products',
    exeCount: 3
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: '⚙️',
    color: '#06b6d4',
    description: 'Utility tools',
    exeCount: 5
  }
]

export default function Home() {
  const navigate = useNavigate()
  const [products, setProducts] = useState(sampleProducts)
  const [favorites, setFavorites] = useState([])
  const [cacheSize, setCacheSize] = useState('0 B')
  const [filter, setFilter] = useState('all') // 'all' or 'favorites'

  useEffect(() => {
    // Load favorites
    if (window.api) {
      window.api.getFavorites().then(setFavorites)
      window.api.getCacheSize().then(result => {
        if (result.success) {
          setCacheSize(result.sizeFormatted)
        }
      })
    }

    // TODO: Load products from store (populated by Discord commands)
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
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

        {/* Cache info */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <HardDrive size={12} />
          <span>Cache: {cacheSize}</span>
        </div>
      </div>

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto">
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
          <div className="grid grid-cols-3 gap-3">
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
