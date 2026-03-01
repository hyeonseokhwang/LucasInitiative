import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { CHART_COLORS } from '../lib/chartTheme'
import { useLocale } from '../hooks/useLocale'
import { formatNumber, formatCurrency } from '../lib/i18n'
import type { SystemSnapshot } from '../types'

interface Props {
  metrics: SystemSnapshot | null
  onNavigate: (view: string) => void
}

// Mini circular gauge
function MiniGauge({ percent, label, color }: { percent: number; label: string; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(percent, 100) / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-700" />
        <circle
          cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
          className="transition-all duration-700"
        />
        <text x="34" y="34" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="14" fontWeight="bold">
          {Math.round(percent)}%
        </text>
      </svg>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

function SectionCard({
  title, color, onClick, children,
}: {
  title: string; color: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 text-left w-full
        hover:border-${color}-500/50 hover:bg-slate-800/80 transition-all group cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">&rarr;</span>
      </div>
      {children}
    </button>
  )
}

// Service definitions for health checks
const SERVICES = [
  { name: 'Command Center', port: 9000, url: 'http://localhost:9000/api/health', key: 'cc' },
  { name: 'Dashboard', port: 7777, url: 'http://localhost:7777/api/health', key: 'dashboard' },
  { name: 'Scheduler', port: 7778, url: 'http://localhost:7778/api/health', key: 'scheduler' },
  { name: 'NPC Engine', port: 8889, url: 'http://localhost:8889/health', key: 'npc' },
  { name: 'Village', port: 8888, url: 'http://localhost:8888/health', key: 'village' },
  { name: 'Video Localizer', port: 8080, url: 'http://localhost:8080/health', key: 'video' },
  { name: 'Mobile', port: 3004, url: 'http://localhost:3004/health', key: 'mobile' },
]

const QUICK_LINKS = [
  { name: 'Command Center', desc: 'Worker orchestration', url: 'http://localhost:9000', icon: '🎯', color: 'blue' },
  { name: 'Dashboard', desc: 'System monitoring', url: 'http://localhost:7777', icon: '📊', color: 'emerald' },
  { name: 'Scheduler', desc: 'Voice assistant + calendar', url: 'http://localhost:7778', icon: '📅', color: 'amber' },
  { name: 'NPC Village', desc: 'LLM simulation', url: 'http://localhost:8888', icon: '🏘️', color: 'cyan' },
  { name: 'Video Localizer', desc: 'Translate & dub', url: 'http://localhost:8080', icon: '🎬', color: 'red' },
  { name: 'Mobile Commander', desc: 'Mobile control', url: 'http://localhost:3004', icon: '📱', color: 'slate' },
]

export function HomeOverview({ metrics, onNavigate }: Props) {
  const { locale, t } = useLocale()
  const h = t.home
  const c = t.challenge
  const [indices, setIndices] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any>(null)
  const [watchlist, setWatchlist] = useState<any[]>([])
  const [recentDeals, setRecentDeals] = useState<any[]>([])
  const [research, setResearch] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({})
  const [todayReports, setTodayReports] = useState(0)
  const [signalCount, setSignalCount] = useState(0)
  const [activeWorkers, setActiveWorkers] = useState(0)
  const [recentReports, setRecentReports] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [notiOpen, setNotiOpen] = useState(false)
  const notiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.allSettled([
      api.indices().then(r => setIndices(r.indices || [])),
      api.portfolio().then(r => setPortfolio(r)),
      api.reWatchlist().then(r => setWatchlist(r.watchlist || [])),
      api.reDeals(undefined, undefined, 3).then(r => setRecentDeals(r.deals || [])),
      api.researchReports(3).then(r => setResearch(r.reports || [])),
      api.usage().then(r => setUsage(r)),
      api.challenges().then(r => setChallenges(Array.isArray(r) ? r : (r?.challenges || []))),
      api.signals(50).then(r => setSignalCount(r.count || r.signals?.length || 0)),
    ]).finally(() => setLoading(false))

    // Health checks for all services
    const today = new Date().toISOString().slice(0, 10)
    SERVICES.forEach(svc => {
      fetch(svc.url, { signal: AbortSignal.timeout(3000) })
        .then(r => { setServiceStatus(prev => ({ ...prev, [svc.key]: r.ok })) })
        .catch(() => { setServiceStatus(prev => ({ ...prev, [svc.key]: false })) })
    })

    // Today's worker reports count from CC
    fetch('http://localhost:9000/api/reports?today=true', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => setTodayReports(data.count || data.reports?.length || 0))
      .catch(() => {})

    // Active workers from CC sessions
    fetch('http://localhost:9000/api/sessions', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        const sessions = Array.isArray(data) ? data : (data.sessions || [])
        setActiveWorkers(sessions.filter((s: any) => s.status === 'running').length)
      })
      .catch(() => {})

    // Recent 5 reports from CC
    fetch('http://localhost:9000/api/reports', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        const reports = Array.isArray(data) ? data : (data.reports || [])
        setRecentReports(reports.slice(0, 5))
      })
      .catch(() => {})
  }, [])

  // Build notifications from collected data
  useEffect(() => {
    const items: any[] = []

    // 1. Worker reports needing user decision
    fetch('http://localhost:9000/api/reports', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        const reports = Array.isArray(data) ? data : (data.reports || [])
        reports.forEach((rpt: any) => {
          if (rpt.needsUserDecision) {
            items.push({
              type: 'decision',
              title: locale === 'ko' ? '유저 판단 필요' : 'Decision Required',
              message: `[${rpt.worker}] ${(rpt.report || rpt.message || '').slice(0, 60)}`,
              time: rpt.timestamp || rpt.created_at,
            })
          }
        })

        // 2. Service down alerts (from already-fetched serviceStatus)
        SERVICES.forEach(svc => {
          if (serviceStatus[svc.key] === false) {
            items.push({
              type: 'down',
              title: locale === 'ko' ? '서비스 다운' : 'Service Down',
              message: `${svc.name} (:${svc.port})`,
              time: new Date().toISOString(),
            })
          }
        })

        // 3. Challenge milestone deadline alerts (within 7 days)
        challenges.forEach((ch: any) => {
          const dDay = ch.progress?.d_day ?? null
          if (typeof dDay === 'number' && dDay <= 7 && dDay >= 0 && ch.status !== 'completed') {
            items.push({
              type: 'deadline',
              title: locale === 'ko' ? '마감 임박' : 'Deadline Soon',
              message: `${ch.title} — D-${dDay}`,
              time: ch.deadline || ch.end_date,
            })
          }
        })

        setNotifications(items)
      })
      .catch(() => {
        // Still add service down + deadline alerts even if reports fetch fails
        const fallback: any[] = []
        SERVICES.forEach(svc => {
          if (serviceStatus[svc.key] === false) {
            fallback.push({ type: 'down', title: locale === 'ko' ? '서비스 다운' : 'Service Down', message: `${svc.name} (:${svc.port})`, time: new Date().toISOString() })
          }
        })
        challenges.forEach((ch: any) => {
          const dDay = ch.progress?.d_day ?? null
          if (typeof dDay === 'number' && dDay <= 7 && dDay >= 0 && ch.status !== 'completed') {
            fallback.push({ type: 'deadline', title: locale === 'ko' ? '마감 임박' : 'Deadline Soon', message: `${ch.title} — D-${dDay}`, time: ch.deadline || ch.end_date })
          }
        })
        setNotifications(fallback)
      })
  }, [serviceStatus, challenges, locale])

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setNotiOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const vramPercent = metrics && metrics.gpu.mem_total_mb > 0
    ? (metrics.gpu.mem_used_mb / metrics.gpu.mem_total_mb) * 100 : 0

  const notiLabel = locale === 'ko' ? '알림' : 'Notifications'
  const notiEmpty = locale === 'ko' ? '새 알림이 없습니다' : 'No new notifications'
  const notiTypeIcon: Record<string, string> = { decision: '!', down: 'x', deadline: 'D' }
  const notiTypeColor: Record<string, string> = {
    decision: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    down: 'bg-red-500/20 text-red-400 border-red-500/30',
    deadline: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  return (
    <div className="space-y-6">
      {/* Notification Bell */}
      <div className="flex items-center justify-end" ref={notiRef}>
        <div className="relative">
          <button
            onClick={() => setNotiOpen(prev => !prev)}
            className="relative p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
            aria-label={notiLabel}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {notiOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-50">
              <div className="px-4 py-3 border-b border-slate-700/50">
                <span className="text-sm font-semibold text-white">{notiLabel}</span>
                <span className="ml-2 text-xs text-slate-500">({notifications.length})</span>
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-500">{notiEmpty}</div>
              ) : (
                <div className="divide-y divide-slate-700/30">
                  {notifications.map((n, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-slate-700/20 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border ${notiTypeColor[n.type] || notiTypeColor.decision}`}>
                          {notiTypeIcon[n.type] || '?'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{n.title}</div>
                          <div className="text-xs text-slate-200 leading-relaxed">{n.message}</div>
                          {n.time && (
                            <div className="text-[10px] text-slate-600 mt-1">
                              {new Date(n.time).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div
        onClick={() => onNavigate('dashboard')}
        className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 cursor-pointer
          hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">{h.systemStatus}</h3>
          <span className="text-xs text-slate-500 group-hover:text-slate-400">{h.dashboard} &rarr;</span>
        </div>
        {metrics ? (
          <div className="flex items-center justify-around flex-wrap gap-3">
            <MiniGauge percent={metrics.cpu.percent} label="CPU" color={CHART_COLORS.cpu} />
            <MiniGauge percent={metrics.gpu.util_percent} label="GPU" color={CHART_COLORS.gpu} />
            <MiniGauge percent={metrics.ram.percent} label="RAM" color={CHART_COLORS.ram} />
            <MiniGauge percent={vramPercent} label="VRAM" color={CHART_COLORS.vram} />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-lg font-bold text-white">{metrics.gpu.temp_c}°C</span>
              <span className="text-xs text-slate-400">{h.gpuTemp}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className={`text-lg font-bold ${metrics.ollama?.running ? 'text-emerald-400' : 'text-slate-500'}`}>
                {metrics.ollama?.running ? 'ON' : 'OFF'}
              </span>
              <span className="text-xs text-slate-400">Ollama</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 justify-around">
            {[1,2,3,4].map(i => <div key={i} className="w-16 h-16 rounded-full bg-slate-700/50 animate-pulse" />)}
          </div>
        )}
      </div>

      {/* Service Status */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">{h.serviceStatus}</h3>
          <span className="text-xs text-slate-500">
            {Object.values(serviceStatus).filter(Boolean).length}/{SERVICES.length} {h.online}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {SERVICES.map(svc => {
            const isUp = serviceStatus[svc.key] === true
            const isPending = serviceStatus[svc.key] === undefined
            return (
              <div key={svc.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/20 border border-slate-700/40">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isPending ? 'bg-slate-500 animate-pulse' :
                  isUp ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' :
                  'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                }`} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{svc.name}</div>
                  <div className="text-[10px] text-slate-500">:{svc.port}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Commander Status + Recent Decisions */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-300">{h.commanderStatus}</h3>
            {serviceStatus['cc'] === undefined ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/50 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                ...
              </span>
            ) : serviceStatus['cc'] ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                {h.online}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
                {h.offline}
              </span>
            )}
          </div>
          <span className="text-xs text-blue-400 font-mono">{activeWorkers} {h.activeWorkers}</span>
        </div>

        {/* Recent 5 Decision Logs */}
        <div>
          <div className="text-xs text-slate-400 mb-2">{h.recentDecisions}</div>
          {recentReports.length > 0 ? (
            <div className="space-y-2">
              {recentReports.map((rpt: any, i: number) => {
                const ts = rpt.timestamp || rpt.created_at || ''
                const timeStr = ts ? new Date(ts).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''
                const worker = rpt.worker || rpt.from || 'unknown'
                const content = rpt.report || rpt.message || rpt.content || ''
                const summary = content.length > 80 ? content.slice(0, 80) + '...' : content
                return (
                  <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-700/20 border border-slate-700/40">
                    <div className="shrink-0 mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        i === 0 ? 'bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.5)]' : 'bg-slate-600'
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-slate-500">{timeStr}</span>
                        <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">{worker}</span>
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed">{summary}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-3 text-center">{h.noDecisions}</div>
          )}
        </div>
      </div>

      {/* Today's Activity Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg">
            📋
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{todayReports}</div>
            <div className="text-xs text-slate-400">{h.workerReports}</div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
            ⚡
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{signalCount}</div>
            <div className="text-xs text-slate-400">{h.signalsDetected}</div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
            ✅
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {Object.values(serviceStatus).filter(Boolean).length}
              <span className="text-sm font-normal text-slate-500">/{SERVICES.length}</span>
            </div>
            <div className="text-xs text-slate-400">{h.online}</div>
          </div>
        </div>
      </div>

      {/* Challenge Widget */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">{c.title}</h3>
          {challenges.length > 0 && (
            <span className="text-xs text-emerald-400 font-mono">
              {challenges.filter((ch: any) => ch.status === 'active').length} {c.active}
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex gap-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-slate-700/30 animate-pulse flex-1" />)}
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-slate-500">{c.noChallenges}</p>
            <p className="text-[10px] text-slate-600 mt-1">{c.noChallengesHint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {challenges.slice(0, 6).map((ch: any) => {
              const pct = ch.progress?.percentage ?? (ch.target_amount > 0 ? Math.round((ch.current_amount / ch.target_amount) * 100) : 0)
              const dDay = ch.progress?.d_day ?? ''
              const msDone = ch.progress?.milestones_done ?? 0
              const msTotal = ch.progress?.milestones_total ?? (ch.milestones?.length ?? 0)
              const isComplete = ch.status === 'completed' || pct >= 100

              return (
                <div
                  key={ch.id}
                  className={`rounded-lg border p-3 ${
                    isComplete
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-slate-700/20 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-white truncate flex-1">{ch.title}</span>
                    {dDay && (
                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        typeof dDay === 'number' && dDay <= 7
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {typeof dDay === 'number' ? `D-${dDay}` : dDay}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400">{c.progress}</span>
                      <span className={`font-mono font-bold ${isComplete ? 'text-emerald-400' : 'text-white'}`}>
                        {Math.min(pct, 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isComplete ? 'bg-emerald-500' :
                          pct >= 70 ? 'bg-blue-500' :
                          pct >= 30 ? 'bg-amber-500' : 'bg-slate-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones + Amount */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">
                      {c.milestones}: {msDone}/{msTotal}
                    </span>
                    {ch.target_amount > 0 && (
                      <span className="text-slate-400 font-mono">
                        {Number(ch.current_amount || 0).toLocaleString()} / {Number(ch.target_amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock Summary */}
        <SectionCard title={h.stocksPortfolio} color="blue" onClick={() => onNavigate('stocks')}>
          {/* Indices */}
          {indices.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {indices.slice(0, 4).map((idx: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate mr-2">{idx.name || idx.symbol}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-mono">{Number(idx.price || 0).toLocaleString()}</span>
                    <span className={`font-mono ${(idx.change_pct || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {(idx.change_pct || 0) >= 0 ? '+' : ''}{Number(idx.change_pct || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mb-3">{h.loadingIndices}</div>
          )}
          {/* Portfolio Summary */}
          {portfolio && portfolio.holdings?.length > 0 ? (
            <div className="border-t border-slate-700/50 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Portfolio ({portfolio.holdings.length} stocks)</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono">
                    {Math.round(portfolio.total_value || 0).toLocaleString()}
                  </span>
                  <span className={`font-mono font-semibold ${(portfolio.total_pnl || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {(portfolio.total_pnl || 0) >= 0 ? '+' : ''}{Number(portfolio.total_pnl_pct || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-700/50 pt-2 text-xs text-slate-500">{h.noPortfolioData}</div>
          )}
        </SectionCard>

        {/* Real Estate Summary */}
        <SectionCard title={h.realEstate} color="emerald" onClick={() => onNavigate('realestate')}>
          {/* Watchlist */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400">{h.watchlist}</span>
              <span className="text-emerald-400 font-mono">{watchlist.length} items</span>
            </div>
            {watchlist.length > 0 ? (
              <div className="space-y-1">
                {watchlist.slice(0, 2).map((w: any) => (
                  <div key={w.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate mr-2">
                      {w.apt_name || w.dong || w.district}
                    </span>
                    <div className="flex items-center gap-2">
                      {w.recent_avg_price && (
                        <span className="text-white font-mono">{Number(w.recent_avg_price).toLocaleString()}만</span>
                      )}
                      <span className="text-slate-500">{w.deal_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">{h.noWatchlistItems}</div>
            )}
          </div>
          {/* Recent Deals */}
          <div className="border-t border-slate-700/50 pt-2">
            <div className="text-xs text-slate-400 mb-1">{h.recentDeals}</div>
            {recentDeals.length > 0 ? (
              <div className="space-y-1">
                {recentDeals.slice(0, 2).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate mr-2">{d.apt_name || d.district}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono">{Number(d.price || 0).toLocaleString()}만</span>
                      <span className="text-slate-500">{d.deal_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">{h.noRecentDeals}</div>
            )}
          </div>
        </SectionCard>

        {/* Research Summary */}
        <SectionCard title={h.research} color="cyan" onClick={() => onNavigate('research')}>
          {research.length > 0 ? (
            <div className="space-y-3">
              {research.slice(0, 2).map((r: any) => (
                <div key={r.id}>
                  <div className="text-sm text-white font-medium mb-1 line-clamp-1">{r.title}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">{h.confidence}</span>
                      <span className={`font-mono font-semibold ${
                        (r.confidence_avg || 0) >= 0.7 ? 'text-emerald-400' :
                        (r.confidence_avg || 0) >= 0.4 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {((r.confidence_avg || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-slate-500">{r.evidence_count || 0} {h.evidence}</span>
                    <span className="text-slate-600">{r.created_at?.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">{h.noResearchReports}</div>
          )}
        </SectionCard>

        {/* Cost Summary */}
        <SectionCard title={h.apiUsageCost} color="amber" onClick={() => onNavigate('dashboard')}>
          {usage ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{h.apiCalls}</div>
                  <div className="text-lg font-bold text-white">{formatNumber(usage.api_calls || 0, locale)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">{h.tokens}</div>
                  <div className="text-lg font-bold text-white">{formatNumber(usage.total_tokens || 0, locale)}</div>
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{h.cost}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-mono font-semibold">
                      ${(usage.total_cost_usd || 0).toFixed(4)}
                    </span>
                    <span className="text-slate-500">
                      ({formatCurrency(usage.total_cost_krw || 0, 'ko')})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-400">{h.budget}</span>
                  <span className="text-slate-500 font-mono">
                    ${usage.budget_usd || 0} ({Math.round((usage.budget_usd || 0) * (usage.exchange_rate || 1400)).toLocaleString()}원)
                  </span>
                </div>
                {/* Budget progress bar */}
                {usage.budget_usd > 0 && (
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (usage.total_cost_usd / usage.budget_usd) > 0.8 ? 'bg-red-500' :
                        (usage.total_cost_usd / usage.budget_usd) > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((usage.total_cost_usd / usage.budget_usd) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">{loading ? t.loading : h.noUsageData}</div>
          )}
        </SectionCard>
      </div>

      {/* Quick Links Grid */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">{h.quickLinks}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LINKS.map(link => {
            const colorMap: Record<string, string> = {
              blue: 'border-blue-500/30 hover:bg-blue-500/5',
              emerald: 'border-emerald-500/30 hover:bg-emerald-500/5',
              amber: 'border-amber-500/30 hover:bg-amber-500/5',
              cyan: 'border-cyan-500/30 hover:bg-cyan-500/5',
              red: 'border-red-500/30 hover:bg-red-500/5',
              slate: 'border-slate-500/30 hover:bg-slate-500/5',
            }
            return (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border bg-slate-700/10
                  transition-all hover:scale-[1.02] ${colorMap[link.color] || colorMap.slate}`}
              >
                <span className="text-2xl">{link.icon}</span>
                <span className="text-xs font-medium text-white text-center">{link.name}</span>
                <span className="text-[10px] text-slate-500 text-center">{link.desc}</span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
