import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '../lib/api'
import { useLocale } from '../hooks/useLocale'

interface InputEntry {
  id: string
  filename: string
  timestamp: string
  title: string
  body: string
  type: 'command' | 'instruct' | 'report' | 'other'
  category: string
  worker: string
  status: string
  needs_decision: boolean
}

interface InputStats {
  total: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  today_count: number
}

interface InputDetail {
  id: string
  filename: string
  timestamp: string
  title: string
  body: string
  raw_content: string
  type: string
  category: string
  worker: string
  status: string
  needs_decision: boolean
}

const TYPE_LABELS: Record<string, { ko: string; en: string; color: string }> = {
  command: { ko: 'Lucas 입력', en: 'Lucas Input', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  instruct: { ko: '지시', en: 'Instruction', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  report: { ko: '보고', en: 'Report', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  other: { ko: '기타', en: 'Other', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

const STATUS_LABELS: Record<string, { ko: string; en: string; color: string }> = {
  completed: { ko: '완료', en: 'Done', color: 'bg-emerald-500/20 text-emerald-400' },
  in_progress: { ko: '진행중', en: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400' },
  pending: { ko: '대기', en: 'Pending', color: 'bg-slate-500/20 text-slate-400' },
  blocked: { ko: '블록', en: 'Blocked', color: 'bg-red-500/20 text-red-400' },
  needs_decision: { ko: '결정 필요', en: 'Needs Decision', color: 'bg-orange-500/20 text-orange-400' },
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return ts }
}

function formatFullTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return ts }
}

export function InputHistoryPanel() {
  const { locale } = useLocale()
  const isKo = locale === 'ko'

  const [entries, setEntries] = useState<InputEntry[]>([])
  const [stats, setStats] = useState<InputStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('')

  // Detail view
  const [selectedEntry, setSelectedEntry] = useState<InputDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Tab
  const [tab, setTab] = useState<'timeline' | 'stats'>('timeline')

  const PAGE_SIZE = 50

  const loadEntries = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(newOffset),
      })
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFilter) params.set('date', dateFilter)

      const data = await fetchJson<{ entries: InputEntry[]; total: number; has_more: boolean }>(
        `/api/inputhistory?${params}`
      )
      if (newOffset === 0) {
        setEntries(data.entries)
      } else {
        setEntries(prev => [...prev, ...data.entries])
      }
      setTotal(data.total)
      setHasMore(data.has_more)
      setOffset(newOffset)
    } catch {
      if (newOffset === 0) setEntries([])
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter, dateFilter])

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchJson<InputStats>('/api/inputhistory/stats')
      setStats(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadEntries(0)
    loadStats()
  }, [loadEntries, loadStats])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const data = await fetchJson<InputDetail>(`/api/inputhistory/${encodeURIComponent(id)}`)
      setSelectedEntry(data)
    } catch { /* ignore */ }
    finally { setDetailLoading(false) }
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setOffset(0)
  }

  const clearFilters = () => {
    setSearch('')
    setSearchInput('')
    setTypeFilter('')
    setStatusFilter('')
    setDateFilter('')
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">
            {isKo ? '입력 내역' : 'Input History'}
          </h2>
          {stats && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{isKo ? '전체' : 'Total'}: <b className="text-white">{stats.total}</b></span>
              <span>{isKo ? '오늘' : 'Today'}: <b className="text-blue-400">{stats.today_count}</b></span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {(['timeline', 'stats'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              {t === 'timeline' ? (isKo ? '타임라인' : 'Timeline') : (isKo ? '통계' : 'Stats')}
            </button>
          ))}
        </div>

        {/* Filters - only show on timeline tab */}
        {tab === 'timeline' && (
          <div className="flex flex-wrap gap-2">
            {/* Search */}
            <div className="flex gap-1 flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={isKo ? '검색...' : 'Search...'}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded-md
                  text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleSearch}
                className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md
                  hover:bg-blue-600/30 transition-colors"
              >
                {isKo ? '검색' : 'Search'}
              </button>
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded-md text-slate-300
                focus:outline-none focus:border-blue-500/50"
            >
              <option value="">{isKo ? '유형 전체' : 'All Types'}</option>
              <option value="command">{isKo ? 'Lucas 입력' : 'Lucas Input'}</option>
              <option value="instruct">{isKo ? '지시' : 'Instruction'}</option>
              <option value="report">{isKo ? '보고' : 'Report'}</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded-md text-slate-300
                focus:outline-none focus:border-blue-500/50"
            >
              <option value="">{isKo ? '상태 전체' : 'All Status'}</option>
              <option value="completed">{isKo ? '완료' : 'Done'}</option>
              <option value="in_progress">{isKo ? '진행중' : 'In Progress'}</option>
              <option value="pending">{isKo ? '대기' : 'Pending'}</option>
              <option value="needs_decision">{isKo ? '결정 필요' : 'Needs Decision'}</option>
              <option value="blocked">{isKo ? '블록' : 'Blocked'}</option>
            </select>

            {/* Date filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded-md text-slate-300
                focus:outline-none focus:border-blue-500/50"
            />

            {/* Clear */}
            {(search || typeFilter || statusFilter || dateFilter) && (
              <button
                onClick={clearFilters}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                {isKo ? '초기화' : 'Clear'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {tab === 'timeline' && (
          <>
            {/* Entry list */}
            <div className={`flex-1 overflow-y-auto ${selectedEntry ? 'hidden lg:block lg:w-1/2 lg:border-r lg:border-slate-700/50' : ''}`}>
              {loading && entries.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                  {isKo ? '로딩 중...' : 'Loading...'}
                </div>
              ) : entries.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                  {isKo ? '내역이 없습니다' : 'No entries found'}
                </div>
              ) : (
                <div className="divide-y divide-slate-700/30">
                  {entries.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => openDetail(entry.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-700/20 transition-colors ${
                        selectedEntry?.id === entry.id ? 'bg-slate-700/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type badge */}
                        <span className={`shrink-0 mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded border ${
                          TYPE_LABELS[entry.type]?.color || TYPE_LABELS.other.color
                        }`}>
                          {isKo
                            ? TYPE_LABELS[entry.type]?.ko || '기타'
                            : TYPE_LABELS[entry.type]?.en || 'Other'
                          }
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white truncate">
                              {entry.title}
                            </span>
                            {entry.needs_decision && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10px] bg-orange-500/20 text-orange-400 rounded">
                                {isKo ? '결정 필요' : 'Decision'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{formatTime(entry.timestamp)}</span>
                            {entry.worker && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="text-slate-400">{entry.worker}</span>
                              </>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              STATUS_LABELS[entry.status]?.color || 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {isKo
                                ? STATUS_LABELS[entry.status]?.ko || entry.status
                                : STATUS_LABELS[entry.status]?.en || entry.status
                              }
                            </span>
                          </div>

                          {entry.body && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {entry.body.slice(0, 120)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Load more */}
                  {hasMore && (
                    <div className="px-4 py-3 text-center">
                      <button
                        onClick={() => loadEntries(offset + PAGE_SIZE)}
                        disabled={loading}
                        className="px-4 py-1.5 text-xs bg-slate-700/50 text-slate-300 rounded-md
                          hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        {loading
                          ? (isKo ? '로딩 중...' : 'Loading...')
                          : (isKo ? `더 보기 (${total - entries.length}건 남음)` : `Load more (${total - entries.length} remaining)`)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Result count */}
              {entries.length > 0 && (
                <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700/30">
                  {isKo
                    ? `${total}건 중 ${entries.length}건 표시`
                    : `Showing ${entries.length} of ${total}`}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selectedEntry && (
              <div className="flex-1 overflow-y-auto lg:w-1/2">
                <div className="p-4">
                  {/* Back button (mobile) */}
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="lg:hidden mb-3 text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    {isKo ? '목록으로' : 'Back to list'}
                  </button>

                  {detailLoading ? (
                    <div className="text-slate-500 text-sm">{isKo ? '로딩 중...' : 'Loading...'}</div>
                  ) : (
                    <>
                      {/* Detail header */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${
                            TYPE_LABELS[selectedEntry.type]?.color || TYPE_LABELS.other.color
                          }`}>
                            {isKo
                              ? TYPE_LABELS[selectedEntry.type]?.ko || '기타'
                              : TYPE_LABELS[selectedEntry.type]?.en || 'Other'}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                            STATUS_LABELS[selectedEntry.status]?.color || 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {isKo
                              ? STATUS_LABELS[selectedEntry.status]?.ko || selectedEntry.status
                              : STATUS_LABELS[selectedEntry.status]?.en || selectedEntry.status}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{selectedEntry.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatFullTime(selectedEntry.timestamp)}</span>
                          {selectedEntry.worker && <span>{selectedEntry.worker}</span>}
                          <span className="text-slate-600">{selectedEntry.filename}</span>
                        </div>
                      </div>

                      {/* Detail body */}
                      <div className="bg-slate-900/50 rounded-lg border border-slate-700/30 p-4">
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed font-sans">
                          {selectedEntry.body || selectedEntry.raw_content}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Stats tab */}
        {tab === 'stats' && stats && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard
                label={isKo ? '전체 항목' : 'Total Items'}
                value={stats.total}
                color="text-white"
              />
              <StatCard
                label={isKo ? '오늘 항목' : 'Today'}
                value={stats.today_count}
                color="text-blue-400"
              />
              <StatCard
                label={isKo ? 'Lucas 입력' : 'Lucas Input'}
                value={stats.by_type.command || 0}
                color="text-blue-400"
              />
              <StatCard
                label={isKo ? '지시' : 'Instructions'}
                value={stats.by_type.instruct || 0}
                color="text-purple-400"
              />
            </div>

            {/* Type breakdown */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">
                {isKo ? '유형별 분포' : 'By Type'}
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded border ${
                      TYPE_LABELS[type]?.color || TYPE_LABELS.other.color
                    }`}>
                      {isKo ? TYPE_LABELS[type]?.ko || type : TYPE_LABELS[type]?.en || type}
                    </span>
                    <div className="flex-1 bg-slate-700/30 rounded-full h-2">
                      <div
                        className="bg-blue-500/60 rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(100, (count / stats.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                {isKo ? '상태별 분포' : 'By Status'}
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      STATUS_LABELS[status]?.color || 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {isKo ? STATUS_LABELS[status]?.ko || status : STATUS_LABELS[status]?.en || status}
                    </span>
                    <div className="flex-1 bg-slate-700/30 rounded-full h-2">
                      <div
                        className="bg-emerald-500/60 rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(100, (count / stats.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700/30 p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}
