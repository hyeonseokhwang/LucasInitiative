import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useLocale } from '../hooks/useLocale'

interface DailyReport {
  id: number
  report_type: string
  title: string
  content: string
  created_at: string
}

/** Lightweight markdown → HTML (headings, bold, italic, lists, hr, code blocks, links) */
function renderMarkdown(md: string): string {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-900/80 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-200 mt-4 mb-1">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-slate-100 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-6 mb-3">$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-slate-700/50 my-4" />')
    // Bold & Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:underline">$1</a>')
    // Line breaks (double newlines → paragraph, single → br)
    .replace(/\n\n/g, '</p><p class="text-sm text-slate-300 leading-relaxed mb-2">')
    .replace(/\n/g, '<br />')

  return `<p class="text-sm text-slate-300 leading-relaxed mb-2">${html}</p>`
}

export function DailyReportPanel() {
  const { t } = useLocale()
  const d = t.dr

  const [reports, setReports] = useState<DailyReport[]>([])
  const [selected, setSelected] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.dailyReports(30)
      setReports(data.reports || [])
    } catch { setReports([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadReports() }, [loadReports])

  // Group reports by date
  const groupedByDate = reports.reduce<Record<string, DailyReport[]>>((acc, r) => {
    const date = r.created_at?.slice(0, 10) || 'unknown'
    if (!acc[date]) acc[date] = []
    acc[date].push(r)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedByDate).sort().reverse()

  const getTypeColor = (type: string) => {
    if (type === 'combined') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (type === 'stock') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (type === 'realestate') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  const getTypeLabel = (type: string) => {
    if (type === 'combined') return d.combined
    if (type === 'stock') return d.stock
    if (type === 'realestate') return d.realestate
    return type
  }

  if (selected) {
    return (
      <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-3">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/50
              hover:bg-slate-700 transition-colors"
          >
            &larr; {d.back}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{selected.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getTypeColor(selected.report_type)}`}>
                {getTypeLabel(selected.report_type)}
              </span>
              <span className="text-xs text-slate-500">{selected.created_at?.replace('T', ' ').slice(0, 19)}</span>
            </div>
          </div>
        </div>

        {/* Report content (rendered markdown) */}
        <div className="flex-1 overflow-y-auto p-5">
          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content || '') }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">{d.title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{reports.length} reports</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            {d.loadingReport}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <p className="text-sm">{d.noReports}</p>
            <p className="text-xs mt-1">{d.noReportsHint}</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                <div className="text-xs text-slate-500 font-medium mb-2 sticky top-0 bg-slate-800/80 py-1">
                  {date}
                  <span className="ml-2 text-slate-600">({groupedByDate[date].length})</span>
                </div>

                <div className="space-y-2">
                  {groupedByDate[date].map(report => (
                    <button
                      key={report.id}
                      onClick={() => setSelected(report)}
                      className="w-full text-left rounded-lg border border-slate-700/50 p-3 hover:bg-slate-700/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getTypeColor(report.report_type)}`}>
                          {getTypeLabel(report.report_type)}
                        </span>
                        <span className="text-sm font-medium text-white truncate flex-1">{report.title}</span>
                        <span className="text-xs text-slate-500 group-hover:text-slate-400 shrink-0">&rarr;</span>
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {(report.content || '').replace(/^#.*$/gm, '').replace(/[*_`]/g, '').trim().slice(0, 150)}...
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1">
                        {report.created_at?.replace('T', ' ').slice(0, 19)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
