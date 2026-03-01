import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../lib/api'
import { ACCENT, commonAxisProps, commonGridProps, commonTooltipProps } from '../lib/chartTheme'

interface ModelEntry {
  name: string
  label: string
  category: string
  recommended: boolean
  note: string
  size: number
  modified_at: string
}

interface RunningModel {
  name: string
  size: number
  size_vram: number
  digest: string
  expires_at: string
}

interface ModelDetail {
  parameters?: string
  template?: string
  modelfile?: string
  details?: {
    parent_model?: string
    format?: string
    family?: string
    families?: string[]
    parameter_size?: string
    quantization_level?: string
  }
}

// Benchmark data (hardcoded from BENCHMARK_REPORT.md)
const BENCHMARKS: Record<string, { speed: number; pass: string; vram_gb: number }> = {
  'qwen2.5:14b':  { speed: 82.0, pass: '6/6', vram_gb: 17.8 },
  'qwen2.5:32b':  { speed: 5.5,  pass: '6/6', vram_gb: 22.2 },
  'deepseek-r1:14b': { speed: 36.4, pass: '4/6', vram_gb: 17.0 },
  'deepseek-r1:8b':  { speed: 55.0, pass: '5/6', vram_gb: 8.5 },
  'qwen2.5-coder:7b': { speed: 95.0, pass: '5/6', vram_gb: 7.5 },
  'gemma2:2b':    { speed: 120.0, pass: '4/6', vram_gb: 3.2 },
}

const CATEGORY_COLORS: Record<string, string> = {
  general: ACCENT.blue,
  reasoning: ACCENT.purple,
  code: ACCENT.green,
  korean: ACCENT.amber,
}

