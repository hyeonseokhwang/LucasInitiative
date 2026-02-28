import { useState, useEffect } from 'react'
import { fetchJson } from '../lib/api'

interface Report {
  id: number
  report_type: string
  title: string
  content: string
  created_at: string
}

interface SchedulerJob {
  name: string
  interval_hours: number
  enabled: boolean
  running: boolean
  last_run: string | null
}

export function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([])
  const [jobs, setJobs] = useState<SchedulerJob[]>([])
  const [generating, setGenerating] = useState('')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  const load = () => {
    fetchJson<{ reports: Report[] }>('/api/reports/history?limit=20').then(d => setReports(d.reports || []))
    fetchJson<{ jobs: SchedulerJob[] }>('/api/reports/scheduler').then(d => setJobs(d.jobs || []))
  }

  useEffect(() => { load() }, [])

  const generate = async (type: string) => {
    setGenerating(type)
    try {
      if (type === 'daily') await fetchJson('/api/reports/daily', { method: 'POST' })
      else if (type === 'stock') await fetchJson('/api/reports/stocks/report', { method: 'POST' })
      else if (type === 'realestate') await fetchJson('/api/reports/realestate/report', { method: 'POST' })
      load()
    } finally {
      setGenerating('')
    }
  }

  const typeColors: Record<string, string> = {
    stock: 'text-green-400 bg-green-400/10',
    realestate: 'text-blue-400 bg-blue-400/10',
    combined: 'text-amber-400 bg-amber-400/10',
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-medium">Reports</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generate('stock')} disabled={!!generating}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50 transition">
            {generating === 'stock' ? 'Loading...' : 'Stock Report'}
          </button>
          <button onClick={() => generate('realestate')} disabled={!!generating}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50 transition">
            {generating === 'realestate' ? 'Loading...' : 'Real Estate'}
          </button>
          <button onClick={() => generate('daily')} disabled={!!generating}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50 transition">
            {generating === 'daily' ? 'Loading...' : 'Daily Report'}
          </button>
        </div>
      </div>

      {/* Scheduler Status */}
      {jobs.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-700/30 text-xs text-slate-400">
          {jobs.map(j => (
            <div key={j.name} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${j.running ? 'bg-amber-400 animate-pulse' : j.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span>{j.name}</span>
              <span className="text-slate-500">every {j.interval_hours}h</span>
              {j.last_run && <span className="text-slate-500">last: {new Date(j.last_run).toLocaleString('ko-KR')}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedReport ? (
          <div className="p-4">
            <button onClick={() => setSelectedReport(null)}
              className="text-xs text-slate-400 hover:text-white mb-3 flex items-center gap-1">
              &lt; Back to list
            </button>
            <h3 className="text-white font-medium mb-1">{selectedReport.title}</h3>
            <div className="text-xs text-slate-500 mb-3">
              {new Date(selectedReport.created_at).toLocaleString('ko-KR')}
            </div>
            <div className="whitespace-pre-wrap text-sm text-slate-300 bg-slate-900/50 rounded-lg p-4 font-mono leading-relaxed">
              {selectedReport.content}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {reports.length === 0 && (
              <div className="text-center text-slate-500 mt-10">
                <p className="text-sm">No reports yet</p>
                <p className="text-xs mt-1">Generate one or wait for the daily schedule</p>
              </div>
            )}
            {reports.map(r => (
              <button key={r.id} onClick={() => setSelectedReport(r)}
                className="w-full text-left p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[r.report_type] || 'text-slate-400 bg-slate-600/30'}`}>
                    {r.report_type}
                  </span>
                  <span className="text-white text-sm font-medium truncate">{r.title}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(r.created_at).toLocaleString('ko-KR')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
