import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import { api } from '../lib/api'
import { ACCENT, commonAxisProps, commonGridProps, commonTooltipProps } from '../lib/chartTheme'
import { SkeletonCards, SkeletonChart, SkeletonTable } from './SkeletonLoader'
import { ErrorState } from './ErrorState'
import type { KeywordTrend, CategoryTrend, WeeklyInsight, PipelineStats, NewsItem, QueueItem } from '../types'

type Tab = 'keywords' | 'insights' | 'pipeline' | 'news' | 'queue'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'keywords', label: 'Keywords', icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 3h10v2H7V8zm0 4h7v2H7v-2z' },
  { key: 'insights', label: 'AI Insights', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { key: 'pipeline', label: 'Pipeline', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { key: 'news', label: 'News', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1h2a2 2 0 012 2v9a2 2 0 01-2 2zM5 6v12h10V6H5z' },
  { key: 'queue', label: 'Queue', icon: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5' },
]

// Direction indicator
function DirectionBadge({ direction }: { direction: string }) {
  if (direction === 'rising') return (
    <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      Rising
    </span>
  )
  if (direction === 'falling') return (
    <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
      Falling
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-slate-400 text-xs">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
      Stable
    </span>
  )
}

// ---- Keywords Tab ----

function KeywordsTab() {
  const [trends, setTrends] = useState<KeywordTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const data = await api.trendsKeywords()
      setTrends(data.trends || [])
    } catch { setError(true) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="space-y-4"><SkeletonCards /><SkeletonChart height="h-64" /><SkeletonTable /></div>
  if (error) return <ErrorState message="Failed to load keyword trends" hint="Check if the backend is running" onRetry={load} />
  if (trends.length === 0) return <ErrorState message="No keyword data available yet" hint="Data will appear after the pipeline processes keywords" />

  const top20 = trends.slice(0, 20)
  const chartData = top20.map(t => ({
    keyword: t.keyword.length > 12 ? t.keyword.slice(0, 12) + '...' : t.keyword,
    total: t.total,
    first_half: t.first_half,
    second_half: t.second_half,
    direction: t.direction,
  }))

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Total Keywords</div>
          <div className="text-lg font-bold text-white">{trends.length}</div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Rising</div>
          <div className="text-lg font-bold text-emerald-400">{trends.filter(t => t.direction === 'rising').length}</div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Falling</div>
          <div className="text-lg font-bold text-red-400">{trends.filter(t => t.direction === 'falling').length}</div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Stable</div>
          <div className="text-lg font-bold text-slate-400">{trends.filter(t => t.direction === 'stable').length}</div>
        </div>
      </div>

      {/* Bar Chart: Top 20 keywords by frequency */}
      <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/30">
        <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">Top 20 Keywords (1st vs 2nd half)</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
              <CartesianGrid {...commonGridProps} />
              <XAxis dataKey="keyword" {...commonAxisProps} angle={-35} textAnchor="end" height={60} interval={0} fontSize={9} />
              <YAxis {...commonAxisProps} width={35} allowDecimals={false} />
              <Tooltip {...commonTooltipProps} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="first_half" name="1st Half" fill={ACCENT.blue} radius={[2, 2, 0, 0]} />
              <Bar dataKey="second_half" name="2nd Half" fill={ACCENT.cyan} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full keyword table */}
      <div className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/30">
          <h4 className="text-xs font-medium text-slate-400 uppercase">All Keywords</h4>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800">
              <tr className="text-slate-500 uppercase">
                <th className="text-left px-4 py-2">Keyword</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-right px-4 py-2">1st Half</th>
                <th className="text-right px-4 py-2">2nd Half</th>
                <th className="text-right px-4 py-2">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {trends.map((t, i) => (
                <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-2 text-white font-medium">{t.keyword}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{t.total}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{t.first_half}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{t.second_half}</td>
                  <td className="px-4 py-2 text-right"><DirectionBadge direction={t.direction} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---- AI Insights Tab ----

function InsightsTab() {
  const [insights, setInsights] = useState<WeeklyInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(false)
    try {
      const data = await api.trendsInsights()
      setInsights(data.insights || [])
    } catch { setError(true) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse bg-slate-900/40 rounded-lg border border-slate-700/30 h-16" />)}</div>
  if (error) return <ErrorState message="Failed to load AI insights" onRetry={load} />
  if (insights.length === 0) return <ErrorState message="No weekly insights available yet" hint="Insights are generated weekly by the AI pipeline" />

  return (
    <div className="space-y-3">
      {insights.map(ins => (
        <div key={ins.id} className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === ins.id ? null : ins.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-slate-500 transition-transform shrink-0 ${expandedId === ins.id ? 'rotate-90' : ''}`}>
                <path d="M9 18l6-6-6-6" />
              </svg>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                <span className="text-sm font-medium text-white truncate">{ins.title}</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 shrink-0 ml-2">
              {new Date(ins.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          </button>

          {expandedId === ins.id && (
            <div className="px-4 pb-4 border-t border-slate-700/30">
              <div className="prose prose-sm prose-invert max-w-none mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {ins.content}
              </div>
              {ins.data_json && (() => {
                try {
                  const data = JSON.parse(ins.data_json)
                  return (
                    <details className="mt-3">
                      <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300">Raw Data</summary>
                      <pre className="mt-1 text-[10px] text-slate-500 bg-slate-950 p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </details>
                  )
                } catch { return null }
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Pipeline Monitor Tab ----

function PipelineTab() {
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const data = await api.trendsPipeline()
      setStats(data)
    } catch { setError(true) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="space-y-4"><SkeletonCards /><SkeletonChart /></div>
  if (error) return <ErrorState message="Failed to load pipeline stats" onRetry={load} />
  if (!stats) return <ErrorState message="Pipeline stats unavailable" hint="The data pipeline may not be running" />

  const session = stats.session || {} as any
  const historical = stats.historical || {} as any
  const stages = stats.stage_performance || {}
  const errors = stats.recent_errors || []

  const successRate = session.total_processed > 0
    ? ((session.success_count / session.total_processed) * 100).toFixed(1)
    : '0'

  const stageData = Object.entries(stages).map(([name, s]) => ({
    name: name.length > 15 ? name.slice(0, 15) + '...' : name,
    avg_ms: Math.round(s.avg_ms),
    count: s.count,
    error_rate: +(s.error_rate * 100).toFixed(1),
  }))

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Processed</div>
          <div className="text-lg font-bold text-white">{session.total_processed || 0}</div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Success Rate</div>
          <div className={`text-lg font-bold ${+successRate >= 90 ? 'text-emerald-400' : +successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {successRate}%
          </div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Avg Time</div>
          <div className="text-lg font-bold text-blue-400">{Math.round(session.avg_processing_ms || 0)}ms</div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 uppercase">Errors</div>
          <div className="text-lg font-bold text-red-400">{session.error_count || 0}</div>
        </div>
      </div>

      {/* Historical stats */}
      <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/30">
        <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">Historical</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-500">Total items: </span><span className="text-white">{historical.total_items || 0}</span></div>
          <div><span className="text-slate-500">Avg/day: </span><span className="text-white">{(historical.avg_per_day || 0).toFixed(1)}</span></div>
          <div><span className="text-slate-500">Peak day: </span><span className="text-white">{historical.peak_day || '-'}</span></div>
          <div><span className="text-slate-500">Peak count: </span><span className="text-white">{historical.peak_count || 0}</span></div>
        </div>
      </div>

      {/* Stage Performance Chart */}
      {stageData.length > 0 && (
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/30">
          <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">Stage Performance (Avg ms)</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
                <CartesianGrid {...commonGridProps} />
                <XAxis dataKey="name" {...commonAxisProps} angle={-25} textAnchor="end" height={50} interval={0} fontSize={9} />
                <YAxis {...commonAxisProps} width={40} />
                <Tooltip {...commonTooltipProps} formatter={(v: number, name: string) => [
                  name === 'avg_ms' ? `${v}ms` : name === 'error_rate' ? `${v}%` : v,
                  name === 'avg_ms' ? 'Avg Time' : name === 'error_rate' ? 'Error Rate' : name,
                ]} />
                <Bar dataKey="avg_ms" fill={ACCENT.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {errors.length > 0 && (
        <div className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <h4 className="text-xs font-medium text-slate-400 uppercase">Recent Errors ({errors.length})</h4>
          </div>
          <div className="max-h-[250px] overflow-auto divide-y divide-slate-700/30">
            {errors.map((err, i) => (
              <div key={i} className="px-4 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-medium">{err.stage}</span>
                  <span className="text-slate-600">{err.timestamp ? new Date(err.timestamp).toLocaleString('ko-KR') : ''}</span>
                </div>
                <p className="text-slate-400 mt-0.5 truncate">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- News Feed Tab ----

const NEWS_CATEGORIES = ['all', 'stock', 'realestate', 'general', 'tech', 'economy']

function NewsTab() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.trendsNews(category === 'all' ? undefined : category)
      setItems(data.items || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [category])

  useEffect(() => { load() }, [load])

  const catColor = (cat: string) => {
    switch (cat) {
      case 'stock': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'realestate': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'tech': return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
      case 'economy': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {NEWS_CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
              category === c
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 font-medium'
                : 'text-slate-400 border-slate-700/50 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {c === 'all' ? 'All' : c === 'realestate' ? 'Real Estate' : c}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse bg-slate-900/40 rounded-lg border border-slate-700/30 h-28" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <ErrorState message="No news items available" hint="News will appear as the pipeline collects data" />
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item, i) => (
            <div key={item.id || i} className="bg-slate-900/40 rounded-lg border border-slate-700/30 p-4 hover:border-slate-600/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-white hover:text-blue-400 transition-colors line-clamp-2">
                      {item.title}
                    </a>
                  ) : (
                    <h5 className="text-sm font-medium text-white line-clamp-2">{item.title}</h5>
                  )}
                  {item.summary && (
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-3">{item.summary}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-1.5 py-0.5 text-[10px] rounded border ${catColor(item.category)}`}>
                  {item.category === 'realestate' ? 'RE' : item.category}
                </span>
                <span className="text-[10px] text-slate-500">{item.source}</span>
                <span className="text-[10px] text-slate-600 ml-auto">
                  {new Date(item.published_at || item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Research Queue Tab ----

function QueueTab() {
  const [queued, setQueued] = useState<QueueItem[]>([])
  const [completed, setCompleted] = useState<QueueItem[]>([])
  const [processing, setProcessing] = useState<QueueItem | null>(null)
  const [queueSize, setQueueSize] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.trendsQueue()
      setQueued(data.queued || [])
      setProcessing(data.processing || null)
      setCompleted(data.completed || [])
      setQueueSize(data.queue_size || 0)
      setIsProcessing(data.is_processing || false)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="space-y-4"><SkeletonCards count={2} /><SkeletonTable rows={3} /></div>

  const statusColor: Record<string, string> = {
    queued: 'bg-amber-400',
    processing: 'bg-blue-400 animate-pulse',
    completed: 'bg-emerald-400',
    failed: 'bg-red-400',
  }

  const statusText: Record<string, string> = {
    queued: 'text-amber-400',
    processing: 'text-blue-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isProcessing ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-sm font-medium text-white">
            {isProcessing ? 'Processing' : 'Idle'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Queue: <span className="text-white font-medium">{queueSize}</span></span>
          <span>Completed: <span className="text-emerald-400">{completed.length}</span></span>
        </div>
      </div>

      {/* Currently Processing */}
      {processing && (
        <div className="bg-blue-500/5 rounded-lg border border-blue-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-medium text-blue-400 uppercase">Currently Processing</span>
          </div>
          <p className="text-sm text-white">{processing.query}</p>
          <div className="flex items-center gap-2 mt-1">
            {processing.category && (
              <span className="px-1.5 py-0.5 text-[10px] rounded border bg-slate-500/10 text-slate-400 border-slate-500/20">{processing.category}</span>
            )}
            <span className="text-[10px] text-slate-500">P{processing.priority}</span>
            {processing.started_at && (
              <span className="text-[10px] text-slate-600">Started: {new Date(processing.started_at).toLocaleTimeString('ko-KR')}</span>
            )}
          </div>
        </div>
      )}

      {/* Queued Items */}
      <div className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/30 flex items-center justify-between">
          <h4 className="text-xs font-medium text-slate-400 uppercase">Queued ({queued.length})</h4>
        </div>
        {queued.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-500 text-center">Queue is empty</div>
        ) : (
          <div className="divide-y divide-slate-700/30 max-h-[300px] overflow-auto">
            {queued.map((item, i) => (
              <div key={item.id || i} className="px-4 py-2.5 flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor[item.status] || 'bg-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{item.query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">P{item.priority}</span>
                    {item.category && <span className="text-[10px] text-slate-600">{item.category}</span>}
                  </div>
                </div>
                <span className={`text-[10px] ${statusText[item.status] || 'text-slate-500'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Items */}
      {completed.length > 0 && (
        <div className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700/30">
            <h4 className="text-xs font-medium text-slate-400 uppercase">Recently Completed ({completed.length})</h4>
          </div>
          <div className="divide-y divide-slate-700/30 max-h-[250px] overflow-auto">
            {completed.map((item, i) => (
              <div key={item.id || i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{item.query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.category && <span className="text-[10px] text-slate-600">{item.category}</span>}
                    {item.completed_at && (
                      <span className="text-[10px] text-slate-600">
                        {new Date(item.completed_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400">done</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Category Trends (shown in keywords tab header) ----

function CategoryChart() {
  const [data, setData] = useState<CategoryTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.trendsCategories()
      .then(d => setData(d.category_trends || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || data.length === 0) return null

  return (
    <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/30">
      <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">Category Trends Over Time</h4>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
            <CartesianGrid {...commonGridProps} />
            <XAxis dataKey="date" {...commonAxisProps} />
            <YAxis {...commonAxisProps} width={35} allowDecimals={false} />
            <Tooltip {...commonTooltipProps} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="stock" name="Stock" stroke={ACCENT.blue} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="realestate" name="Real Estate" stroke={ACCENT.green} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="general" name="General" stroke={ACCENT.amber} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---- Main TrendsPanel ----

export function TrendsPanel() {
  const [tab, setTab] = useState<Tab>('keywords')

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/50 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'keywords' && (
        <div className="space-y-4">
          <CategoryChart />
          <KeywordsTab />
        </div>
      )}
      {tab === 'insights' && <InsightsTab />}
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'news' && <NewsTab />}
      {tab === 'queue' && <QueueTab />}
    </div>
  )
}
