import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../lib/api'

interface WatchItem {
  id: number
  district: string
  dong: string | null
  apt_name: string | null
  deal_type: string
  memo: string | null
  target_price: number | null
  created_at: string
  recent_avg_price?: number
  recent_deal_count?: number
}

const DEAL_TYPES = [
  { value: 'sale', label: '매매' },
  { value: 'jeonse', label: '전세' },
  { value: 'monthly', label: '월세' },
]

const DISTRICTS = [
  '강남구', '서초구', '송파구', '강동구', '마포구',
  '용산구', '성동구', '광진구', '영등포구', '동작구',
]

function formatPrice(price: number): string {
  if (price >= 10000) return `${(price / 10000).toFixed(1)}억`
  return `${price.toLocaleString()}만`
}

export function WatchlistPanel() {
  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formDistrict, setFormDistrict] = useState('강남구')
  const [formDong, setFormDong] = useState('')
  const [formApt, setFormApt] = useState('')
  const [formDealType, setFormDealType] = useState('sale')
  const [formMemo, setFormMemo] = useState('')
  const [formTarget, setFormTarget] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Autocomplete data
  const [dongList, setDongList] = useState<string[]>([])
  const [aptList, setAptList] = useState<string[]>([])
  const [showDongDropdown, setShowDongDropdown] = useState(false)
  const [showAptDropdown, setShowAptDropdown] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.reWatchlist()
      setItems(d.watchlist || [])
    } catch { setItems([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Load dong/apt autocomplete when district changes
  useEffect(() => {
    if (!formDistrict) return
    api.reDeals(formDistrict, undefined, 200).then(d => {
      const deals = d.deals || []
      const dongs = [...new Set(deals.map((x: any) => x.dong).filter(Boolean))].sort()
      const apts = [...new Set(deals.map((x: any) => x.apt_name).filter(Boolean))].sort()
      setDongList(dongs as string[])
      setAptList(apts as string[])
    }).catch(() => {
      setDongList([])
      setAptList([])
    })
  }, [formDistrict])

  // Filtered suggestions
  const filteredDongs = useMemo(() => {
    if (!formDong) return dongList
    return dongList.filter(d => d.includes(formDong))
  }, [dongList, formDong])

  const filteredApts = useMemo(() => {
    if (!formApt) return aptList
    return aptList.filter(a => a.includes(formApt))
  }, [aptList, formApt])

  const handleAdd = async () => {
    if (!formDistrict) return
    setSubmitting(true)
    try {
      await api.reWatchlistAdd({
        district: formDistrict,
        dong: formDong || undefined,
        apt_name: formApt || undefined,
        deal_type: formDealType,
        memo: formMemo || undefined,
        target_price: formTarget ? Number(formTarget) : undefined,
      })
      setShowForm(false)
      setFormDong('')
      setFormApt('')
      setFormMemo('')
      setFormTarget('')
      await load()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const handleDelete = async (id: number) => {
    try {
      await api.reWatchlistDelete(id)
      setItems(prev => prev.filter(x => x.id !== id))
    } catch { /* ignore */ }
  }

  // Target achievement calculation
  const getAchievement = (item: WatchItem) => {
    if (item.target_price == null || item.recent_avg_price == null || item.target_price === 0) return null
    // For sale: lower current price is better (buyer perspective)
    // ratio = target / current — >1 means current is below target (good for buyer)
    const ratio = item.target_price / item.recent_avg_price
    const pctDiff = ((item.recent_avg_price - item.target_price) / item.target_price) * 100
    return { ratio, pctDiff }
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-medium">Watchlist</h2>
          <span className="text-xs text-slate-500">{items.length} items</span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition">
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">District *</label>
              <select value={formDistrict} onChange={e => { setFormDistrict(e.target.value); setFormDong(''); setFormApt('') }}
                className="w-full text-xs bg-slate-700 text-slate-300 rounded px-2 py-1.5 border border-slate-600">
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="text-[10px] text-slate-500 block mb-0.5">Dong</label>
              <input value={formDong}
                onChange={e => { setFormDong(e.target.value); setShowDongDropdown(true) }}
                onFocus={() => setShowDongDropdown(true)}
                onBlur={() => setTimeout(() => setShowDongDropdown(false), 150)}
                placeholder={dongList.length ? `${dongList[0]} ...` : 'Enter dong'}
                className="w-full text-xs bg-slate-700 text-slate-300 rounded px-2 py-1.5 border border-slate-600" />
              {showDongDropdown && filteredDongs.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-slate-700 border border-slate-600 rounded shadow-lg max-h-32 overflow-y-auto">
                  {filteredDongs.map(d => (
                    <button key={d} type="button"
                      onMouseDown={e => { e.preventDefault(); setFormDong(d); setShowDongDropdown(false) }}
                      className="w-full text-left text-xs px-2 py-1.5 text-slate-300 hover:bg-slate-600 transition">
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="text-[10px] text-slate-500 block mb-0.5">Apartment</label>
              <input value={formApt}
                onChange={e => { setFormApt(e.target.value); setShowAptDropdown(true) }}
                onFocus={() => setShowAptDropdown(true)}
                onBlur={() => setTimeout(() => setShowAptDropdown(false), 150)}
                placeholder={aptList.length ? `${aptList[0]} ...` : 'Enter apt name'}
                className="w-full text-xs bg-slate-700 text-slate-300 rounded px-2 py-1.5 border border-slate-600" />
              {showAptDropdown && filteredApts.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-slate-700 border border-slate-600 rounded shadow-lg max-h-32 overflow-y-auto">
                  {filteredApts.map(a => (
                    <button key={a} type="button"
                      onMouseDown={e => { e.preventDefault(); setFormApt(a); setShowAptDropdown(false) }}
                      className="w-full text-left text-xs px-2 py-1.5 text-slate-300 hover:bg-slate-600 transition">
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Deal Type</label>
              <select value={formDealType} onChange={e => setFormDealType(e.target.value)}
                className="w-full text-xs bg-slate-700 text-slate-300 rounded px-2 py-1.5 border border-slate-600">
                {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Target Price (만원)</label>
              <input type="number" value={formTarget} onChange={e => setFormTarget(e.target.value)}
                placeholder="e.g. 80000"
                className="w-full text-xs bg-slate-700 text-slate-300 rounded px-2 py-1.5 border border-slate-600" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Memo</label>
              <input value={formMemo} onChange={e => setFormMemo(e.target.value)}
                placeholder="Notes..."
                className="w-full text-xs bg-slate-700 text-slate-300 rounded px-2 py-1.5 border border-slate-600" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={submitting || !formDistrict}
            className="w-full text-xs py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
            {submitting ? 'Adding...' : 'Add to Watchlist'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-slate-500 py-10">Loading watchlist...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-500 py-10">
            <p className="text-sm">No items in watchlist</p>
            <p className="text-xs mt-1">Click "+ Add" to track properties</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const ach = getAchievement(item)
              return (
                <div key={item.id}
                  className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm truncate">
                          {item.apt_name || item.district}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          item.deal_type === 'sale' ? 'bg-blue-400/10 text-blue-400' :
                          item.deal_type === 'jeonse' ? 'bg-green-400/10 text-green-400' :
                          'bg-amber-400/10 text-amber-400'
                        }`}>
                          {DEAL_TYPES.find(t => t.value === item.deal_type)?.label || item.deal_type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.district}{item.dong ? ` ${item.dong}` : ''}
                      </div>
                      {item.memo && (
                        <div className="text-xs text-slate-500 mt-1">{item.memo}</div>
                      )}

                      {/* Price info */}
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {item.target_price != null && (
                          <span className="text-amber-400">
                            Target: {formatPrice(item.target_price)}
                          </span>
                        )}
                        {item.recent_avg_price != null && (
                          <span className="text-blue-400">
                            Current: {formatPrice(item.recent_avg_price)}
                          </span>
                        )}
                        {item.recent_deal_count != null && item.recent_deal_count > 0 && (
                          <span className="text-slate-500">
                            {item.recent_deal_count} deals (3mo)
                          </span>
                        )}
                      </div>

                      {/* Target Achievement Bar */}
                      {ach && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className={ach.pctDiff > 0 ? 'text-red-400' : 'text-green-400'}>
                              {ach.pctDiff > 0
                                ? `${ach.pctDiff.toFixed(1)}% above target`
                                : `${Math.abs(ach.pctDiff).toFixed(1)}% below target`
                              }
                            </span>
                            <span className="text-slate-500">
                              {formatPrice(item.recent_avg_price!)} / {formatPrice(item.target_price!)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                ach.pctDiff <= 0 ? 'bg-green-500' :
                                ach.pctDiff <= 10 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, ach.ratio * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleDelete(item.id)}
                      className="text-slate-500 hover:text-red-400 text-xs ml-2 p-1 transition" title="Remove">
                      x
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-2">
                    Added: {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
