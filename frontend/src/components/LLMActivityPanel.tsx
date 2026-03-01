import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '../hooks/useLocale'

const OLLAMA = 'http://localhost:11434'
const CC_BASE = 'http://localhost:9000'
const VILLAGE = 'http://localhost:8888'

interface VramEntry {
  t: string
  gpu: number
  used: number
  total: number
  model: string
}

interface OllamaModel {
  name: string
  model: string
  size: number
  digest: string
  modified_at: string
  details?: { parameter_size?: string; quantization_level?: string; family?: string }
}

interface RunningModel {
  name: string
  model: string
  size: number
  size_vram: number
  expires_at: string
}

interface ModelSwap {
  time: string
  from: string
  to: string
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

function timeLabel(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Mini VRAM sparkline chart
function VramChart({ data }: { data: VramEntry[] }) {
  if (data.length < 2) return null
  const maxTotal = data[0]?.total || 24564
  const w = 600
  const h = 120
  const padding = { top: 10, right: 10, bottom: 25, left: 45 }
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW
    const y = padding.top + chartH - (d.used / maxTotal) * chartH
    return { x, y, d }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = pathD + ` L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`

  // Y-axis labels
  const yLabels = [0, maxTotal * 0.25, maxTotal * 0.5, maxTotal * 0.75, maxTotal]

  // X-axis labels (first, middle, last)
  const xLabels = [
    { x: padding.left, label: timeLabel(data[0].t) },
    { x: padding.left + chartW / 2, label: timeLabel(data[Math.floor(data.length / 2)].t) },
    { x: padding.left + chartW, label: timeLabel(data[data.length - 1].t) },
  ]

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="text-slate-400">
      {/* Grid lines */}
      {yLabels.map((val, i) => {
        const y = padding.top + chartH - (val / maxTotal) * chartH
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={w - padding.right} y2={y} stroke="currentColor" strokeOpacity="0.1" />
            <text x={padding.left - 4} y={y + 3} textAnchor="end" fontSize="8" fill="currentColor" opacity="0.5">
              {formatBytes(val)}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#vramGrad)" opacity="0.3" />
      <defs>
        <linearGradient id="vramGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" />

      {/* X labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={h - 3} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.5">
          {l.label}
        </text>
      ))}

      {/* Model swap markers */}
      {points.map((p, i) => {
        if (i === 0) return null
        if (p.d.model !== points[i - 1].d.model) {
          return (
            <g key={`swap-${i}`}>
              <line x1={p.x} y1={padding.top} x2={p.x} y2={padding.top + chartH} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" />
              <circle cx={p.x} cy={p.y} r="4" fill="#f59e0b" />
              <text x={p.x} y={padding.top - 2} textAnchor="middle" fontSize="7" fill="#f59e0b">
                {p.d.model.split(':')[0]}
              </text>
            </g>
          )
        }
        return null
      })}
    </svg>
  )
}

export function LLMActivityPanel() {
  const { locale, t } = useLocale()
  const lm = t.llm
  const isKo = locale === 'ko'

  const [running, setRunning] = useState<RunningModel[]>([])
  const [available, setAvailable] = useState<OllamaModel[]>([])
  const [vramHistory, setVramHistory] = useState<VramEntry[]>([])
  const [villageStatus, setVillageStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [psRes, tagsRes, vramRes, villageRes] = await Promise.allSettled([
        fetch(`${OLLAMA}/api/ps`, { signal: AbortSignal.timeout(3000) }).then(r => r.json()),
        fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) }).then(r => r.json()),
        fetch(`${CC_BASE}/api/vram-history`, { signal: AbortSignal.timeout(3000) })
          .then(r => r.json())
          .catch(() =>
            fetch('/api/vram-history', { signal: AbortSignal.timeout(3000) }).then(r => r.json())
          )
          .catch(() => []),
        fetch(`${VILLAGE}/api/status`, { signal: AbortSignal.timeout(3000) })
          .then(r => r.json())
          .catch(() => null),
      ])

      if (psRes.status === 'fulfilled') {
        setRunning(psRes.value.models || [])
      }
      if (tagsRes.status === 'fulfilled') {
        setAvailable(tagsRes.value.models || [])
      }
      if (vramRes.status === 'fulfilled') {
        const data = Array.isArray(vramRes.value) ? vramRes.value : []
        setVramHistory(data)
      }
      if (villageRes.status === 'fulfilled' && villageRes.value) {
        setVillageStatus(villageRes.value)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Detect model swaps from VRAM history
  const modelSwaps: ModelSwap[] = []
  for (let i = 1; i < vramHistory.length; i++) {
    if (vramHistory[i].model !== vramHistory[i - 1].model) {
      modelSwaps.push({
        time: vramHistory[i].t,
        from: vramHistory[i - 1].model,
        to: vramHistory[i].model,
      })
    }
  }

  // Current VRAM stats
  const latestVram = vramHistory[vramHistory.length - 1]
  const vramPct = latestVram ? Math.round((latestVram.used / latestVram.total) * 100) : 0
  const currentModel = latestVram?.model || (running[0]?.name) || 'none'

  // Model usage stats from VRAM history
  const modelStats: Record<string, { count: number; avgGpu: number; avgVram: number }> = {}
  vramHistory.forEach(entry => {
    if (!modelStats[entry.model]) modelStats[entry.model] = { count: 0, avgGpu: 0, avgVram: 0 }
    modelStats[entry.model].count++
    modelStats[entry.model].avgGpu += entry.gpu
    modelStats[entry.model].avgVram += entry.used
  })
  Object.values(modelStats).forEach(s => {
    s.avgGpu = Math.round(s.avgGpu / s.count)
    s.avgVram = Math.round(s.avgVram / s.count)
  })

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{lm.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {running.length} {lm.active} &middot; {available.length} {lm.available} &middot; {modelSwaps.length} {lm.swaps}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            30s {lm.polling}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-28 rounded-lg bg-slate-700/30 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Current Active Model + VRAM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active model card */}
              <div className="bg-slate-800/60 rounded-xl border border-emerald-500/20 p-4">
                <div className="text-xs text-slate-500 font-medium mb-3">{lm.currentModel}</div>
                {running.length > 0 ? (
                  <div className="space-y-3">
                    {running.map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white">{m.name}</div>
                          <div className="text-[10px] text-slate-500">
                            VRAM: {formatBytes(m.size_vram / (1024 * 1024))} &middot; Size: {formatBytes(m.size / (1024 * 1024))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-slate-500" />
                    <div>
                      <div className="text-sm text-slate-400">{currentModel !== 'none' ? currentModel : lm.noActive}</div>
                      <div className="text-[10px] text-slate-600">{lm.noActiveHint}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* VRAM gauge */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
                <div className="text-xs text-slate-500 font-medium mb-3">{lm.vramUsage}</div>
                {latestVram ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-white">{vramPct}%</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {formatBytes(latestVram.used)} / {formatBytes(latestVram.total)}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          vramPct >= 90 ? 'bg-red-500' : vramPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${vramPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>GPU: {latestVram.gpu}%</span>
                      <span>{lm.freeVram}: {formatBytes(latestVram.total - latestVram.used)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">{lm.noData}</div>
                )}
              </div>
            </div>

            {/* VRAM History Chart */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 font-medium mb-2">{lm.vramChart}</div>
              {vramHistory.length > 2 ? (
                <VramChart data={vramHistory} />
              ) : (
                <div className="text-xs text-slate-500 py-8 text-center">{lm.noData}</div>
              )}
            </div>

            {/* Model Stats */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 font-medium mb-3">{lm.modelStats}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(modelStats).map(([model, stats]) => {
                  const timeMins = Math.round(stats.count * 0.5) // ~30s per entry
                  return (
                    <div key={model} className="rounded-lg border border-slate-700/40 p-3 bg-slate-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-bold text-white">{model}</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{lm.activeTime}</span>
                          <span className="text-slate-300 font-mono">{timeMins} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{lm.avgGpu}</span>
                          <span className="text-slate-300 font-mono">{stats.avgGpu}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{lm.avgVram}</span>
                          <span className="text-slate-300 font-mono">{formatBytes(stats.avgVram)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{lm.samples}</span>
                          <span className="text-slate-300 font-mono">{stats.count}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Model Swap History */}
            {modelSwaps.length > 0 && (
              <div className="bg-slate-800/60 rounded-xl border border-amber-500/20 p-4">
                <div className="text-xs text-amber-400 font-medium mb-3">{lm.swapHistory}</div>
                <div className="space-y-2">
                  {modelSwaps.map((swap, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500 font-mono w-16 shrink-0">
                        {timeLabel(swap.time)}
                      </span>
                      <span className="text-red-400 line-through">{swap.from}</span>
                      <span className="text-slate-600">&rarr;</span>
                      <span className="text-emerald-400 font-medium">{swap.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Models */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs text-slate-500 font-medium mb-3">
                {lm.availableModels} ({available.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {available.map((m, i) => {
                  const isActive = running.some(r => r.name === m.name)
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      isActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/40 bg-slate-900/20'
                    }`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white truncate">{m.name}</div>
                        <div className="text-[9px] text-slate-600">
                          {formatBytes(m.size / (1024 * 1024))}
                          {m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}
                          {m.details?.quantization_level ? ` · ${m.details.quantization_level}` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* LLM Village Status */}
            {villageStatus && (
              <div className="bg-slate-800/60 rounded-xl border border-cyan-500/20 p-4">
                <div className="text-xs text-cyan-400 font-medium mb-3">{lm.villageStatus}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  {villageStatus.day !== undefined && (
                    <div>
                      <div className="text-lg font-bold text-white">Day {villageStatus.day}</div>
                      <div className="text-[10px] text-slate-500">{lm.villageDay}</div>
                    </div>
                  )}
                  {villageStatus.npcs !== undefined && (
                    <div>
                      <div className="text-lg font-bold text-white">{villageStatus.npcs}</div>
                      <div className="text-[10px] text-slate-500">NPCs</div>
                    </div>
                  )}
                  {villageStatus.conversations !== undefined && (
                    <div>
                      <div className="text-lg font-bold text-white">{villageStatus.conversations}</div>
                      <div className="text-[10px] text-slate-500">{lm.conversations}</div>
                    </div>
                  )}
                  {villageStatus.total_tokens !== undefined && (
                    <div>
                      <div className="text-lg font-bold text-white">
                        {villageStatus.total_tokens >= 1000000
                          ? `${(villageStatus.total_tokens / 1000000).toFixed(1)}M`
                          : villageStatus.total_tokens.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">{lm.tokensGenerated}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
