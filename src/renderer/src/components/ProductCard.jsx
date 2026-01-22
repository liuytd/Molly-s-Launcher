import { Star } from 'lucide-react'

export default function ProductCard({ product, isFavorite, onToggleFavorite, onClick, style }) {
  return (
    <div
      onClick={onClick}
      className="glass rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-105 hover:glow-purple animate-fade-in group relative"
      style={style}
    >
      {/* Favorite button */}
      <button
        onClick={(e) => onToggleFavorite(product.id, e)}
        className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-primary)]/20"
      >
        <Star
          size={14}
          className={`transition-colors ${
            isFavorite
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-[var(--color-text-muted)] hover:text-yellow-400'
          }`}
        />
      </button>

      {/* Icon */}
      <div
        className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center text-2xl"
        style={{
          background: `linear-gradient(135deg, ${product.color}20, ${product.color}40)`,
          border: `1px solid ${product.color}50`,
          boxShadow: `0 0 20px ${product.color}20`
        }}
      >
        {product.icon}
      </div>

      {/* Name */}
      <h3 className="text-sm font-medium text-center text-[var(--color-text)] truncate">
        {product.name}
      </h3>

      {/* EXE count */}
      <p className="text-xs text-center text-[var(--color-text-muted)] mt-1">
        {product.exeCount} product{product.exeCount !== 1 ? 's' : ''}
      </p>

      {/* Hover indicator */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 group-hover:w-1/2 transition-all duration-300 rounded-full"
        style={{ background: product.color }}
      />
    </div>
  )
}
