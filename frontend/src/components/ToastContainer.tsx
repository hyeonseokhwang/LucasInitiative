import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'

// ---- Types ----
export interface Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  action?: () => void  // click handler (e.g. navigate to tab)
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export const useToast = () => useContext(ToastContext)

// ---- Constants ----
const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 5000

const TYPE_STYLES: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
  info:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    icon: 'i' },
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'v' },
  warning: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: '!' },
  error:   { bg: 'bg-red-500/10',     border: 'border-red-500/30',     icon: 'x' },
}

const ICON_COLORS: Record<Toast['type'], string> = {
  info:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  error:   'bg-red-500/20 text-red-400 border-red-500/30',
}

// ---- Single Toast Item ----
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(toast.id), 300)
    }, AUTO_DISMISS_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, onDismiss])

  const handleClick = () => {
    if (toast.action) toast.action()
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 150)
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 150)
  }

  const style = TYPE_STYLES[toast.type]

  return (
    <div
      onClick={toast.action ? handleClick : undefined}
      className={`
        w-80 rounded-xl border shadow-xl backdrop-blur-sm p-3.5
        ${style.bg} ${style.border}
        ${toast.action ? 'cursor-pointer hover:scale-[1.02]' : ''}
        transition-all duration-300
        ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      style={{ animation: exiting ? undefined : 'slideInRight 0.3s ease-out' }}
    >
      <div className="flex items-start gap-2.5">
        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border ${ICON_COLORS[toast.type]}`}>
          {style.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white mb-0.5">{toast.title}</div>
          <div className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{toast.message}</div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ---- Provider + Container ----
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => {
      const next = [{ ...t, id }, ...prev]
      return next.slice(0, MAX_TOASTS) // keep max 3
    })
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast stack — fixed top-right */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* Keyframe animation */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
