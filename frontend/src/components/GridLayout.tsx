import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { SystemSnapshot } from '../types'
import type { GridPanel, LayoutPreset } from '../hooks/useLayoutSettings'
import { GRID_PANEL_LABELS, PRESET_LABELS, PRESET_COLS, PRESET_MAX } from '../hooks/useLayoutSettings'

interface Props {
  selectedPanels: GridPanel[]
  preset: LayoutPreset
  onTogglePanel: (panel: GridPanel) => void
  onSetPreset: (preset: LayoutPreset) => void
  onNavigate: (view: string) => void
  metrics: SystemSnapshot | null
}

// ─── Mini Panel Components ───

function MiniSystem({ metrics }: { metrics: SystemSnapshot | null }) {
  if (!metrics) return <div className="text-xs text-slate-500">No data</div>
  const vram = metrics.gpu.mem_total_mb > 0 ? (metrics.gpu.mem_used_mb / metrics.gpu.mem_total_mb * 100) : 0
  return (
    <div className="space-y-2">
      <MiniBar label="CPU" value={metrics.cpu.percent} color="bg-blue-500" />
      <MiniBar label="GPU" value={metrics.gpu.util_percent} color="bg-emerald-500" />
      <MiniBar label="RAM" value={metrics.ram.percent} color="bg-purple-500" />
      <MiniBar label="VRAM" value={vram} color="bg-orange-500" />
      <div className="flex justify-between text-xs text-slate-400 pt-1">
        <span>{metrics.gpu.temp_c}°C</span>
        <span className={metrics.ollama?.running ? 'text-emerald-400' : 'text-slate-500'}>
          Ollama {metrics.ollama?.running ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  )
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-[10px] text-slate-300 font-mono w-8 text-right">{Math.round(value)}%</span>
    </div>
  )
}

