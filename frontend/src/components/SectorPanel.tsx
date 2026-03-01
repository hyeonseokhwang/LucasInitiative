import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface SectorStock {
  symbol: string
  name: string
  price: number
  change_pct: number
}

interface SectorData {
  sector: string
  avg_change_pct: number
  total_market_cap: number
  stock_count: number
  stocks: SectorStock[]
}

const SECTOR_COLORS: Record<string, string> = {
  '반도체': 'border-blue-500 bg-blue-500/10',
  '인터넷/플랫폼': 'border-green-500 bg-green-500/10',
  '2차전지': 'border-yellow-500 bg-yellow-500/10',
  '자동차': 'border-orange-500 bg-orange-500/10',
  '바이오': 'border-pink-500 bg-pink-500/10',
  '금융': 'border-purple-500 bg-purple-500/10',
  'Technology': 'border-cyan-500 bg-cyan-500/10',
  'E-Commerce': 'border-amber-500 bg-amber-500/10',
  'Semiconductors': 'border-indigo-500 bg-indigo-500/10',
  'EV/Automotive': 'border-lime-500 bg-lime-500/10',
  'Social Media': 'border-rose-500 bg-rose-500/10',
}

function formatCap(cap: number) {
  if (!cap) return '-'
  if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}조`
  if (cap >= 1e8) return `${(cap / 1e8).toFixed(0)}억`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return cap.toLocaleString()
}

export function SectorPanel() {
  const [sectors, setSectors] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.sectors().then(d => {
      setSectors(d.sectors || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const changeCls = (v: number) => v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-slate-400'
  const changePrefix = (v: number) => v > 0 ? '+' : ''

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h2 className="text-white font-medium">Sector Analysis</h2>
        <p className="text-xs text-slate-500 mt-1">Performance by sector (sorted by avg change)</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-slate-500 mt-10 text-sm">Loading sectors...</div>
        ) : sectors.length === 0 ? (
          <div className="text-center text-slate-500 mt-10 text-sm">No sector data available</div>
        ) : (
          <>
            {/* Sector Performance Bar (heatmap-style) */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {sectors.map(s => {
                const intensity = Math.min(Math.abs(s.avg_change_pct) * 20, 100)
                const bg = s.avg_change_pct >= 0
                  ? `rgba(239, 68, 68, ${intensity / 100 * 0.6})`
                  : `rgba(59, 130, 246, ${intensity / 100 * 0.6})`
                return (
                  <div key={s.sector}
                    onClick={() => setExpanded(expanded === s.sector ? null : s.sector)}
                    className="rounded-lg px-4 py-3 cursor-pointer transition hover:scale-105 border border-slate-600/30"
                    style={{ backgroundColor: bg, minWidth: '120px' }}>
                    <div className="text-white font-medium text-sm">{s.sector}</div>
                    <div className={`text-lg font-bold ${changeCls(s.avg_change_pct)}`}>
                      {changePrefix(s.avg_change_pct)}{s.avg_change_pct}%
                    </div>
                    <div className="text-xs text-slate-400">{s.stock_count} stocks</div>
                  </div>
                )
              })}
            </div>

            {/* Sector Cards */}
            <div className="space-y-3">
              {sectors.map(s => (
                <div key={s.sector}
                  className={`rounded-lg border-l-4 ${SECTOR_COLORS[s.sector] || 'border-slate-500 bg-slate-500/10'} overflow-hidden`}>
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(expanded === s.sector ? null : s.sector)}>
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-medium">{s.sector}</h3>
                      <span className="text-xs text-slate-400">{s.stock_count} stocks</span>
                      <span className="text-xs text-slate-500">Cap: {formatCap(s.total_market_cap)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${changeCls(s.avg_change_pct)}`}>
                        {changePrefix(s.avg_change_pct)}{s.avg_change_pct}%
                      </span>
                      <span className="text-slate-500 text-sm">{expanded === s.sector ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded === s.sector && (
                    <div className="px-4 pb-3 border-t border-slate-700/30">
                      <table className="w-full text-sm mt-2">
                        <thead className="text-xs text-slate-500">
                          <tr>
                            <th className="text-left py-1">Stock</th>
                            <th className="text-right py-1">Price</th>
                            <th className="text-right py-1">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.stocks.map(st => (
                            <tr key={st.symbol} className="border-t border-slate-700/20">
                              <td className="py-1.5">
                                <span className="text-white">{st.name}</span>
                                <span className="text-xs text-slate-500 ml-1">{st.symbol.replace('.KS', '').replace('.KQ', '')}</span>
                              </td>
                              <td className="text-right text-white">{st.price.toLocaleString()}</td>
                              <td className={`text-right font-medium ${changeCls(st.change_pct)}`}>
                                {changePrefix(st.change_pct)}{st.change_pct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
