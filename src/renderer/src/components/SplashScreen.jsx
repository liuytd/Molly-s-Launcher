export default function SplashScreen({ text = 'LOADING...' }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[var(--color-bg-dark)] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-radial from-[var(--color-primary)]/10 via-transparent to-transparent" />

      {/* Animated circles */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-[var(--color-primary)]/30 animate-spin-slow" />

        {/* Middle ring */}
        <div className="absolute inset-4 rounded-full border border-[var(--color-secondary)]/40 animate-spin-reverse" />

        {/* Inner ring with glow */}
        <div className="absolute inset-8 rounded-full border-2 border-[var(--color-primary)] animate-pulse-glow" />

        {/* Center dot */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] glow-purple" />

        {/* Decorative arcs */}
        <svg className="absolute inset-0 w-full h-full animate-spin-slow" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="url(#arcGradient)"
            strokeWidth="2"
            strokeDasharray="100 200"
            strokeLinecap="round"
          />
        </svg>

        <svg className="absolute inset-0 w-full h-full animate-spin-reverse" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="70"
            fill="none"
            stroke="var(--color-secondary)"
            strokeWidth="1"
            strokeDasharray="50 150"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Loading text */}
      <div className="mt-8 text-center">
        <p className="text-sm tracking-[0.3em] text-[var(--color-text-secondary)] animate-pulse">
          {text}
        </p>
      </div>

      {/* Progress dots */}
      <div className="mt-4 flex gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent" />
    </div>
  )
}
