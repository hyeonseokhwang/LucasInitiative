import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  source: string
}

type LogLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

const LEVEL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  ERROR: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-l-red-500' },
  WARN:  { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-l-amber-500' },
  INFO:  { text: 'text-blue-400', bg: 'bg-transparent', border: 'border-l-blue-500/30' },
  DEBUG: { text: 'text-slate-500', bg: 'bg-transparent', border: 'border-l-slate-600/30' },
}

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<LogLevel>('ALL')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [lineCount, setLineCount] = useState(100)
  const [stats, setStats] = useState<{ total: number; counts: Record<string, number> } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const opts: any = { lines: lineCount }
      if (level !== 'ALL') opts.level = level
      if (search.trim()) opts.search = search.trim()
      const [logData, statsData] = await Promise.all([
        api.logs(opts),
        api.logStats(),
      ])
      setLogs(logData.logs || [])
      setStats(statsData)
    } catch { /* ignore */ }
    setLoading(false)
  }, [level, search, lineCount])

  useEffect(() => {
    fetchLogs()
    pollRef.current = setInterval(fetchLogs, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchLogs])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
  }

  const formatTime = (t: string) => {
    try {
      const d = new Date(t)
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch { return '' }
  }

  const levels: LogLevel[] = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG']

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Level filter */}
        <div className="flex gap-1">
          {levels.map(l => {
            const count = l === 'ALL' ? stats?.total : stats?.counts[l]
            return (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5 ${
                  level === l
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {l}
                {count !== undefined && (
                  <span className={`text-[10px] ${level === l ? 'text-blue-200' : 'text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search logs..."
              className="w-full text-sm bg-slate-800 text-slate-200 rounded-md px-3 py-1.5 pl-8 border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
            <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          {search && (
            <button onClick={clearSearch} className="text-xs text-slate-400 hover:text-white px-2 py-1">
              Clear
            </button>
          )}
        </form>

        {/* Line count */}
        <select
          value={lineCount}
          onChange={e => setLineCount(Number(e.target.value))}
          className="text-xs bg-slate-800 text-slate-300 rounded-md px-2 py-1.5 border border-slate-700"
        >
          <option value={50}>50 lines</option>
          <option value={100}>100 lines</option>
          <option value={200}>200 lines</option>
          <option value={500}>500 lines</option>
        </select>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            autoScroll
              ? 'bg-emerald-600/20 text-emerald-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          Auto-scroll {autoScroll ? 'ON' : 'OFF'}
        </button>

        {/* Refresh */}
        <button
          onClick={fetchLogs}
          className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        className="flex-1 bg-slate-950 rounded-lg border border-slate-700/50 overflow-auto font-mono text-xs"
        onScroll={() => {
          if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
            // Disable auto-scroll if user scrolled up
            if (scrollHeight - scrollTop - clientHeight > 50) {
              setAutoScroll(false)
            }
          }
        }}
      >
        {loading && logs.length === 0 && (
          <div className="p-4 text-slate-500 animate-pulse">Loading logs...</div>
        )}

        {!loading && logs.length === 0 && (
          <div className="p-4 text-slate-500">No logs found{search ? ` matching "${search}"` : ''}.</div>
        )}

        <div className="p-1">
          {logs.map((log, i) => {
            const colors = LEVEL_COLORS[log.level] || LEVEL_COLORS.INFO
            return (
              <div
                key={i}
                className={`flex gap-2 px-2 py-0.5 border-l-2 ${colors.border} ${colors.bg} hover:bg-slate-800/50 transition-colors`}
              >
                <span className="text-slate-600 whitespace-nowrap select-none">
                  {formatTime(log.timestamp)}
                </span>
                <span className={`w-12 text-right shrink-0 font-bold ${colors.text}`}>
                  {log.level}
                </span>
                <span className="text-slate-500 w-16 shrink-0 truncate">
                  {log.source}
                </span>
                <span className={`flex-1 whitespace-pre-wrap break-all ${
                  log.level === 'ERROR' ? 'text-red-300' :
                  log.level === 'WARN' ? 'text-amber-300' :
                  log.level === 'DEBUG' ? 'text-slate-500' :
                  'text-slate-300'
                }`}>
                  {search ? highlightSearch(log.message, search) : log.message}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
        <span>{logs.length} lines shown</span>
        <div className="flex items-center gap-3">
          {stats && (
            <>
              <span>Total: {stats.total}</span>
              <span className="text-red-400">ERR: {stats.counts.ERROR || 0}</span>
              <span className="text-amber-400">WARN: {stats.counts.WARN || 0}</span>
              <span className="text-blue-400">INFO: {stats.counts.INFO || 0}</span>
            </>
          )}
          <span>Polling every 3s</span>
        </div>
      </div>
    </div>
  )
}

function highlightSearch(text: string, search: string): React.ReactNode {
  if (!search) return text
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase()
      ? <mark key={i} className="bg-amber-500/30 text-amber-200 rounded px-0.5">{part}</mark>
      : part
  )
}
