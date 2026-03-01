import { useState, useEffect, useCallback } from 'react'

interface Props {
  title: string
  children: React.ReactNode
  /** Auto-refresh interval in ms (default: 30000). Set 0 to disable. */
  interval?: number
  /** External trigger — increment to force refresh */
  refreshTrigger?: number
  /** Full height panel (default: true) */
  fullHeight?: boolean
}

function formatAgo(seconds: number): string {
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ago`
}

/**
 * Wraps a panel with a header bar showing title, last updated time, and refresh button.
 * On refresh, increments an internal key to force React to unmount/remount children,
 * triggering their useEffect data fetches without modifying them.
 */
export function PanelWrapper({
  title, children, interval = 30000, refreshTrigger = 0, fullHeight = true,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [spinning, setSpinning] = useState(false)

  const doRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    setLastUpdated(new Date())
    setSpinning(true)
    setTimeout(() => setSpinning(false), 600)
  }, [])

  // Auto-refresh polling
  useEffect(() => {
    if (interval <= 0) return
    const id = setInterval(doRefresh, interval)
    return () => clearInterval(id)
  }, [interval, doRefresh])

  // Respond to external (global) refresh trigger
  useEffect(() => {
    if (refreshTrigger > 0) doRefresh()
  }, [refreshTrigger, doRefresh])

  // Seconds-ago ticker
  useEffect(() => {
    const tick = () => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return (
    <div className={fullHeight ? 'h-[calc(100vh-120px)] flex flex-col' : 'flex flex-col'}>
      {/* Panel Header */}
      <div className="flex items-center justify-between px-1 pb-2 shrink-0">
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${secondsAgo > 60 ? 'text-amber-400' : 'text-slate-500'}`}>
            {formatAgo(secondsAgo)}
          </span>
          <button
            onClick={doRefresh}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={spinning ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
              <path d="M21 3v9h-9" />
            </svg>
          </button>
        </div>
      </div>
      {/* Panel Content — key forces remount on refresh */}
      <div key={refreshKey} className={fullHeight ? 'flex-1 min-h-0' : ''}>
        {children}
      </div>
    </div>
  )
}
