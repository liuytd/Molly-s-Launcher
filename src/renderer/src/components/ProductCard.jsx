export default function ProductCard({ product, onClick, style }) {
  return (
    <div
      onClick={onClick}
      className="glass rounded-xl p-4 cursor-pointer transition-all duration-200 hover:translate-x-1 hover:glow-purple animate-fade-in group relative flex items-center w-[90%]"
      style={style}
    >
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 ml-4"
        style={{
          background: `linear-gradient(135deg, ${product.color}20, ${product.color}40)`,
          border: `1px solid ${product.color}50`,
          boxShadow: `0 0 20px ${product.color}20`
        }}
      >
        {product.icon}
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <h3 className="text-base font-medium text-[var(--color-text)] truncate max-w-[60%]">
          {product.name}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
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
