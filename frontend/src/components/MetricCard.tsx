interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  percent: number
  color?: string
  icon?: string
}

export function MetricCard({ title, value, subtitle, percent, color = 'blue' }: MetricCardProps) {
  const colors: Record<string, { bar: string; bg: string; text: string }> = {
    blue: { bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    green: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    orange: { bar: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
    purple: { bar: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    red: { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  }
  const c = colors[color] || colors.blue

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
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
  )
}
