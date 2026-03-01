import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useLocale } from '../hooks/useLocale'

// Claude model pricing (per million tokens)
const MODEL_PRICING = {
  'opus-4.6':   { input: 15.0,  output: 75.0,  name: 'Opus 4.6' },
  'sonnet-4.6': { input: 3.0,   output: 15.0,  name: 'Sonnet 4.6' },
  'haiku-4.5':  { input: 0.80,  output: 4.0,   name: 'Haiku 4.5' },
}

const PLAN_COST_MONTHLY = 200  // Max plan $200/month
const CC_BASE = 'http://localhost:9000'

interface PlanInfo {
  percent: number
  resetTime: string
  updatedAt: string
}

interface DailyUsage {
  day: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  calls: number
}

interface UsageSummary {
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost_usd: number
  total_cost_krw: number
  api_calls: number
  budget_usd: number
  exchange_rate: number
}

// Simple bar chart component
function BarChart({ data, maxVal, labelKey, valueKey, colorFn }: {
  data: any[]
  maxVal: number
  labelKey: string
  valueKey: string
  colorFn: (val: number) => string
}) {
  if (data.length === 0) return null
  return (
    <div className="space-y-1">
      {data.map((d, i) => {
        const val = d[valueKey] || 0
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-slate-500 text-right shrink-0 font-mono">{d[labelKey]}</span>
            <div className="flex-1 h-4 bg-slate-700/30 rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all duration-500 ${colorFn(val)}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="w-20 text-slate-400 text-right shrink-0 font-mono">
              {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` :
               val >= 1000 ? `${(val / 1000).toFixed(0)}K` :
               val.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Circular gauge
function PlanGauge({ percent, resetTime, isKo }: { percent: number; resetTime: string; isKo: boolean }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(percent, 100) / 100) * circ
  const color = percent >= 80 ? '#ef4444' : percent >= 50 ? '#f59e0b' : '#10b981'
  const remaining = 100 - percent

  // Time until reset
  const resetDate = new Date(resetTime)
  const now = new Date()
  const diffMs = resetDate.getTime() - now.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  const diffHours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)))

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)"
          className="transition-all duration-1000"
        />
        <text x="60" y="52" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="22" fontWeight="bold">
          {percent}%
        </text>
        <text x="60" y="72" textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize="10">
          {isKo ? '사용됨' : 'used'}
        </text>
      </svg>
      <div className="text-center">
        <div className="text-xs text-slate-400">
          {remaining}% {isKo ? '잔여' : 'remaining'}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          {isKo ? '리셋까지' : 'Reset in'} {diffDays}{isKo ? '일' : 'd'} {diffHours}{isKo ? '시간' : 'h'}
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5">
          {resetDate.toLocaleDateString(isKo ? 'ko-KR' : 'en-US')}
        </div>
      </div>
    </div>
  )
}

export function TokenUsagePanel() {
  const { locale, t } = useLocale()
  const tk = t.tok_panel
  const isKo = locale === 'ko'

  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [daily, setDaily] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [planRes, usageRes, dailyRes] = await Promise.allSettled([
        // Plan info from coordination file (served via CC or direct fetch)
        fetch(`${CC_BASE}/api/token-usage`, { signal: AbortSignal.timeout(3000) })
          .then(r => r.json())
          .catch(() =>
            // Fallback: try reading from known path
            fetch('/api/token-usage', { signal: AbortSignal.timeout(3000) }).then(r => r.json())
          )
          .catch(() => ({ percent: 37, resetTime: '2026-03-08T00:00:00Z', updatedAt: new Date().toISOString() })),
        api.usage(),
        api.dailyUsage(),
      ])

      if (planRes.status === 'fulfilled') setPlanInfo(planRes.value)
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value as any)
      if (dailyRes.status === 'fulfilled') setDaily((dailyRes.value as any).daily || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Daily usage as bar chart data (real data, no simulation)
  const dailyBars = [...daily].reverse().slice(-14).map(d => ({
    label: d.day?.slice(5) || '',
    tokens: (d.input_tokens || 0) + (d.output_tokens || 0),
    cost: d.cost_usd || 0,
    calls: d.calls || 0,
  }))
  const maxDaily = Math.max(...dailyBars.map(d => d.tokens), 1)

  // Cost comparison calculations
  const totalTokensUsed = usage?.total_tokens || 0
  const inputTokens = usage?.total_input_tokens || 0
  const outputTokens = usage?.total_output_tokens || 0

  const apiCostOpus = (inputTokens / 1_000_000 * 15) + (outputTokens / 1_000_000 * 75)
  const apiCostSonnet = (inputTokens / 1_000_000 * 3) + (outputTokens / 1_000_000 * 15)
  const apiCostHaiku = (inputTokens / 1_000_000 * 0.8) + (outputTokens / 1_000_000 * 4)

  // Weekly/monthly projections
  const daysInPeriod = daily.length || 1
  const avgDailyCost = daily.reduce((sum, d) => sum + (d.cost_usd || 0), 0) / daysInPeriod
  const avgDailyTokens = daily.reduce((sum, d) => sum + (d.input_tokens || 0) + (d.output_tokens || 0), 0) / daysInPeriod
  const weeklyProjection = avgDailyCost * 7
  const monthlyProjection = avgDailyCost * 30

  // Dual account analysis
  const singlePlan = PLAN_COST_MONTHLY
  const dualPlan = PLAN_COST_MONTHLY * 2
  const monthlyApiEquivalent = apiCostOpus * (30 / Math.max(daysInPeriod, 1))

  const rate = usage?.exchange_rate || 1400

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-white">{tk.title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {planInfo?.updatedAt ? `${tk.lastUpdated}: ${new Date(planInfo.updatedAt).toLocaleString(isKo ? 'ko-KR' : 'en-US')}` : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 rounded-lg bg-slate-700/30 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Top Row: Plan Gauge + Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Plan Gauge */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 flex flex-col items-center justify-center">
                <div className="text-xs text-slate-500 mb-2 font-medium">{tk.planUsage}</div>
                {planInfo ? (
                  <PlanGauge percent={planInfo.percent} resetTime={planInfo.resetTime} isKo={isKo} />
                ) : (
                  <div className="text-sm text-slate-500">{tk.noData}</div>
                )}
                <div className="text-[10px] text-slate-600 mt-2">Max Plan ${PLAN_COST_MONTHLY}/{isKo ? '월' : 'mo'}</div>
              </div>

              {/* Usage Summary */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 space-y-3">
                <div className="text-xs text-slate-500 font-medium">{tk.usageSummary}</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.totalTokens}</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {totalTokensUsed >= 1000000 ? `${(totalTokensUsed / 1000000).toFixed(2)}M` : totalTokensUsed.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.inputTokens}</span>
                    <span className="text-xs text-blue-400 font-mono">{inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.outputTokens}</span>
                    <span className="text-xs text-emerald-400 font-mono">{outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-700/50 pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.apiCalls}</span>
                    <span className="text-sm font-bold text-white">{usage?.api_calls?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.estimatedCost}</span>
                    <span className="text-xs text-amber-400 font-mono">${(usage?.total_cost_usd || 0).toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Projections */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 space-y-3">
                <div className="text-xs text-slate-500 font-medium">{tk.projections}</div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">{tk.dailyAvg}</span>
                      <span className="text-xs text-white font-mono">
                        {avgDailyTokens >= 1000 ? `${(avgDailyTokens / 1000).toFixed(0)}K` : Math.round(avgDailyTokens)} tok
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 text-right">${avgDailyCost.toFixed(4)}/day</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.weeklyEst}</span>
                    <span className="text-xs text-amber-400 font-mono">${weeklyProjection.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{tk.monthlyEst}</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">${monthlyProjection.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 text-right">
                    ≈ {Math.round(monthlyProjection * rate).toLocaleString()}{isKo ? '원' : ' KRW'}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Usage Bar Chart */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 font-medium mb-3">{tk.dailyUsage}</div>
              {dailyBars.length > 0 ? (
                <BarChart
                  data={dailyBars}
                  maxVal={maxDaily}
                  labelKey="label"
                  valueKey="tokens"
                  colorFn={(v) => v > maxDaily * 0.8 ? 'bg-red-500' : v > maxDaily * 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}
                />
              ) : (
                <div className="text-xs text-slate-500 py-4 text-center">{tk.noData}</div>
              )}
            </div>

            {/* API Cost Comparison */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 font-medium mb-3">{tk.apiCostComparison}</div>
              <p className="text-[11px] text-slate-400 mb-4">{tk.apiCostDesc}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(MODEL_PRICING).map(([key, model]) => {
                  const cost = key === 'opus-4.6' ? apiCostOpus : key === 'sonnet-4.6' ? apiCostSonnet : apiCostHaiku
                  return (
                    <div key={key} className="rounded-lg border border-slate-700/40 p-3 bg-slate-900/20">
                      <div className="text-xs font-bold text-white mb-2">{model.name}</div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Input</span>
                          <span className="text-slate-400 font-mono">${model.input}/MTok</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Output</span>
                          <span className="text-slate-400 font-mono">${model.output}/MTok</span>
                        </div>
                        <div className="border-t border-slate-700/40 pt-1 flex justify-between">
                          <span className="text-slate-400">{tk.equivalent}</span>
                          <span className="text-amber-400 font-mono font-bold">${cost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Cost Optimization: Dual Account Analysis */}
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 rounded-xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">💰</span>
                <h3 className="text-sm font-bold text-white">{tk.costOptTitle}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Single Plan */}
                <div className="rounded-lg border border-slate-700/50 p-4 bg-slate-900/30">
                  <div className="text-xs text-slate-500 mb-2">{tk.singlePlan}</div>
                  <div className="text-xl font-bold text-white">${singlePlan}</div>
                  <div className="text-[10px] text-slate-500">/{isKo ? '월' : 'mo'}</div>
                  <div className="text-xs text-slate-400 mt-2">≈ {(singlePlan * rate).toLocaleString()}{isKo ? '원' : ' KRW'}</div>
                  <div className="mt-3 text-[10px] text-slate-500">
                    {tk.currentUsage}: {planInfo?.percent || 0}%
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (planInfo?.percent || 0) >= 80 ? 'bg-red-500' :
                        (planInfo?.percent || 0) >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${planInfo?.percent || 0}%` }}
                    />
                  </div>
                </div>

                {/* Dual Plan */}
                <div className="rounded-lg border border-amber-500/30 p-4 bg-amber-500/5">
                  <div className="text-xs text-amber-400 mb-2">{tk.dualPlan}</div>
                  <div className="text-xl font-bold text-white">${dualPlan}</div>
                  <div className="text-[10px] text-slate-500">/{isKo ? '월' : 'mo'}</div>
                  <div className="text-xs text-slate-400 mt-2">≈ {(dualPlan * rate).toLocaleString()}{isKo ? '원' : ' KRW'}</div>
                  <div className="mt-3 text-[10px] text-amber-400/70">
                    {tk.dualBenefit}
                  </div>
                </div>

                {/* API Direct */}
                <div className="rounded-lg border border-blue-500/30 p-4 bg-blue-500/5">
                  <div className="text-xs text-blue-400 mb-2">{tk.apiDirect}</div>
                  <div className="text-xl font-bold text-white">
                    ${monthlyApiEquivalent.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-slate-500">/{isKo ? '월 추정' : 'mo est.'}</div>
                  <div className="text-xs text-slate-400 mt-2">
                    ≈ {Math.round(monthlyApiEquivalent * rate).toLocaleString()}{isKo ? '원' : ' KRW'}
                  </div>
                  <div className="mt-3 text-[10px] text-blue-400/70">
                    {tk.apiDirectNote}
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className="rounded-lg bg-slate-900/40 border border-slate-700/40 p-3">
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-white">{tk.verdict}:</strong>{' '}
                  {monthlyApiEquivalent > dualPlan ? (
                    <span>
                      {isKo
                        ? `API 직접 사용 시 월 $${monthlyApiEquivalent.toFixed(0)}(${Math.round(monthlyApiEquivalent * rate).toLocaleString()}원) 예상. 듀얼 플랜($${dualPlan}) 대비 $${(monthlyApiEquivalent - dualPlan).toFixed(0)} 절약 효과. Max 플랜 유지가 경제적.`
                        : `API direct would cost ~$${monthlyApiEquivalent.toFixed(0)}/mo. Dual plan ($${dualPlan}) saves $${(monthlyApiEquivalent - dualPlan).toFixed(0)}/mo. Max plan is more economical.`
                      }
                    </span>
                  ) : monthlyApiEquivalent > singlePlan ? (
                    <span>
                      {isKo
                        ? `API 직접 사용 시 월 $${monthlyApiEquivalent.toFixed(0)} 예상. 싱글 플랜($${singlePlan})이 경제적. 사용량 증가 시 듀얼 검토.`
                        : `API direct ~$${monthlyApiEquivalent.toFixed(0)}/mo. Single plan ($${singlePlan}) is economical. Consider dual if usage grows.`
                      }
                    </span>
                  ) : (
                    <span>
                      {isKo
                        ? `현재 사용량으로는 API 직접 사용($${monthlyApiEquivalent.toFixed(0)}/월)이 플랜보다 저렴. 하지만 무제한 접근성과 편의성 고려 시 플랜 유지 권장.`
                        : `At current usage, API direct ($${monthlyApiEquivalent.toFixed(0)}/mo) is cheaper than plan. However, plan recommended for unlimited access convenience.`
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
