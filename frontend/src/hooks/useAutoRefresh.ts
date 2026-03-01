import { useState, useEffect, useCallback, useRef } from 'react'

interface AutoRefreshOptions {
  /** Polling interval in ms (default: 30000 = 30s) */
  interval?: number
  /** Whether to start polling immediately (default: true) */
  enabled?: boolean
  /** Whether to fetch on mount (default: true) */
  fetchOnMount?: boolean
}

interface AutoRefreshResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => void
  /** Seconds since last update */
  secondsAgo: number
}

export function useAutoRefresh<T>(
  fetchFn: () => Promise<T>,
  options: AutoRefreshOptions = {},
): AutoRefreshResult<T> {
  const { interval = 30000, enabled = true, fetchOnMount = true } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const fetchRef = useRef(fetchFn)
  const mountedRef = useRef(true)

  // Keep fetchFn ref current
  fetchRef.current = fetchFn

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchRef.current()
      if (mountedRef.current) {
        setData(result)
        setLastUpdated(new Date())
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Fetch failed')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    mountedRef.current = true
    if (fetchOnMount) refresh()
    return () => { mountedRef.current = false }
  }, [fetchOnMount, refresh])

  // Polling interval
  useEffect(() => {
    if (!enabled || interval <= 0) return
    const id = setInterval(refresh, interval)
    return () => clearInterval(id)
  }, [enabled, interval, refresh])

  // Seconds-ago ticker (updates every 10s)
  useEffect(() => {
    if (!lastUpdated) return
    const tick = () => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return { data, loading, error, lastUpdated, refresh, secondsAgo }
}

/**
 * Hook to manage global refresh across multiple panels.
 * Returns a trigger counter that increments on each global refresh.
 */
export function useGlobalRefresh() {
  const [trigger, setTrigger] = useState(0)
  const refreshAll = useCallback(() => setTrigger(t => t + 1), [])
  return { trigger, refreshAll }
}
