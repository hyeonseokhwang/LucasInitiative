import { useState, useEffect } from 'react'
import { fetchJson } from '../lib/api'
import type { ResearchReport, ResearchEvidence } from '../types'

interface Props {
  researchUpdate?: any
  researchComplete?: any
}

export function ResearchPanel({ researchUpdate, researchComplete }: Props) {
  const [reports, setReports] = useState<ResearchReport[]>([])
  const [selected, setSelected] = useState<{ report: ResearchReport; evidence: ResearchEvidence[] } | null>(null)
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [triggering, setTriggering] = useState(false)

  // Load reports + status
  useEffect(() => {
    fetchJson<{ reports: ResearchReport[] }>('/api/research/reports').then(d => setReports(d.reports || []))
    fetchJson<{ engine: any }>('/api/research/status').then(d => setEngineStatus(d.engine))
  }, [])

  // Refresh on research complete
  useEffect(() => {
    if (researchComplete) {
      fetchJson<{ reports: ResearchReport[] }>('/api/research/reports').then(d => setReports(d.reports || []))
      fetchJson<{ engine: any }>('/api/research/status').then(d => setEngineStatus(d.engine))
    }
  }, [researchComplete])

  // Update engine status on research updates
  useEffect(() => {
    if (researchUpdate) {
      fetchJson<{ engine: any }>('/api/research/status').then(d => setEngineStatus(d.engine))
    }
  }, [researchUpdate])

  const openReport = async (report: ResearchReport) => {
    const data = await fetchJson<{ report: ResearchReport; evidence: ResearchEvidence[] }>(
      `/api/research/reports/${report.id}`
    )
    setSelected({ report: data.report, evidence: data.evidence || [] })
  }

  const triggerResearch = async () => {
    if (!query.trim()) return
    setTriggering(true)
    try {
      await fetchJson('/api/research/trigger?' + new URLSearchParams({ query: query.trim() }), { method: 'POST' })
      setQuery('')
    } catch {}
    setTriggering(false)
  }

  const confColor = (conf: number) =>
    conf >= 0.7 ? 'text-emerald-400' : conf >= 0.4 ? 'text-amber-400' : 'text-red-400'

  const confBg = (conf: number) =>
    conf >= 0.7 ? 'bg-emerald-500' : conf >= 0.4 ? 'bg-amber-500' : 'bg-red-500'

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

      {/* Reports List */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h3 className="text-sm font-medium text-white">Research Reports ({reports.length})</h3>
        </div>
        {reports.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No research reports yet. The engine will generate reports automatically or use the input above.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {reports.map(report => (
              <button
                key={report.id}
                onClick={() => openReport(report)}
                className="w-full px-4 py-3 flex items-center gap-4 hover:bg-slate-700/30 transition-colors text-left"
              >
                {/* Confidence Badge */}
                <div className={`w-10 h-10 rounded-lg ${confBg(report.confidence_avg)} bg-opacity-20 flex items-center justify-center shrink-0`}>
                  <span className={`text-sm font-bold ${confColor(report.confidence_avg)}`}>
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
                  <div className="text-xs text-slate-500">
                    {new Date(report.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {report.evidence_count} evidence | {report.contradictions} conflicts
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-700/50 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <h3 className="text-lg font-bold text-white truncate">{selected.report.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-sm font-medium ${confColor(selected.report.confidence_avg)}`}>
                      Confidence: {Math.round(selected.report.confidence_avg * 100)}%
                    </span>
                    <span className="text-xs text-slate-400">
                      Agreement: {Math.round(selected.report.agreement_rate * 100)}%
                    </span>
                    <span className="text-xs text-slate-400">
                      {selected.report.evidence_count} sources
                    </span>
                    {selected.report.contradictions > 0 && (
                      <span className="text-xs text-red-400">
                        {selected.report.contradictions} contradictions
                      </span>
                    )}
                  </div>
                  {/* Confidence Bar */}
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${confBg(selected.report.confidence_avg)}`}
                      style={{ width: `${selected.report.confidence_avg * 100}%` }}
                    />
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xl shrink-0">
                  x
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Summary */}
              <div className="px-5 py-4 bg-slate-900/30 border-b border-slate-700/30">
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{selected.report.summary}</p>
              </div>

              {/* Full Analysis */}
              <div className="px-5 py-4 border-b border-slate-700/30">
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Full Analysis</h4>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selected.report.full_analysis}
                </div>
              </div>

              {/* Evidence Chain */}
              <div className="px-5 py-4">
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                  Evidence Chain ({selected.evidence.length})
                </h4>
                <div className="space-y-2">
                  {selected.evidence.map((ev, i) => {
                    const hasConflict = ev.contradicts && JSON.parse(ev.contradicts || '[]').length > 0
                    return (
                      <div
                        key={ev.id || i}
                        className={`p-3 rounded-lg border ${
                          hasConflict
                            ? 'bg-red-500/5 border-red-500/20'
                            : ev.verified
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-slate-900/40 border-slate-700/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`text-xs font-mono mt-0.5 shrink-0 ${confColor(ev.confidence)}`}>
                            {Math.round(ev.confidence * 100)}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-300 break-words">{ev.claim}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500">{ev.source_type}</span>
                              {ev.verified ? (
                                <span className="text-xs text-emerald-400">Verified</span>
                              ) : null}
                              {hasConflict && (
                                <span className="text-xs text-red-400">Contradicted</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
