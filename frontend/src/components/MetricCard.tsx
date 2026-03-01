import { useId } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { ACCENT } from '../lib/chartTheme'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  percent: number
  color?: string
  icon?: string
  sparkData?: number[]
}

const STROKE_COLORS: Record<string, string> = {
  blue: ACCENT.blue,
  green: ACCENT.green,
  orange: ACCENT.orange,
  purple: ACCENT.purple,
  red: ACCENT.red,
}

export function MetricCard({ title, value, subtitle, percent, color = 'blue', sparkData }: MetricCardProps) {
  const gradId = useId()
  const colors: Record<string, { bar: string; bg: string; text: string }> = {
    blue: { bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    green: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    orange: { bar: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
    purple: { bar: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    red: { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  }
  const c = colors[color] || colors.blue
  const strokeColor = STROKE_COLORS[color] || STROKE_COLORS.blue

  // Build sparkline data for recharts
  const sparkChartData = sparkData?.map((v, i) => ({ v, i })) ?? []

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 relative overflow-hidden">
      {/* Background sparkline */}
      {sparkChartData.length > 2 && (
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={strokeColor} strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <span className="text-sm text-slate-400">{title}</span>
          <span className={`text-sm font-mono ${c.text}`}>{percent.toFixed(0)}%</span>
        </div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
