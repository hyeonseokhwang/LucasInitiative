import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { api } from '../lib/api'
import {
  CHART_COLORS, commonAxisProps, commonGridProps, commonTooltipProps, legendStyle,
} from '../lib/chartTheme'

interface DailyUsage {
  day: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  calls: number
}

export function UsageChart() {
  const [daily, setDaily] = useState<DailyUsage[]>([])
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    api.dailyUsage().then(d => setDaily((d.daily || []).reverse())).catch(() => {})
    api.usage().then(setUsage).catch(() => {})
  }, [])

  if (daily.length === 0 && !usage) return null

  const budgetPercent = usage ? (usage.total_cost_usd / usage.budget_usd) * 100 : 0

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">API Usage</h3>
        {usage && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-amber-400">${usage.total_cost_usd?.toFixed(4)}</span>
            <span className="text-slate-500">/ ${usage.budget_usd}</span>
            <span className={`font-medium ${budgetPercent > 80 ? 'text-red-400' : budgetPercent > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {budgetPercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Budget progress bar */}
      {usage && (
        <div className="mb-4">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetPercent > 80 ? 'bg-red-500' : budgetPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>{usage.api_calls} calls | {(usage.total_tokens || 0).toLocaleString()} tokens</span>
            <span>{Math.round(usage.budget_remaining_krw || 0).toLocaleString()} KRW remaining</span>
          </div>
        </div>
      )}

      {daily.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Cost */}
          <div>
            <div className="text-xs text-slate-400 mb-2">Daily Cost (USD)</div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.apiCost} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.apiCost} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...commonGridProps} />
                  <XAxis
                    dataKey="day"
                    {...commonAxisProps}
                    tickFormatter={d => d.slice(5)} // MM-DD
                    minTickGap={20}
                  />
                  <YAxis {...commonAxisProps} width={40} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    {...commonTooltipProps}
                    formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                  />
                  <Area
                    type="monotone" dataKey="cost_usd" name="Cost"
                    stroke={CHART_COLORS.apiCost} fill="url(#gradCost)"
                    strokeWidth={1.5} dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Tokens */}
          <div>
            <div className="text-xs text-slate-400 mb-2">Daily Tokens</div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <CartesianGrid {...commonGridProps} />
                  <XAxis
                    dataKey="day"
                    {...commonAxisProps}
                    tickFormatter={d => d.slice(5)}
                    minTickGap={20}
                  />
                  <YAxis {...commonAxisProps} width={45} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    {...commonTooltipProps}
                    formatter={(v, name) => [Number(v).toLocaleString(), name === 'input_tokens' ? 'Input' : 'Output']}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
                  <Bar dataKey="input_tokens" name="Input" fill={CHART_COLORS.cpu} stackId="tokens" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="output_tokens" name="Output" fill={CHART_COLORS.tokens} stackId="tokens" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
