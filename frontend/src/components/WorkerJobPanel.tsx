import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocale } from '../hooks/useLocale'

const CC_BASE = 'http://localhost:9000'

interface WorkerSession {
  id: string
  name: string
  status: 'running' | 'idle' | 'error' | 'stopped'
  mission?: string
  pid?: number
  created_at?: string
}

interface WorkerReport {
  worker: string
  report: string
  timestamp: string
  file?: string
  needsUserDecision?: boolean
}

type ViewTab = 'live' | 'timeline'

const STATUS_STYLES: Record<string, { dot: string; bg: string; label: string; labelKo: string }> = {
  running: { dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]', bg: 'border-emerald-500/30', label: 'Running', labelKo: '작업중' },
  idle:    { dot: 'bg-slate-400', bg: 'border-slate-600/30', label: 'Idle', labelKo: '대기' },
  error:   { dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]', bg: 'border-red-500/30', label: 'Error', labelKo: '에러' },
  stopped: { dot: 'bg-slate-600', bg: 'border-slate-700/30', label: 'Stopped', labelKo: '중단' },
}

function timeAgo(ts: string, isKo: boolean): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return isKo ? '방금 전' : 'just now'
  if (mins < 60) return isKo ? `${mins}분 전` : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return isKo ? `${hours}시간 전` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return isKo ? `${days}일 전` : `${days}d ago`
}

