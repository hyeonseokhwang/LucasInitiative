import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useLocale } from '../hooks/useLocale'

interface Signal {
  symbol: string
  name: string
  type: 'golden_cross' | 'death_cross' | 'rsi_oversold' | 'rsi_overbought' | 'volume_breakout'
  detail: string
  price: number
  date: string
  strength: 'strong' | 'moderate'
}

const SIGNAL_CONFIG: Record<string, { action: 'buy' | 'sell' | 'caution'; color: string; bgColor: string; borderColor: string; icon: string }> = {
  golden_cross:    { action: 'buy',     color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: '↗' },
  death_cross:     { action: 'sell',    color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30',     icon: '↘' },
  rsi_oversold:    { action: 'buy',     color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', icon: '↗' },
  rsi_overbought:  { action: 'sell',    color: 'text-red-400',     bgColor: 'bg-red-500/10',     borderColor: 'border-red-500/30',     icon: '↘' },
  volume_breakout: { action: 'caution', color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   borderColor: 'border-amber-500/30',   icon: '⚡' },
}

export function SignalPanel() {
  const { t } = useLocale()
  const s = t.sig

  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)

  const loadSignals = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.signals(100)
      setSignals(data.signals || [])
    } catch { setSignals([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSignals() }, [loadSignals])

  const handleScan = async () => {
    setScanning(true)
    try {
      const data = await api.signalScan()
      setSignals(data.signals || [])
      setLastScan(new Date().toLocaleTimeString())
    } catch { /* ignore */ }
    finally { setScanning(false) }
  }

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      golden_cross: s.goldenCross,
      death_cross: s.deathCross,
      rsi_oversold: s.rsiOversold,
      rsi_overbought: s.rsiOverbought,
      volume_breakout: s.volumeBreakout,
    }
    return map[type] || type
  }

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = { buy: s.buy, sell: s.sell, caution: s.caution }
    return map[action] || action
  }

  const getStrengthLabel = (str: string) => {
    return str === 'strong' ? s.strong : s.moderate
  }

  // Group signals by date
  const groupedByDate = signals.reduce<Record<string, Signal[]>>((acc, sig) => {
    const key = sig.date || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(sig)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedByDate).sort().reverse()

  // Counts by action type
  const buys = signals.filter(sg => {
    const cfg = SIGNAL_CONFIG[sg.type]
    return cfg?.action === 'buy'
  }).length
  const sells = signals.filter(sg => {
    const cfg = SIGNAL_CONFIG[sg.type]
    return cfg?.action === 'sell'
  }).length
  const cautions = signals.filter(sg => {
    const cfg = SIGNAL_CONFIG[sg.type]
    return cfg?.action === 'caution'
  }).length

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">{s.title}</h2>
          <div className="flex items-center gap-2">
            {lastScan && (
              <span className="text-xs text-slate-500">{s.lastScan}: {lastScan}</span>
            )}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30
                hover:bg-blue-600/30 transition-colors disabled:opacity-50"
            >
              {scanning ? s.scanning : s.scan}
            </button>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-400 text-sm font-bold">{buys}</span>
            <span className="text-xs text-emerald-400/70">{s.buy}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
            <span className="text-red-400 text-sm font-bold">{sells}</span>
            <span className="text-xs text-red-400/70">{s.sell}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-400 text-sm font-bold">{cautions}</span>
            <span className="text-xs text-amber-400/70">{s.caution}</span>
          </div>
          <span className="text-xs text-slate-500 self-center ml-auto">
            {signals.length} {s.signalCount}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            {t.loading}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <p className="text-sm">{s.noSignals}</p>
            <p className="text-xs mt-1">{s.noSignalsHint}</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                {/* Date header */}
                <div className="text-xs text-slate-500 font-medium mb-2 sticky top-0 bg-slate-800/80 py-1">
                  {date}
                  <span className="ml-2 text-slate-600">({groupedByDate[date].length})</span>
                </div>

                {/* Signal cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {groupedByDate[date].map((sig, idx) => {
                    const cfg = SIGNAL_CONFIG[sig.type] || SIGNAL_CONFIG.volume_breakout
                    return (
                      <div
                        key={`${sig.symbol}-${sig.type}-${idx}`}
                        className={`rounded-lg border p-3 transition-colors hover:bg-slate-700/20 ${cfg.bgColor} ${cfg.borderColor}`}
                      >
                        {/* Top row: icon + name + action badge */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-lg ${cfg.color}`}>{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white truncate block">{sig.name}</span>
                            <span className="text-[10px] text-slate-500">{sig.symbol}</span>
                          </div>
                          <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            cfg.action === 'buy' ? 'bg-emerald-500/20 text-emerald-400' :
                            cfg.action === 'sell' ? 'bg-red-500/20 text-red-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {getActionLabel(cfg.action)}
                          </span>
                        </div>

                        {/* Signal type + strength */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${cfg.color}`}>
                            {getTypeLabel(sig.type)}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            sig.strength === 'strong'
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-600/30 text-slate-400'
                          }`}>
                            {getStrengthLabel(sig.strength)}
                          </span>
                        </div>

                        {/* Detail + Price */}
                        <div className="text-xs text-slate-400 leading-relaxed">{sig.detail}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {sig.price.toLocaleString()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Compact signal badges for use in StockPanel */
export function SignalBadges({ symbol, signals }: { symbol: string; signals: Signal[] }) {
  const matched = signals.filter(s => s.symbol === symbol || s.symbol === symbol.replace('.KS', '').replace('.KQ', ''))
  if (matched.length === 0) return null

  return (
    <div className="flex gap-0.5 flex-wrap">
      {matched.map((sig, i) => {
        const cfg = SIGNAL_CONFIG[sig.type] || SIGNAL_CONFIG.volume_breakout
        return (
          <span
            key={i}
            className={`inline-block px-1 py-0.5 text-[9px] rounded ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}
            title={sig.detail}
          >
            {cfg.icon}
          </span>
        )
      })}
    </div>
  )
}
