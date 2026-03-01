import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts'
import { fetchJson, downloadExport } from '../lib/api'
import { CONFIDENCE_COLORS, commonAxisProps, commonGridProps, commonTooltipProps } from '../lib/chartTheme'
import type { ResearchReport, ResearchEvidence, ResearchTopic } from '../types'

interface Props {
  researchUpdate?: any
  researchComplete?: any
}

// --- Helpers ---

const confColor = (conf: number) =>
  conf >= 0.7 ? 'text-emerald-400' : conf >= 0.4 ? 'text-amber-400' : 'text-red-400'

const confBg = (conf: number) =>
  conf >= 0.7 ? 'bg-emerald-500' : conf >= 0.4 ? 'bg-amber-500' : 'bg-red-500'

const confBgLight = (conf: number) =>
  conf >= 0.7 ? 'bg-emerald-500/10 border-emerald-500/20' : conf >= 0.4 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

function formatFullDate(ts: string) {
  try {
    return new Date(ts).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

const statusColor: Record<string, string> = {
  completed: 'text-emerald-400',
  running: 'text-blue-400',
  pending: 'text-amber-400',
  queued: 'text-amber-400',
  failed: 'text-red-400',
}

const statusDot: Record<string, string> = {
  completed: 'bg-emerald-400',
  running: 'bg-blue-400 animate-pulse',
  pending: 'bg-amber-400',
  queued: 'bg-amber-400',
  failed: 'bg-red-400',
}

// --- Filter Bar ---

function FilterBar({ filters, onChange }: {
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Filters</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {/* Keyword Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] text-slate-500 uppercase mb-1 block">Keyword</label>
          <input
            type="text"
            value={filters.keyword}
            onChange={e => onChange({ ...filters, keyword: e.target.value })}
            placeholder="Search title, summary..."
            className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase mb-1 block">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            className="bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase mb-1 block">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            className="bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Confidence Range */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase mb-1 block">
            Confidence: {filters.confMin}% - {filters.confMax}%
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range" min={0} max={100} step={5}
              value={filters.confMin}
              onChange={e => onChange({ ...filters, confMin: +e.target.value })}
              className="w-20 accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-slate-500">-</span>
            <input
              type="range" min={0} max={100} step={5}
              value={filters.confMax}
              onChange={e => onChange({ ...filters, confMax: +e.target.value })}
              className="w-20 accent-blue-500 h-1.5"
            />
          </div>
        </div>

        {/* Clear */}
        {(filters.keyword || filters.dateFrom || filters.dateTo || filters.confMin > 0 || filters.confMax < 100) && (
          <button
            onClick={() => onChange({ keyword: '', dateFrom: '', dateTo: '', confMin: 0, confMax: 100 })}
            className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1.5"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

// --- Inline Expandable Report ---

function ReportItem({ report, isExpanded, onToggle }: {
  report: ResearchReport
  isExpanded: boolean
  onToggle: () => void
}) {
  const [evidence, setEvidence] = useState<ResearchEvidence[]>([])
  const [loading, setLoading] = useState(false)
  const [fullReport, setFullReport] = useState<ResearchReport | null>(null)

  useEffect(() => {
    if (isExpanded && evidence.length === 0 && !loading) {
      setLoading(true)
      fetchJson<{ report: ResearchReport; evidence: ResearchEvidence[] }>(
        `/api/research/reports/${report.id}`
      ).then(data => {
        setFullReport(data.report)
        setEvidence(data.evidence || [])
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [isExpanded, report.id, evidence.length, loading])

  const displayReport = fullReport || report

  return (
    <div className={`transition-all ${isExpanded ? 'bg-slate-700/20' : 'hover:bg-slate-700/15'}`}>
      {/* Collapsed Row */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-4 text-left"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>

        {/* Confidence Badge */}
        <div className={`w-9 h-9 rounded-lg border ${confBgLight(report.confidence_avg)} flex items-center justify-center shrink-0`}>
          <span className={`text-xs font-bold ${confColor(report.confidence_avg)}`}>
            {Math.round(report.confidence_avg * 100)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{report.title}</div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{report.summary}</div>
        </div>

        {/* Meta */}
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500">{formatDate(report.created_at)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {report.evidence_count} evidence
            {report.contradictions > 0 && <span className="text-red-400 ml-1">| {report.contradictions} conflicts</span>}
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-[72px]">
          {loading ? (
            <div className="text-xs text-slate-500 py-4 animate-pulse">Loading analysis...</div>
          ) : (
            <div className="space-y-3">
              {/* Stats Bar */}
              <div className="flex items-center gap-4 text-xs">
                <span className={confColor(displayReport.confidence_avg)}>
                  Confidence: {Math.round(displayReport.confidence_avg * 100)}%
                </span>
                <span className="text-slate-400">
                  Agreement: {Math.round(displayReport.agreement_rate * 100)}%
                </span>
                <span className="text-slate-400">{displayReport.evidence_count} sources</span>
                {displayReport.contradictions > 0 && (
                  <span className="text-red-400">{displayReport.contradictions} contradictions</span>
                )}
                {displayReport.model_used && (
                  <span className="text-slate-500 ml-auto">{displayReport.model_used}</span>
                )}
              </div>

              {/* Confidence Bar */}
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confBg(displayReport.confidence_avg)}`}
                  style={{ width: `${displayReport.confidence_avg * 100}%` }}
                />
              </div>

              {/* Summary */}
              <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Summary</div>
                <p className="text-sm text-slate-300 leading-relaxed">{displayReport.summary}</p>
              </div>

              {/* Full Analysis */}
              {displayReport.full_analysis && (
                <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Full Analysis</div>
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-auto">
                    {displayReport.full_analysis}
                  </div>
                </div>
              )}

              {/* Evidence Chain */}
              {evidence.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                    Evidence Chain ({evidence.length})
                  </div>
                  <div className="space-y-1.5 max-h-[300px] overflow-auto">
                    {evidence.map((ev, i) => {
                      const hasConflict = ev.contradicts && JSON.parse(ev.contradicts || '[]').length > 0
                      return (
                        <div
                          key={ev.id || i}
                          className={`p-2.5 rounded-lg border ${
                            hasConflict
                              ? 'bg-red-500/5 border-red-500/20'
                              : ev.verified
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-slate-900/40 border-slate-700/30'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`text-xs font-mono mt-0.5 shrink-0 ${confColor(ev.confidence)}`}>
                              {Math.round(ev.confidence * 100)}%
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300 break-words">{ev.claim}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500">{ev.source_type}</span>
                                {ev.verified && <span className="text-[10px] text-emerald-400">Verified</span>}
                                {hasConflict && <span className="text-[10px] text-red-400">Contradicted</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- History Timeline ---

function HistoryTimeline({ topics }: { topics: ResearchTopic[] }) {
  if (topics.length === 0) {
    return (
      <div className="text-xs text-slate-500 text-center py-6">
        No research history yet.
      </div>
    )
  }

  return (
    <div className="space-y-0.5 max-h-[400px] overflow-auto">
      {topics.map(topic => (
        <div key={topic.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-700/20 transition-colors">
          {/* Timeline dot + line */}
          <div className="flex flex-col items-center pt-1 shrink-0">
            <div className={`w-2 h-2 rounded-full ${statusDot[topic.status] || 'bg-slate-500'}`} />
            <div className="w-px h-full bg-slate-700/50 mt-1" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white truncate">{topic.title}</span>
              <span className={`text-[10px] ${statusColor[topic.status] || 'text-slate-500'}`}>
                {topic.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-500">{timeAgo(topic.created_at)}</span>
              <span className="text-[10px] text-slate-600">{topic.trigger_type}</span>
              {topic.priority > 1 && (
                <span className="text-[10px] text-amber-400">P{topic.priority}</span>
              )}
            </div>
            {topic.completed_at && (
              <div className="text-[10px] text-slate-600 mt-0.5">
                Completed: {formatFullDate(topic.completed_at)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Filter State ---

interface FilterState {
  keyword: string
  dateFrom: string
  dateTo: string
  confMin: number
  confMax: number
}

const defaultFilters: FilterState = { keyword: '', dateFrom: '', dateTo: '', confMin: 0, confMax: 100 }

// --- Main Panel ---

export function ResearchPanel({ researchUpdate, researchComplete }: Props) {
  const [reports, setReports] = useState<ResearchReport[]>([])
  const [topics, setTopics] = useState<ResearchTopic[]>([])
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<'reports' | 'timeline'>('reports')

  // Load data
  useEffect(() => {
    fetchJson<{ reports: ResearchReport[] }>('/api/research/reports').then(d => setReports(d.reports || []))
    fetchJson<{ engine: any }>('/api/research/status').then(d => setEngineStatus(d.engine))
    fetchJson<{ topics: ResearchTopic[] }>('/api/research/topics').then(d => setTopics(d.topics || []))
  }, [])

  // Refresh on research complete
  useEffect(() => {
    if (researchComplete) {
      fetchJson<{ reports: ResearchReport[] }>('/api/research/reports').then(d => setReports(d.reports || []))
      fetchJson<{ engine: any }>('/api/research/status').then(d => setEngineStatus(d.engine))
      fetchJson<{ topics: ResearchTopic[] }>('/api/research/topics').then(d => setTopics(d.topics || []))
    }
  }, [researchComplete])

  // Update engine status on research updates
  useEffect(() => {
    if (researchUpdate) {
      fetchJson<{ engine: any }>('/api/research/status').then(d => setEngineStatus(d.engine))
    }
  }, [researchUpdate])

  const triggerResearch = async () => {
    if (!query.trim()) return
    setTriggering(true)
    try {
      await fetchJson('/api/research/trigger?' + new URLSearchParams({ query: query.trim() }), { method: 'POST' })
      setQuery('')
      // Refresh topics
      fetchJson<{ topics: ResearchTopic[] }>('/api/research/topics').then(d => setTopics(d.topics || []))
    } catch {}
    setTriggering(false)
  }

  // Filtered reports
  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        if (!r.title.toLowerCase().includes(kw) && !r.summary.toLowerCase().includes(kw)) return false
      }
      if (filters.dateFrom) {
        if (new Date(r.created_at) < new Date(filters.dateFrom)) return false
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo)
        to.setDate(to.getDate() + 1) // include end date
        if (new Date(r.created_at) >= to) return false
      }
      const confPct = r.confidence_avg * 100
      if (confPct < filters.confMin || confPct > filters.confMax) return false
      return true
    })
  }, [reports, filters])

  const hasActiveFilters = filters.keyword || filters.dateFrom || filters.dateTo || filters.confMin > 0 || filters.confMax < 100

  return (
    <div className="space-y-4">
      {/* Engine Status Bar */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${engineStatus?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm font-medium text-white">Research Engine</span>
            <span className="text-xs text-slate-400">
              {engineStatus?.running ? 'Active' : 'Stopped'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Cycles: {engineStatus?.cycles || 0}</span>
            <span>Reports: {engineStatus?.reports_generated || 0}</span>
            <span>Queue: {engineStatus?.queue_size || 0}</span>
            {engineStatus?.current_topic && (
              <span className="text-emerald-400 animate-pulse">
                Researching: {engineStatus.current_topic}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confidence Distribution & Stats */}
      {reports.length > 0 && (() => {
        const buckets = [
          { range: '0-20%', min: 0, max: 0.2, count: 0, color: CONFIDENCE_COLORS[0] },
          { range: '20-40%', min: 0.2, max: 0.4, count: 0, color: CONFIDENCE_COLORS[1] },
          { range: '40-60%', min: 0.4, max: 0.6, count: 0, color: CONFIDENCE_COLORS[2] },
          { range: '60-80%', min: 0.6, max: 0.8, count: 0, color: CONFIDENCE_COLORS[3] },
          { range: '80-100%', min: 0.8, max: 1.01, count: 0, color: CONFIDENCE_COLORS[4] },
        ]
        reports.forEach(r => {
          const b = buckets.find(b => r.confidence_avg >= b.min && r.confidence_avg < b.max)
          if (b) b.count++
        })

        const avgConf = reports.reduce((s, r) => s + r.confidence_avg, 0) / reports.length
        const totalEvidence = reports.reduce((s, r) => s + r.evidence_count, 0)
        const totalConflicts = reports.reduce((s, r) => s + r.contradictions, 0)

        return (
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Research Analytics</h3>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Avg confidence: <span className={confColor(avgConf)}>{Math.round(avgConf * 100)}%</span></span>
                <span>{totalEvidence} total evidence</span>
                <span className="text-red-400">{totalConflicts} conflicts</span>
              </div>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid {...commonGridProps} />
                  <XAxis dataKey="range" {...commonAxisProps} />
                  <YAxis {...commonAxisProps} width={30} allowDecimals={false} />
                  <Tooltip
                    {...commonTooltipProps}
                    formatter={(v) => [`${v} reports`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {buckets.map((b, i) => (
                      <Cell key={i} fill={b.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}

      {/* Manual Research Input */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && triggerResearch()}
            placeholder="Research topic (e.g. Samsung stock analysis)..."
            className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={triggerResearch}
            disabled={triggering || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {triggering ? 'Queuing...' : 'Research'}
          </button>
        </div>
      </div>

      {/* Tab Switcher + Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/50">
          <button
            onClick={() => setActiveTab('reports')}
            className={`text-xs px-4 py-1.5 rounded-md transition-colors ${
              activeTab === 'reports' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Reports ({filtered.length}{hasActiveFilters ? `/${reports.length}` : ''})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`text-xs px-4 py-1.5 rounded-md transition-colors ${
              activeTab === 'timeline' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Timeline ({topics.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'reports' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-300 border border-slate-700/50'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
          )}
          <button onClick={() => downloadExport('/api/export/research?format=md', 'research.md')}
            className="px-2 py-1 text-[10px] rounded bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Export Markdown">
            MD
          </button>
        </div>
      </div>

      {/* Filters (collapsible) */}
      {showFilters && activeTab === 'reports' && (
        <FilterBar filters={filters} onChange={setFilters} />
      )}

      {/* Content: Reports or Timeline */}
      {activeTab === 'reports' ? (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              Research Reports
              {hasActiveFilters && (
                <span className="text-xs text-slate-500 ml-2">
                  ({filtered.length} of {reports.length})
                </span>
              )}
            </h3>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {hasActiveFilters
                ? 'No reports match the current filters.'
                : 'No research reports yet. The engine will generate reports automatically or use the input above.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {filtered.map(report => (
                <ReportItem
                  key={report.id}
                  report={report}
                  isExpanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h3 className="text-sm font-medium text-white">Research History</h3>
          </div>
          <HistoryTimeline topics={topics} />
        </div>
      )}
    </div>
  )
}