export function WorkerJobPanel() {
  const { locale, t } = useLocale()
  const w = t.wj
  const isKo = locale === 'ko'

  const [sessions, setSessions] = useState<WorkerSession[]>([])
  const [reports, setReports] = useState<WorkerReport[]>([])
  const [loading, setLoading] = useState(true)
  const [viewTab, setViewTab] = useState<ViewTab>('live')
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null)
  const [newReportIds, setNewReportIds] = useState<Set<string>>(new Set())
  const prevReportCount = useRef(0)

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, repRes] = await Promise.allSettled([
        fetch(`${CC_BASE}/api/sessions`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
        fetch(`${CC_BASE}/api/reports`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      ])

      if (sessRes.status === 'fulfilled') {
        const data = sessRes.value
        const sessList: WorkerSession[] = Array.isArray(data) ? data :
          (data.sessions || Object.entries(data).map(([k, v]: [string, any]) => ({
            id: k, name: v.name || k, status: v.status || 'idle', mission: v.mission, pid: v.pid, created_at: v.created_at,
          })))
        setSessions(sessList)
      }

      if (repRes.status === 'fulfilled') {
        const data = repRes.value
        const repList: WorkerReport[] = Array.isArray(data) ? data :
          (data.reports || [])
        // Highlight new reports
        if (prevReportCount.current > 0 && repList.length > prevReportCount.current) {
          const newOnes = repList.slice(0, repList.length - prevReportCount.current)
          setNewReportIds(new Set(newOnes.map(r => r.file || r.timestamp)))
          setTimeout(() => setNewReportIds(new Set()), 3000)
        }
        prevReportCount.current = repList.length
        setReports(repList)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Group reports by worker
  const reportsByWorker = reports.reduce<Record<string, WorkerReport[]>>((acc, r) => {
    const key = r.worker || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  // Enrich sessions with latest report
  const enrichedSessions = sessions.map(s => {
    const workerReports = reportsByWorker[s.name] || reportsByWorker[s.id] || []
    const latestReport = workerReports[0] || null
    return { ...s, latestReport, reportCount: workerReports.length }
  })

  // All reports sorted by time (newest first)
  const sortedReports = [...reports].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const runningCount = sessions.filter(s => s.status === 'running').length
  const totalCount = sessions.length

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{w.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {runningCount}/{totalCount} {w.active} &middot; {reports.length} {w.totalReports}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              15s {w.polling}
            </div>
            {/* View tabs */}
            <div className="flex rounded-lg border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setViewTab('live')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewTab === 'live' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {w.liveView}
              </button>
              <button
                onClick={() => setViewTab('timeline')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewTab === 'timeline' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {w.timeline}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-28 rounded-lg bg-slate-700/30 animate-pulse" />
            ))}
          </div>
        ) : viewTab === 'live' ? (
          /* Live Worker Cards */
          <div className="space-y-4">
            {enrichedSessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">{w.noWorkers}</p>
                <p className="text-xs text-slate-600 mt-1">{w.noWorkersHint}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {enrichedSessions.map(session => {
                  const st = STATUS_STYLES[session.status] || STATUS_STYLES.idle
                  const isExpanded = expandedWorker === session.id
                  const workerReports = reportsByWorker[session.name] || reportsByWorker[session.id] || []

                  return (
                    <div
                      key={session.id}
                      className={`rounded-lg border ${st.bg} bg-slate-800/40 overflow-hidden transition-all ${
                        isExpanded ? 'ring-1 ring-blue-500/30' : ''
                      }`}
                    >
                      <button
                        className="w-full text-left p-3"
                        onClick={() => setExpandedWorker(isExpanded ? null : session.id)}
                      >
                        {/* Worker name + status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
                            <span className="text-sm font-bold text-white">{session.name || session.id}</span>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            session.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' :
                            session.status === 'error' ? 'bg-red-500/15 text-red-400' :
                            'bg-slate-500/15 text-slate-400'
                          }`}>
                            {isKo ? st.labelKo : st.label}
                          </span>
                        </div>

                        {/* Current task / mission */}
                        {session.mission && (
                          <p className="text-xs text-slate-300 line-clamp-2 mb-2">{session.mission}</p>
                        )}

                        {/* Latest report summary */}
                        {session.latestReport && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 mb-1">
                            {session.latestReport.report?.slice(0, 100)}
                          </div>
                        )}

                        {/* Footer: report count + last time */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>{session.reportCount} {w.reports}</span>
                          {session.latestReport?.timestamp && (
                            <span>{timeAgo(session.latestReport.timestamp, isKo)}</span>
                          )}
                        </div>
                      </button>

                      {/* Expanded: recent reports */}
                      {isExpanded && workerReports.length > 0 && (
                        <div className="border-t border-slate-700/40 p-3 bg-slate-900/20 space-y-2 max-h-60 overflow-y-auto">
                          <div className="text-[10px] text-slate-500 font-medium mb-1">{w.recentReports}</div>
                          {workerReports.slice(0, 10).map((r, i) => {
                            const isNew = newReportIds.has(r.file || r.timestamp)
                            return (
                              <div
                                key={i}
                                className={`rounded-md p-2 text-xs transition-all ${
                                  isNew ? 'bg-blue-500/10 border border-blue-500/30 ring-1 ring-blue-500/20' :
                                  'bg-slate-800/40 border border-slate-700/30'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-slate-500">
                                    {r.timestamp ? new Date(r.timestamp).toLocaleString(isKo ? 'ko-KR' : 'en-US', {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                    }) : ''}
                                  </span>
                                  {r.needsUserDecision && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">
                                      {w.needsDecision}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-300 leading-relaxed">{r.report}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Timeline View */
          <div className="space-y-1">
            {sortedReports.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">{w.noReports}</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/50" />

                {sortedReports.slice(0, 50).map((report, i) => {
                  const isNew = newReportIds.has(report.file || report.timestamp)
                  const workerStyle = STATUS_STYLES[
                    sessions.find(s => s.name === report.worker || s.id === report.worker)?.status || 'idle'
                  ] || STATUS_STYLES.idle

                  return (
                    <div key={i} className="relative pl-10 pb-4">
                      {/* Timeline dot */}
                      <div className={`absolute left-[11px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${
                        isNew ? 'bg-blue-400 ring-2 ring-blue-400/30' : workerStyle.dot
                      }`} />

                      <div className={`rounded-lg p-3 transition-all ${
                        isNew ? 'bg-blue-500/10 border border-blue-500/30' :
                        'bg-slate-800/40 border border-slate-700/30'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{report.worker}</span>
                            {report.needsUserDecision && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">
                                {w.needsDecision}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {report.timestamp ? timeAgo(report.timestamp, isKo) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {report.report?.slice(0, 200)}{(report.report?.length || 0) > 200 ? '...' : ''}
                        </p>
                        <div className="text-[10px] text-slate-600 mt-1">
                          {report.timestamp ? new Date(report.timestamp).toLocaleString(isKo ? 'ko-KR' : 'en-US') : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
