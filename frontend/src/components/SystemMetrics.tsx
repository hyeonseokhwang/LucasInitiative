import type { SystemSnapshot } from '../types'
import { MetricCard } from './MetricCard'

interface Props {
  data: SystemSnapshot | null
}

export function SystemMetrics({ data }: Props) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 h-32 animate-pulse" />
        ))}
      </div>
    )
  }

  const vramPercent = data.gpu.mem_total_mb > 0
    ? (data.gpu.mem_used_mb / data.gpu.mem_total_mb) * 100
    : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="CPU"
        value={`${data.cpu.freq_mhz} MHz`}
        subtitle={`${data.cpu.cores}C / ${data.cpu.threads}T`}
        percent={data.cpu.percent}
        color="blue"
      />
      <MetricCard
        title="RAM"
        value={`${data.ram.used_gb} / ${data.ram.total_gb} GB`}
        percent={data.ram.percent}
        color="purple"
      />
      <MetricCard
        title={data.gpu.name || 'GPU'}
        value={`${data.gpu.temp_c}°C`}
        subtitle={`${data.gpu.power_w.toFixed(0)}W | ${data.gpu.util_percent}% util`}
        percent={data.gpu.util_percent}
        color="green"
      />
      <MetricCard
        title="VRAM"
        value={`${(data.gpu.mem_used_mb / 1024).toFixed(1)} / ${(data.gpu.mem_total_mb / 1024).toFixed(1)} GB`}
        percent={vramPercent}
        color="orange"
      />
    </div>
  )
}
