import { useState, useRef, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../lib/api'
import {
  CHART_COLORS, ACCENT, commonAxisProps, commonGridProps, commonTooltipProps, legendStyle,
} from '../lib/chartTheme'
import type { SystemSnapshot } from '../types'
import { MetricCard } from './MetricCard'

interface Props {
  data: SystemSnapshot | null
}

type Tab = 'overview' | 'gpu' | 'processes' | 'disk'

const MAX_SPARK = 60

// ─── GPU Detail Tab ───
interface GpuTimePoint { time: string; util: number; vram_mb: number; temp: number }
interface OllamaModelVram { name: string; size_vram_mb: number; size_total_mb: number; digest: string }
interface GpuProcess { pid: number; gpu_mem_mb: number; name: string }

function GpuDetailTab({ data }: { data: SystemSnapshot | null }) {
  const [gpuHistory, setGpuHistory] = useState<GpuTimePoint[]>([])
  const [ollamaModels, setOllamaModels] = useState<OllamaModelVram[]>([])
  const [gpuProcesses, setGpuProcesses] = useState<GpuProcess[]>([])

  // Append live GPU data for time-series (up to ~1 hour at 3s interval = 1200 points, cap at 600)
  useEffect(() => {
    if (!data) return
    const point: GpuTimePoint = {
      time: data.timestamp || new Date().toISOString(),
      util: data.gpu.util_percent,
      vram_mb: data.gpu.mem_used_mb,
      temp: data.gpu.temp_c,
    }
    setGpuHistory(prev => [...prev.slice(-599), point])
  }, [data])

  // Poll GPU detail API every 10s
  useEffect(() => {
    const load = () => {
      api.gpuDetail().then(d => {
        setOllamaModels(d.ollama_models || [])
        setGpuProcesses(d.gpu_processes || [])
      }).catch(() => {})
    }
    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [])

  const formatTime = (t: any) => {
    try { return new Date(String(t)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
    catch { return '' }
  }

  const vramTotal = data?.gpu.mem_total_mb || 24576
  const vramUsed = data?.gpu.mem_used_mb || 0

  return (
    <div className="space-y-4">
      {/* GPU live info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">GPU Utilization</div>
          <div className="text-2xl font-bold text-emerald-400">{data?.gpu.util_percent ?? 0}%</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">VRAM</div>
          <div className="text-2xl font-bold text-orange-400">
            {(vramUsed / 1024).toFixed(1)} / {(vramTotal / 1024).toFixed(1)} GB
          </div>
          <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min((vramUsed / vramTotal) * 100, 100)}%` }} />
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">Temperature</div>
          <div className={`text-2xl font-bold ${(data?.gpu.temp_c ?? 0) > 80 ? 'text-red-400' : (data?.gpu.temp_c ?? 0) > 65 ? 'text-amber-400' : 'text-green-400'}`}>
            {data?.gpu.temp_c ?? 0}°C
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">Power Draw</div>
          <div className="text-2xl font-bold text-yellow-400">{data?.gpu.power_w.toFixed(0) ?? 0}W</div>
        </div>
      </div>

      {/* GPU Utilization + Temperature Chart */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <h4 className="text-sm font-medium text-white mb-3">GPU Utilization & Temperature (Live)</h4>
        <div className="h-48">
          {gpuHistory.length < 3 ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">Collecting GPU data...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gpuHistory} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradGpuUtil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.gpu} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.gpu} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGpuTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.temp} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.temp} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...commonGridProps} />
                <XAxis dataKey="time" tickFormatter={formatTime} {...commonAxisProps} minTickGap={60} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}`} {...commonAxisProps} width={35} />
                <Tooltip {...commonTooltipProps} labelFormatter={formatTime}
                  formatter={(value, name) => {
                    if (name === 'temp') return [`${Number(value)}°C`, 'Temp']
                    return [`${Number(value).toFixed(1)}%`, 'GPU Util']
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
                <Area type="monotone" dataKey="util" name="GPU Util" stroke={CHART_COLORS.gpu} fill="url(#gradGpuUtil)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="temp" name="Temp" stroke={CHART_COLORS.temp} fill="url(#gradGpuTemp)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* VRAM Usage Chart */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <h4 className="text-sm font-medium text-white mb-3">VRAM Usage (Live)</h4>
        <div className="h-36">
          {gpuHistory.length < 3 ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">Collecting VRAM data...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gpuHistory.map(p => ({ ...p, vram_gb: Math.round(p.vram_mb / 1024 * 10) / 10 }))} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradVramDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.vram} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.vram} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...commonGridProps} />
                <XAxis dataKey="time" tickFormatter={formatTime} {...commonAxisProps} minTickGap={60} />
                <YAxis domain={[0, Math.ceil(vramTotal / 1024)]} tickFormatter={v => `${v}GB`} {...commonAxisProps} width={40} />
                <Tooltip {...commonTooltipProps} labelFormatter={formatTime}
                  formatter={(value) => [`${Number(value)} GB`, 'VRAM']}
                />
                <Area type="monotone" dataKey="vram_gb" name="VRAM" stroke={CHART_COLORS.vram} fill="url(#gradVramDetail)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ollama Model VRAM + GPU Processes side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ollama Model VRAM */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-white mb-3">Ollama Model VRAM</h4>
          {ollamaModels.length === 0 ? (
            <div className="text-sm text-slate-500">No models loaded in VRAM</div>
          ) : (
            <div className="space-y-2">
              {ollamaModels.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.digest}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-orange-400">
                      {m.size_vram_mb > 1024 ? `${(m.size_vram_mb / 1024).toFixed(1)} GB` : `${m.size_vram_mb} MB`}
                    </div>
                  </div>
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min((m.size_vram_mb / vramTotal) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GPU Processes */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-white mb-3">GPU Processes</h4>
          {gpuProcesses.length === 0 ? (
            <div className="text-sm text-slate-500">No GPU processes detected</div>
          ) : (
            <div className="space-y-1.5">
              {gpuProcesses.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 font-mono text-xs w-12">{p.pid}</span>
                  <span className="text-white flex-1 truncate">{p.name}</span>
                  <span className="text-orange-400 font-mono">
                    {p.gpu_mem_mb > 1024 ? `${(p.gpu_mem_mb / 1024).toFixed(1)} GB` : `${p.gpu_mem_mb} MB`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Process Monitor Tab ───
interface ProcessInfo { pid: number; name: string; cpu_percent: number; mem_mb: number; mem_percent: number; is_key: boolean }

function ProcessTab() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => {
      api.processes(20).then(d => {
        setProcesses(d.processes || [])
        setLoading(false)
      }).catch(() => setLoading(false))
    }
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [])

  if (loading) return <div className="text-sm text-slate-500 animate-pulse py-8 text-center">Loading processes...</div>

  // Split key vs other
  const keyProcs = processes.filter(p => p.is_key)
  const otherProcs = processes.filter(p => !p.is_key)

  return (
    <div className="space-y-4">
      {/* Key processes bar chart */}
      {keyProcs.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-white mb-3">Key Processes - Memory Usage</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={keyProcs} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid {...commonGridProps} horizontal={false} />
                <XAxis type="number" tickFormatter={v => v > 1024 ? `${(v / 1024).toFixed(1)}G` : `${v}M`} {...commonAxisProps} />
                <YAxis type="category" dataKey="name" {...commonAxisProps} width={80} />
                <Tooltip {...commonTooltipProps}
                  formatter={(v) => [`${Number(v).toFixed(1)} MB`, 'Memory']}
                />
                <Bar dataKey="mem_mb" fill={ACCENT.purple} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Full process table */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <h4 className="text-sm font-medium text-white mb-3">Top Processes</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700/50">
                <th className="text-left py-2 pr-3">PID</th>
                <th className="text-left py-2 pr-3">Process</th>
                <th className="text-right py-2 pr-3">CPU %</th>
                <th className="text-right py-2 pr-3">Memory</th>
                <th className="text-right py-2">MEM %</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p, i) => (
                <tr key={i} className={`border-b border-slate-700/20 ${p.is_key ? 'bg-blue-500/5' : ''}`}>
                  <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{p.pid}</td>
                  <td className="py-1.5 pr-3 text-white">
                    {p.is_key && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5" />}
                    {p.name}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">
                    <span className={p.cpu_percent > 50 ? 'text-red-400' : p.cpu_percent > 20 ? 'text-amber-400' : 'text-slate-300'}>
                      {p.cpu_percent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-300">
                    {p.mem_mb > 1024 ? `${(p.mem_mb / 1024).toFixed(1)} GB` : `${p.mem_mb.toFixed(0)} MB`}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    <span className={p.mem_percent > 10 ? 'text-amber-400' : 'text-slate-400'}>
                      {p.mem_percent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Disk Usage Tab ───
interface DriveInfo { path: string; used_gb: number; total_gb: number; free_gb: number; percent: number }
interface PathInfo { path: string; size_mb: number; size_gb: number; exists: boolean }

function DiskTab() {
  const [diskData, setDiskData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.diskDetail().then(d => {
      setDiskData(d.disk || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-slate-500 animate-pulse py-8 text-center">Loading disk info...</div>
  if (!diskData) return <div className="text-sm text-slate-500 py-8 text-center">No disk data available</div>

  // Extract drives and paths
  const drives: [string, DriveInfo][] = Object.entries(diskData).filter(([k]) => k.startsWith('drive_')) as any
  const paths: [string, PathInfo][] = Object.entries(diskData).filter(([k]) => !k.startsWith('drive_')) as any

  const pathLabels: Record<string, string> = {
    ollama_models: 'Ollama Models',
    database: 'Database',
    frontend_dist: 'Frontend Build',
  }

  const pathColors: Record<string, string> = {
    ollama_models: ACCENT.orange,
    database: ACCENT.blue,
    frontend_dist: ACCENT.green,
  }

  return (
    <div className="space-y-4">
      {/* Drive overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {drives.map(([key, drive]) => (
          <div key={key} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white">{drive.path} Drive</h4>
              <span className={`text-xs font-mono ${drive.percent > 90 ? 'text-red-400' : drive.percent > 75 ? 'text-amber-400' : 'text-green-400'}`}>
                {drive.percent}%
              </span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${drive.percent > 90 ? 'bg-red-500' : drive.percent > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${drive.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Used: {drive.used_gb} GB</span>
              <span>Free: {drive.free_gb} GB</span>
              <span>Total: {drive.total_gb} GB</span>
            </div>
          </div>
        ))}
      </div>

      {/* Key path sizes */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <h4 className="text-sm font-medium text-white mb-3">Key Path Usage</h4>
        <div className="space-y-3">
          {paths.map(([key, info]) => {
            const label = pathLabels[key] || key
            const color = pathColors[key] || ACCENT.gray
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm text-white">{label}</span>
                    {!info.exists && <span className="ml-2 text-xs text-red-400">(not found)</span>}
                  </div>
                  <span className="text-sm font-mono text-slate-300">
                    {info.size_gb >= 1 ? `${info.size_gb} GB` : `${info.size_mb.toFixed(0)} MB`}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate mb-1">{info.path}</div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  {/* Visual bar — scale relative to largest path */}
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(Math.max((info.size_mb / Math.max(...paths.map(([, p]) => p.size_mb), 1)) * 100, 2), 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main SystemMetrics Component ───
export function SystemMetrics({ data }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const cpuHistory = useRef<number[]>([])
  const ramHistory = useRef<number[]>([])
  const gpuHistory = useRef<number[]>([])
  const vramHistory = useRef<number[]>([])

  useEffect(() => {
    if (!data) return
    const vramPct = data.gpu.mem_total_mb > 0
      ? (data.gpu.mem_used_mb / data.gpu.mem_total_mb) * 100 : 0
    cpuHistory.current = [...cpuHistory.current.slice(-(MAX_SPARK - 1)), data.cpu.percent]
    ramHistory.current = [...ramHistory.current.slice(-(MAX_SPARK - 1)), data.ram.percent]
    gpuHistory.current = [...gpuHistory.current.slice(-(MAX_SPARK - 1)), data.gpu.util_percent]
    vramHistory.current = [...vramHistory.current.slice(-(MAX_SPARK - 1)), vramPct]
  }, [data])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'gpu', label: 'GPU' },
    { id: 'processes', label: 'Processes' },
    { id: 'disk', label: 'Disk' },
  ]

  const vramPercent = data && data.gpu.mem_total_mb > 0
    ? (data.gpu.mem_used_mb / data.gpu.mem_total_mb) * 100
    : 0

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="CPU"
              value={`${data.cpu.freq_mhz} MHz`}
              subtitle={`${data.cpu.cores}C / ${data.cpu.threads}T`}
              percent={data.cpu.percent}
              color="blue"
              sparkData={[...cpuHistory.current]}
            />
            <MetricCard
              title="RAM"
              value={`${data.ram.used_gb} / ${data.ram.total_gb} GB`}
              percent={data.ram.percent}
              color="purple"
              sparkData={[...ramHistory.current]}
            />
            <MetricCard
              title={data.gpu.name || 'GPU'}
              value={`${data.gpu.temp_c}°C`}
              subtitle={`${data.gpu.power_w.toFixed(0)}W | ${data.gpu.util_percent}% util`}
              percent={data.gpu.util_percent}
              color="green"
              sparkData={[...gpuHistory.current]}
            />
            <MetricCard
              title="VRAM"
              value={`${(data.gpu.mem_used_mb / 1024).toFixed(1)} / ${(data.gpu.mem_total_mb / 1024).toFixed(1)} GB`}
              percent={vramPercent}
              color="orange"
              sparkData={[...vramHistory.current]}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 h-32 animate-pulse" />
            ))}
          </div>
        )
      )}

      {tab === 'gpu' && <GpuDetailTab data={data} />}
      {tab === 'processes' && <ProcessTab />}
      {tab === 'disk' && <DiskTab />}
    </div>
  )
}
