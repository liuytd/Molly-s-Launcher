export default function ProductCard({ product, onClick, style }) {
  return (
    <div
      onClick={onClick}
      className="glass rounded-xl p-3 cursor-pointer transition-all duration-200 hover:translate-x-1 hover:glow-purple animate-fade-in group relative flex items-center gap-4 w-[80%]"
      style={style}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${product.color}20, ${product.color}40)`,
          border: `1px solid ${product.color}50`,
          boxShadow: `0 0 20px ${product.color}20`
        }}
      >
        {product.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-[var(--color-text)] truncate w-full text-center">
          {product.name}
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {product.exeCount} product{product.exeCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Left border indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0 group-hover:w-1 transition-all duration-300 rounded-l-xl"
        style={{ background: product.color }}
      />
    </div>
  )
}