export function ModelManagementPanel() {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [running, setRunning] = useState<RunningModel[]>([])
  const [loading, setLoading] = useState(true)
  const [warmingUp, setWarmingUp] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([api.models(), api.modelsRunning()])
      setModels(m.models || [])
      setRunning(r.models || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 15000)
    return () => clearInterval(iv)
  }, [loadData])

  const handleWarmup = async (name: string) => {
    setWarmingUp(name)
    try {
      await api.modelWarmup(name)
      await loadData()
    } catch { /* ignore */ }
    setWarmingUp(null)
  }

  const handleShowDetail = async (name: string) => {
    if (selectedModel === name) { setSelectedModel(null); setModelDetail(null); return }
    setSelectedModel(name)
    setDetailLoading(true)
    try {
      const d = await api.modelInfo(name)
      setModelDetail(d.info || {})
    } catch { setModelDetail(null) }
    setDetailLoading(false)
  }

  const runningNames = new Set(running.map(r => r.name))

  const formatSize = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
    return `${bytes} B`
  }

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) }
    catch { return '' }
  }

  if (loading) {
    return <div className="text-sm text-slate-500 animate-pulse py-8 text-center">Loading models...</div>
  }

  // Prepare VRAM chart data
  const vramChartData = running.map(r => ({
    name: r.name.length > 20 ? r.name.slice(0, 18) + '...' : r.name,
    fullName: r.name,
    vram_gb: Math.round((r.size_vram || r.size || 0) / 1e9 * 10) / 10,
  }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Ollama Models</h2>
          <p className="text-xs text-slate-500 mt-0.5">{models.length} installed, {running.length} loaded in VRAM</p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* VRAM Usage Chart */}
      {vramChartData.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <h3 className="text-sm font-medium text-white mb-3">Loaded Models - VRAM Usage</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vramChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid {...commonGridProps} horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${v} GB`} {...commonAxisProps} />
                <YAxis type="category" dataKey="name" {...commonAxisProps} width={120} />
                <Tooltip
                  {...commonTooltipProps}
                  formatter={(v) => [`${Number(v)} GB`, 'VRAM']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                />
                <Bar dataKey="vram_gb" radius={[0, 4, 4, 0]} barSize={20}>
                  {vramChartData.map((_, i) => (
                    <Cell key={i} fill={ACCENT.orange} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Model List */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700/50 bg-slate-800/30">
              <th className="text-left py-2.5 px-4">Model</th>
              <th className="text-left py-2.5 px-3">Category</th>
              <th className="text-right py-2.5 px-3">Size</th>
              <th className="text-right py-2.5 px-3">Modified</th>
              <th className="text-center py-2.5 px-3">Status</th>
              <th className="text-center py-2.5 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.map(m => {
              const isLoaded = runningNames.has(m.name)
              const bench = BENCHMARKS[m.name]
              const catColor = CATEGORY_COLORS[m.category] || ACCENT.gray
              return (
                <tr
                  key={m.name}
                  className={`border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors ${isLoaded ? 'bg-emerald-500/5' : ''}`}
                >
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleShowDetail(m.name)} className="text-left group">
                        <div className="text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                          {m.label || m.name}
                          {m.recommended && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                              REC
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{m.name}</div>
                      </button>
                    </div>
                    {m.note && <div className="text-[10px] text-slate-500 mt-0.5">{m.note}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className="px-2 py-0.5 text-xs rounded-full"
                      style={{ backgroundColor: `${catColor}20`, color: catColor }}
                    >
                      {m.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                    {formatSize(m.size)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {formatDate(m.modified_at)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {isLoaded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Loaded
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Idle</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {isLoaded ? (
                      <span className="text-xs text-slate-500">In VRAM</span>
                    ) : (
                      <button
                        onClick={() => handleWarmup(m.name)}
                        disabled={warmingUp !== null}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          warmingUp === m.name
                            ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                            : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                        }`}
                      >
                        {warmingUp === m.name ? 'Loading...' : 'Load'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Model Detail Expand */}
      {selectedModel && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">Model Details: {selectedModel}</h3>
            <button onClick={() => { setSelectedModel(null); setModelDetail(null) }} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          {detailLoading ? (
            <div className="text-sm text-slate-500 animate-pulse">Loading details...</div>
          ) : modelDetail ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
              {modelDetail.details && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Info</div>
                  {modelDetail.details.family && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Family</span>
                      <span className="text-white">{modelDetail.details.family}</span>
                    </div>
                  )}
                  {modelDetail.details.parameter_size && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Parameters</span>
                      <span className="text-white">{modelDetail.details.parameter_size}</span>
                    </div>
                  )}
                  {modelDetail.details.quantization_level && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantization</span>
                      <span className="text-white">{modelDetail.details.quantization_level}</span>
                    </div>
                  )}
                  {modelDetail.details.format && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Format</span>
                      <span className="text-white">{modelDetail.details.format}</span>
                    </div>
                  )}
                </div>
              )}
              {modelDetail.parameters && (
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Parameters</div>
                  <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-md p-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                    {modelDetail.parameters}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No details available.</div>
          )}
        </div>
      )}

      {/* Benchmark Comparison */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <h3 className="text-sm font-medium text-white mb-3">Performance Benchmarks</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700/50">
                <th className="text-left py-2 pr-3">Model</th>
                <th className="text-right py-2 px-3">Speed (tok/s)</th>
                <th className="text-right py-2 px-3">Tests</th>
                <th className="text-right py-2 px-3">VRAM</th>
                <th className="py-2 px-3 text-left">Speed Indicator</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(BENCHMARKS)
                .sort(([, a], [, b]) => b.speed - a.speed)
                .map(([name, bench]) => {
                  const model = models.find(m => m.name === name)
                  const isLoaded = runningNames.has(name)
                  const maxSpeed = 120
                  return (
                    <tr key={name} className={`border-b border-slate-700/20 ${isLoaded ? 'bg-emerald-500/5' : ''}`}>
                      <td className="py-2 pr-3">
                        <span className="text-white">{model?.label || name}</span>
                        {isLoaded && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        <span className={bench.speed >= 50 ? 'text-green-400' : bench.speed >= 20 ? 'text-amber-400' : 'text-red-400'}>
                          {bench.speed}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={bench.pass === '6/6' ? 'text-green-400' : 'text-amber-400'}>
                          {bench.pass}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                        {bench.vram_gb} GB
                      </td>
                      <td className="py-2 px-3">
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min((bench.speed / maxSpeed) * 100, 100)}%`,
                              backgroundColor: bench.speed >= 50 ? ACCENT.green : bench.speed >= 20 ? ACCENT.amber : ACCENT.red,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          Benchmarks from Lucas Initiative test suite (6 tests: Korean, English, JSON, code, math, complex reasoning)
        </div>
      </div>
    </div>
  )
}
