import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface Holding {
  id: number
  symbol: string
  name: string
  quantity: number
  avg_price: number
  sector: string
  market: string
  current_price: number
  change_pct: number
  invested: number
  value: number
  pnl: number
  pnl_pct: number
}

interface SectorAlloc {
  sector: string
  value: number
  pct: number
}

interface PortfolioData {
  holdings: Holding[]
  total_invested: number
  total_value: number
  total_pnl: number
  total_pnl_pct: number
  sectors: SectorAlloc[]
}

const SECTOR_COLORS: Record<string, string> = {
  '반도체': 'bg-blue-500',
  '인터넷/플랫폼': 'bg-green-500',
  '2차전지': 'bg-yellow-500',
  '자동차': 'bg-orange-500',
  '바이오': 'bg-pink-500',
  '금융': 'bg-purple-500',
  'Technology': 'bg-cyan-500',
  'E-Commerce': 'bg-amber-500',
  'Semiconductors': 'bg-indigo-500',
  'EV/Automotive': 'bg-lime-500',
  'Social Media': 'bg-rose-500',
  '기타': 'bg-slate-500',
}

export function PortfolioPanel() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [stockList, setStockList] = useState<any[]>([])

  // Add form state
  const [addSymbol, setAddSymbol] = useState('')
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addPrice, setAddPrice] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.portfolio()
      setData(res)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (showAdd && stockList.length === 0) {
      api.stockList().then(d => setStockList(d.stocks || []))
    }
  }, [showAdd, stockList.length])

  const handleAdd = async () => {
    if (!addSymbol || !addQty || !addPrice) return
    await api.addPortfolio({
      symbol: addSymbol,
      name: addName || addSymbol,
      quantity: parseFloat(addQty),
      avg_price: parseFloat(addPrice),
    })
    setAddSymbol('')
    setAddName('')
    setAddQty('')
    setAddPrice('')
    setShowAdd(false)
    load()
  }

  const handleDelete = async (id: number) => {
    await api.deletePortfolio(id)
    load()
  }

  const selectStock = (s: any) => {
    setAddSymbol(s.symbol)
    setAddName(s.name)
  }

  const changeCls = (v: number) => v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-slate-400'
  const changePrefix = (v: number) => v > 0 ? '+' : ''

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header with Summary */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-medium">Portfolio</h2>
          <button onClick={() => setShowAdd(!showAdd)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition">
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {data && data.holdings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-xs text-slate-500">Total Value</div>
              <div className="text-white font-bold text-lg">{data.total_value.toLocaleString('ko-KR')}원</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-xs text-slate-500">Invested</div>
              <div className="text-white font-medium">{data.total_invested.toLocaleString('ko-KR')}원</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-xs text-slate-500">P&L</div>
              <div className={`font-bold text-lg ${changeCls(data.total_pnl)}`}>
                {changePrefix(data.total_pnl)}{data.total_pnl.toLocaleString('ko-KR')}원
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-xs text-slate-500">Return</div>
              <div className={`font-bold text-lg ${changeCls(data.total_pnl_pct)}`}>
                {changePrefix(data.total_pnl_pct)}{data.total_pnl_pct}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="px-4 py-3 border-b border-slate-700/30 bg-slate-800/80">
          <div className="text-xs text-slate-400 mb-2">Select stock or enter manually:</div>
          <div className="flex flex-wrap gap-1 mb-3 max-h-24 overflow-y-auto">
            {stockList.map(s => (
              <button key={s.symbol} onClick={() => selectStock(s)}
                className={`text-xs px-2 py-1 rounded ${addSymbol === s.symbol ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input value={addSymbol} onChange={e => setAddSymbol(e.target.value)} placeholder="Symbol"
              className="bg-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500" />
            <input value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Quantity" type="number"
              className="bg-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500" />
            <input value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="Avg Price" type="number"
              className="bg-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={handleAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded px-3 py-1.5 transition">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-slate-500 mt-10 text-sm">Loading...</div>
        ) : !data || data.holdings.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">
            <p className="text-sm">No holdings yet</p>
            <p className="text-xs mt-1">Add stocks to track your portfolio</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row">
            {/* Holdings Table */}
            <div className="flex-1">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-700/30 sticky top-0 bg-slate-800/90">
                  <tr>
                    <th className="text-left px-4 py-2">Stock</th>
                    <th className="text-right px-2 py-2">Qty</th>
                    <th className="text-right px-2 py-2">Avg</th>
                    <th className="text-right px-2 py-2">Current</th>
                    <th className="text-right px-2 py-2">P&L</th>
                    <th className="text-right px-4 py-2">Return</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map(h => (
                    <tr key={h.id} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                      <td className="px-4 py-2.5">
                        <div className="text-white font-medium">{h.name}</div>
                        <div className="text-xs text-slate-500">{h.sector}</div>
                      </td>
                      <td className="text-right px-2 py-2.5 text-slate-300">{h.quantity}</td>
                      <td className="text-right px-2 py-2.5 text-slate-400">{h.avg_price.toLocaleString()}</td>
                      <td className="text-right px-2 py-2.5">
                        <div className="text-white">{h.current_price.toLocaleString()}</div>
                        <div className={`text-xs ${changeCls(h.change_pct)}`}>{changePrefix(h.change_pct)}{h.change_pct}%</div>
                      </td>
                      <td className={`text-right px-2 py-2.5 font-medium ${changeCls(h.pnl)}`}>
                        {changePrefix(h.pnl)}{h.pnl.toLocaleString()}
                      </td>
                      <td className={`text-right px-4 py-2.5 font-medium ${changeCls(h.pnl_pct)}`}>
                        {changePrefix(h.pnl_pct)}{h.pnl_pct}%
                      </td>
                      <td className="px-2 py-2.5">
                        <button onClick={() => handleDelete(h.id)}
                          className="text-xs text-slate-500 hover:text-red-400 transition">
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sector Allocation */}
            {data.sectors.length > 0 && (
              <div className="lg:w-64 p-4 border-t lg:border-t-0 lg:border-l border-slate-700/30">
                <h3 className="text-xs text-slate-500 font-medium mb-3">Sector Allocation</h3>
                {/* Simple bar chart */}
                <div className="space-y-2">
                  {data.sectors.map(s => (
                    <div key={s.sector}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{s.sector}</span>
                        <span className="text-slate-400">{s.pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${SECTOR_COLORS[s.sector] || 'bg-slate-500'}`}
                          style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
