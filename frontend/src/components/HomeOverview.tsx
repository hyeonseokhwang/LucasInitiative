import { useState, useEffect } from 'react'
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

  useEffect(() => {
    Promise.allSettled([
      api.indices().then(r => setIndices(r.indices || [])),
      api.portfolio().then(r => setPortfolio(r)),
      api.reWatchlist().then(r => setWatchlist(r.watchlist || [])),
      api.reDeals(undefined, undefined, 3).then(r => setRecentDeals(r.deals || [])),
      api.researchReports(3).then(r => setResearch(r.reports || [])),
      api.usage().then(r => setUsage(r)),
      api.challenges().then(r => setChallenges(Array.isArray(r) ? r : (r?.challenges || []))),
    ]).finally(() => setLoading(false))
  }, [])

  const vramPercent = metrics && metrics.gpu.mem_total_mb > 0
    ? (metrics.gpu.mem_used_mb / metrics.gpu.mem_total_mb) * 100 : 0

  return (
    <div className="space-y-6">
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
    </div>
  )
}
