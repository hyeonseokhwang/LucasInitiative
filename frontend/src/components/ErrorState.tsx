/**
 * Reusable error/empty state component for consistent messaging across panels.
 */

interface Props {
  title?: string
  message: string
  hint?: string
  onRetry?: () => void
}

export function ErrorState({ title, message, hint, onRetry }: Props) {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-8 text-center">
      <div className="flex justify-center mb-3">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      </div>
      {title && <h3 className="text-sm font-medium text-white mb-1">{title}</h3>}
      <p className="text-sm text-slate-400">{message}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-1.5 text-xs bg-slate-700/60 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-8 text-center">
      <div className="flex justify-center mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
      <p className="text-sm text-slate-400">{message}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
