import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, MessageCircle, Globe, Key, LayoutGrid } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import categoryIconsData from '../../../../category_icons.json'

export default function Home() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [favorites, setFavorites] = useState([])
  const [filter, setFilter] = useState('all') // 'all' or 'favorites'

  // Get icon URL from category_icons.json
  const getCategoryIcon = (categoryName) => {
    const icons = categoryIconsData.icons || {}
    // Try exact match first
    if (icons[categoryName]) return icons[categoryName]
    // Try case-insensitive match
    const key = Object.keys(icons).find(k => k.toLowerCase() === categoryName.toLowerCase())
    return key ? icons[key] : null
  }

  const loadProducts = async () => {
    if (!window.api) return

    const result = await window.api.getAllProducts()
    if (result.success) {
      // Group products by category
      const categoryMap = new Map()

      result.products.forEach(product => {
        // Skip placeholders
        if (product.id.includes('-placeholder')) return

        const categoryName = product.category || 'Unknown'

        if (!categoryMap.has(categoryName)) {
          // Find the placeholder for this category to get color
          const placeholder = result.products.find(
            p => p.id.includes('-placeholder') && p.category === categoryName
          )

          // Get icon from category_icons.json (PNG URL) or fallback to emoji
          const iconUrl = getCategoryIcon(categoryName)

          categoryMap.set(categoryName, {
            id: categoryName.toLowerCase().replace(/\s+/g, '-'),
            name: categoryName,
            icon: iconUrl || placeholder?.icon || '🎮',
            color: placeholder?.color || '#8b5cf6',
            loaders: []
          })
        }

        categoryMap.get(categoryName).loaders.push(product)
      })

      // Convert to array with loader count
      const categoriesArray = Array.from(categoryMap.values()).map(cat => ({
        ...cat,
        exeCount: cat.loaders.length
      }))

      setCategories(categoriesArray)
    }
  }

  useEffect(() => {
    if (window.api) {
      window.api.getFavorites().then(setFavorites)

      // Load products from loader_versions.json
      loadProducts()

      // Sync products with GitHub on load
      window.api.syncProductsWithGithub()

      // Listen for product sync events (auto-refresh when GitHub data changes)
      const unsubscribe = window.api.onLoaderProductsSynced(() => {
        console.log('[Home] Products synced, refreshing...')
        loadProducts()
      })

      return () => {
        if (unsubscribe) unsubscribe()
      }
    }
  }, [])

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`)
  }

  // Filter categories: show categories that contain at least one favorite loader
  const filteredCategories = filter === 'favorites'
    ? categories.filter(c => c.loaders.some(loader => favorites.includes(loader.id)))
    : categories

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-16 flex flex-col items-center justify-center gap-4 py-4">
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

        {/* Discord */}
        <button
          onClick={() => window.open('https://discord.gg/xK3sfUHn6s', '_blank')}
          className="p-3 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
          title="Discord"
        >
          <MessageCircle size={20} />
        </button>

        {/* Website */}
        <button
          onClick={() => window.open('https://mollys.mysellauth.com/', '_blank')}
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
      <div className="flex-1 flex flex-col overflow-hidden pl-8">
        {/* Categories grid */}
        <div className="w-full flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden pt-6">
          {filteredCategories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Star size={48} className="text-[var(--color-text-muted)] mb-4" />
              <p className="text-[var(--color-text-secondary)]">
                {filter === 'favorites' ? 'No favorites yet' : 'No categories available'}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {filter === 'favorites' && 'Click the star icon to add favorites'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-4">
              {filteredCategories.map((category, index) => (
                <ProductCard
                  key={category.id}
                  product={{
                    id: category.id,
                    name: category.name,
                    icon: category.icon,
                    exeCount: category.exeCount
                  }}
                  onClick={() => handleCategoryClick(category.id)}
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
