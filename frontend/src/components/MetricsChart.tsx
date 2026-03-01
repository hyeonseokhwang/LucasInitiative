import { useState, useEffect, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../lib/api'
import {
  CHART_COLORS, commonAxisProps, commonGridProps, commonTooltipProps, legendStyle,
} from '../lib/chartTheme'
import type { SystemSnapshot } from '../types'

interface Props {
  liveMetrics: SystemSnapshot | null
}

interface MetricPoint {
  time: string
  cpu: number
  ram: number
  gpu: number
  vram: number
  temp: number
}

export function MetricsChart({ liveMetrics }: Props) {
  const [history, setHistory] = useState<MetricPoint[]>([])
  const [range, setRange] = useState<'1h' | '6h' | '24h'>('1h')
  const [loading, setLoading] = useState(true)
  const realtimeBuffer = useRef<MetricPoint[]>([])

  // Load historical data
  useEffect(() => {
    setLoading(true)
    const hours = range === '1h' ? 1 : range === '6h' ? 6 : 24
    api.metricsHistory(hours).then(d => {
      const points = (d.history || []).map((r: any) => ({
        time: r.recorded_at,
        cpu: r.cpu_percent ?? 0,
        ram: r.ram_used_gb ?? 0,
        gpu: r.gpu_util ?? 0,
        vram: Math.round((r.gpu_mem_used_mb ?? 0) / 1024 * 10) / 10,
        temp: r.gpu_temp_c ?? 0,
      }))
      setHistory(points)
      realtimeBuffer.current = []
    }).catch(() => {}).finally(() => setLoading(false))
  }, [range])

  // Append live data
  useEffect(() => {
    if (!liveMetrics) return
    const point: MetricPoint = {
      time: liveMetrics.timestamp || new Date().toISOString(),
      cpu: liveMetrics.cpu.percent,
      ram: liveMetrics.ram.used_gb,
      gpu: liveMetrics.gpu.util_percent,
      vram: Math.round(liveMetrics.gpu.mem_used_mb / 1024 * 10) / 10,
      temp: liveMetrics.gpu.temp_c,
    }
    realtimeBuffer.current = [...realtimeBuffer.current.slice(-120), point]
    setHistory(prev => [...prev.slice(-500), point])
  }, [liveMetrics])

  const formatTime = (t: any) => {
    try {
      const d = new Date(String(t))
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">System Metrics</h3>
        <div className="flex gap-1">
          {(['1h', '6h', '24h'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 relative">
        {loading && history.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-slate-500 animate-pulse">Loading metrics...</div>
          </div>
        )}
        {!loading && history.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-slate-500">No metrics data yet. Data will appear as system runs.</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="gradCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.cpu} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.cpu} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradGpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.gpu} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.gpu} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...commonGridProps} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              {...commonAxisProps}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              {...commonAxisProps}
              width={40}
            />
            <Tooltip
              {...commonTooltipProps}
              labelFormatter={formatTime}
              formatter={(value, name) => {
                const v = Number(value)
                if (name === 'ram' || name === 'vram') return [`${v} GB`, String(name).toUpperCase()]
                if (name === 'temp') return [`${v}°C`, 'Temp']
                return [`${v.toFixed(1)}%`, String(name).toUpperCase()]
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={legendStyle}
            />
            <Area
              type="monotone" dataKey="cpu" name="CPU"
              stroke={CHART_COLORS.cpu} fill="url(#gradCpu)"
              strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
            <Area
              type="monotone" dataKey="gpu" name="GPU"
              stroke={CHART_COLORS.gpu} fill="url(#gradGpu)"
              strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary chart: RAM & VRAM */}
      <div className="h-40 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="gradRam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.ram} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.ram} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradVram" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.vram} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.vram} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...commonGridProps} />
            <XAxis dataKey="time" tickFormatter={formatTime} {...commonAxisProps} minTickGap={40} />
            <YAxis
              {...commonAxisProps}
              width={40}
              tickFormatter={v => `${v}GB`}
            />
            <Tooltip
              {...commonTooltipProps}
              labelFormatter={formatTime}
              formatter={(value, name) => [`${Number(value)} GB`, String(name).toUpperCase()]}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
            <Area
              type="monotone" dataKey="ram" name="RAM"
              stroke={CHART_COLORS.ram} fill="url(#gradRam)"
              strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
            <Area
              type="monotone" dataKey="vram" name="VRAM"
              stroke={CHART_COLORS.vram} fill="url(#gradVram)"
              strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