function MiniStocks() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.indices().then(r => setData(r.indices || [])).catch(() => {}) }, [])
  return (
    <div className="space-y-1.5">
      {data.slice(0, 5).map((s: any, i: number) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="text-slate-400 truncate mr-2">{s.name || s.symbol}</span>
          <div className="flex gap-2">
            <span className="text-white font-mono">{Number(s.price || 0).toLocaleString()}</span>
            <span className={`font-mono w-14 text-right ${(s.change_pct || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {(s.change_pct || 0) >= 0 ? '+' : ''}{Number(s.change_pct || 0).toFixed(2)}%
            </span>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-500">Loading...</div>}
    </div>
  )
}

function MiniPortfolio() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.portfolio().then(setData).catch(() => {}) }, [])
  if (!data) return <div className="text-xs text-slate-500">Loading...</div>
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Holdings</span>
        <span className="text-white">{data.holdings?.length || 0} stocks</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Value</span>
        <span className="text-white font-mono">{Math.round(data.total_value || 0).toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">P&L</span>
        <span className={`font-mono font-semibold ${(data.total_pnl || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
          {(data.total_pnl || 0) >= 0 ? '+' : ''}{Number(data.total_pnl_pct || 0).toFixed(2)}%
        </span>
      </div>
      {(data.holdings || []).slice(0, 3).map((h: any) => (
        <div key={h.id} className="flex justify-between text-[11px]">
          <span className="text-slate-400 truncate mr-2">{h.symbol}</span>
          <span className={`font-mono ${(h.pnl || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
            {(h.pnl_pct || 0) >= 0 ? '+' : ''}{Number(h.pnl_pct || 0).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

function MiniSectors() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.sectors().then(r => setData(r.sectors || [])).catch(() => {}) }, [])
  return (
    <div className="space-y-1.5">
      {data.slice(0, 6).map((s: any, i: number) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="text-slate-400 truncate mr-2">{s.sector}</span>
          <span className={`font-mono ${(s.avg_change || 0) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
            {(s.avg_change || 0) >= 0 ? '+' : ''}{Number(s.avg_change || 0).toFixed(2)}%
          </span>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-500">Loading...</div>}
    </div>
  )
}

function MiniRealEstate() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.reCompare().then(r => setData(r.comparison || [])).catch(() => {}) }, [])
  return (
    <div className="space-y-1.5">
      {data.slice(0, 5).map((d: any, i: number) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="text-slate-400 truncate mr-2">{d.district}</span>
          <div className="flex gap-2">
            <span className="text-white font-mono">{Number(d.avg_price || 0).toLocaleString()}</span>
            <span className="text-slate-500">{d.deal_count}건</span>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-500">Loading...</div>}
    </div>
  )
}

function MiniWatchlist() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.reWatchlist().then(r => setData(r.watchlist || [])).catch(() => {}) }, [])
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-400 mb-1">{data.length} items</div>
      {data.slice(0, 4).map((w: any) => (
        <div key={w.id} className="flex justify-between text-xs">
          <span className="text-slate-300 truncate mr-2">{w.apt_name || w.dong || w.district}</span>
          {w.recent_avg_price && <span className="text-white font-mono">{Number(w.recent_avg_price).toLocaleString()}만</span>}
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-500">No items</div>}
    </div>
  )
}

function MiniReports() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.researchReports(3).then(r => setData(r.reports || [])).catch(() => {}) }, [])
  return (
    <div className="space-y-2">
      {data.slice(0, 3).map((r: any) => (
        <div key={r.id}>
          <div className="text-xs text-white line-clamp-1">{r.title}</div>
          <div className="text-[10px] text-slate-500">{r.created_at?.slice(0, 10)}</div>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-500">No reports</div>}
    </div>
  )
}

function MiniResearch() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.researchReports(3).then(r => setData(r.reports || [])).catch(() => {}) }, [])
  return (
    <div className="space-y-2">
      {data.slice(0, 3).map((r: any) => (
        <div key={r.id}>
          <div className="text-xs text-white line-clamp-1">{r.title}</div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className={`font-mono ${(r.confidence_avg || 0) >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {((r.confidence_avg || 0) * 100).toFixed(0)}%
            </span>
            <span className="text-slate-500">{r.evidence_count} evidence</span>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-500">No research</div>}
    </div>
  )
}

function MiniSchedule() {
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api.schedules().then(r => setData(r.schedules || [])).catch(() => {}) }, [])
  const upcoming = data.filter(s => new Date(s.start_at) >= new Date()).slice(0, 4)
  return (
    <div className="space-y-1.5">
      {upcoming.length > 0 ? upcoming.map((s: any) => (
        <div key={s.id} className="flex justify-between text-xs">
          <span className="text-slate-300 truncate mr-2">{s.title}</span>
          <span className="text-slate-500 shrink-0">{s.start_at?.slice(5, 10)}</span>
        </div>
      )) : (
        <div className="text-xs text-slate-500">No upcoming events</div>
      )}
    </div>
  )
}

function MiniExpense() {
  const [data, setData] = useState<any>(null)
  const month = new Date().toISOString().slice(0, 7)
  useEffect(() => { api.expenseSummary(month).then(setData).catch(() => {}) }, [month])
  if (!data) return <div className="text-xs text-slate-500">Loading...</div>
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Income</span>
        <span className="text-emerald-400 font-mono">{(data.total_income || 0).toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Expense</span>
        <span className="text-red-400 font-mono">{(data.total_expense || 0).toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1">
        <span className="text-slate-400">Balance</span>
        <span className={`font-mono font-semibold ${(data.balance || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {(data.balance || 0).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// ─── Panel Renderer ───

const PANEL_COMPONENTS: Record<GridPanel, React.FC<{ metrics?: SystemSnapshot | null }>> = {
  system: ({ metrics }) => <MiniSystem metrics={metrics ?? null} />,
  stocks: () => <MiniStocks />,
  portfolio: () => <MiniPortfolio />,
  sectors: () => <MiniSectors />,
  realestate: () => <MiniRealEstate />,
  watchlist: () => <MiniWatchlist />,
  reports: () => <MiniReports />,
  research: () => <MiniResearch />,
  schedule: () => <MiniSchedule />,
  expense: () => <MiniExpense />,
}

const ALL_PANELS: GridPanel[] = ['system', 'stocks', 'portfolio', 'sectors', 'realestate', 'watchlist', 'reports', 'research', 'schedule', 'expense']

// Map grid panel to focus view tab name
const PANEL_TO_VIEW: Record<GridPanel, string> = {
  system: 'dashboard', stocks: 'stocks', portfolio: 'portfolio', sectors: 'sectors',
  realestate: 'realestate', watchlist: 'watchlist', reports: 'reports',
  research: 'research', schedule: 'schedule', expense: 'expense',
}

// ─── Main Grid Layout ───

export function GridLayout({ selectedPanels, preset, onTogglePanel, onSetPreset, onNavigate, metrics }: Props) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const cols = PRESET_COLS[preset]
  const max = PRESET_MAX[preset]

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Preset buttons */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
          {(Object.keys(PRESET_LABELS) as LayoutPreset[]).map(p => (
            <button
              key={p}
              onClick={() => onSetPreset(p)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                preset === p ? 'bg-blue-600/80 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Panel selector toggle */}
        <button
          onClick={() => setSelectorOpen(v => !v)}
          className="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          Panels ({selectedPanels.length}/{max})
        </button>

        <span className="text-[10px] text-slate-500">Click a panel to open full view</span>
      </div>

      {/* Panel Selector */}
      {selectorOpen && (
        <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          {ALL_PANELS.map(panel => {
            const selected = selectedPanels.includes(panel)
            const disabled = !selected && selectedPanels.length >= max
            return (
              <button
                key={panel}
                onClick={() => onTogglePanel(panel)}
                disabled={disabled}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  selected
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : disabled
                      ? 'border-slate-700/30 text-slate-600 cursor-not-allowed'
                      : 'border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                {GRID_PANEL_LABELS[panel]}
              </button>
            )
          })}
        </div>
      )}

      {/* Grid */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {selectedPanels.slice(0, max).map(panel => {
          const Comp = PANEL_COMPONENTS[panel]
          return (
            <button
              key={panel}
              onClick={() => onNavigate(PANEL_TO_VIEW[panel])}
              className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50
                hover:border-blue-500/40 hover:bg-slate-800/80 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-300">{GRID_PANEL_LABELS[panel]}</h3>
                <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">
                  Open &rarr;
                </span>
              </div>
              <Comp metrics={metrics} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
