import { useState, useEffect, useCallback, useRef } from 'react'

interface Props {
  onRefresh: () => void | Promise<void>
  intervalSec?: number  // auto-refresh interval, 0 = disabled
  className?: string
}

export function RefreshIndicator({ onRefresh, intervalSec = 0, className = '' }: Props) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [timeAgo, setTimeAgo] = useState('just now')
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } catch { /* ignore */ }
    setLastUpdated(new Date())
    setRefreshing(false)
  }, [onRefresh])

  // Auto-refresh interval
  useEffect(() => {
    if (intervalSec > 0) {
      intervalRef.current = setInterval(doRefresh, intervalSec * 1000)
      return () => clearInterval(intervalRef.current)
    }
  }, [intervalSec, doRefresh])

  // Update "time ago" display every 10 seconds
  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      if (diff < 5) setTimeAgo('just now')
      else if (diff < 60) setTimeAgo(`${diff}s ago`)
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`)
      else setTimeAgo(`${Math.floor(diff / 3600)}h ago`)
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return (
    <div className={`flex items-center gap-2 text-[10px] text-slate-500 ${className}`}>
      <span className="flex items-center gap-1">
        {refreshing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-blue-400">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600">
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
        )}
        {timeAgo}
      </span>
      <button
        onClick={doRefresh}
        disabled={refreshing}
        className="p-0.5 rounded hover:bg-slate-700/50 transition-colors disabled:opacity-50"
        title="Refresh now"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-slate-400 hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
      </button>
      {intervalSec > 0 && (
        <span className="text-slate-600">auto: {intervalSec}s</span>
      )}
    </div>
  )
}
