import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, downloadExport } from '../lib/api'
import {
  ACCENT, SERIES_PALETTE, SURFACE,
  commonGridProps, commonTooltipProps,
} from '../lib/chartTheme'
import { useLocale } from '../hooks/useLocale'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface TrendRow {
  month: string
  district: string
  deal_type: string
  deal_count: number
  avg_price: number
  min_price: number
  max_price: number
  avg_area: number
}

interface CompareRow {
  district: string
  deal_count: number
  avg_price: number
  avg_price_per_m2: number
  min_price: number
  max_price: number
  avg_area: number
}

interface Deal {
  id: number
  district: string
  dong: string
  apt_name: string
  deal_type: string
  price: number
  deposit: number | null
  monthly: number | null
  area_m2: number
  floor: number
  deal_date: string
  recorded_at: string
}

const DEAL_TYPES_DATA = [
  { value: 'sale', koLabel: '매매', enLabel: 'Sale', color: ACCENT.blue },
  { value: 'jeonse', koLabel: '전세', enLabel: 'Jeonse', color: ACCENT.green },
  { value: 'monthly', koLabel: '월세', enLabel: 'Monthly', color: ACCENT.amber },
]

const DISTRICT_COLORS = SERIES_PALETTE

function formatPrice(price: number): string {
  if (price >= 10000) return `${(price / 10000).toFixed(1)}억`
  return `${price.toLocaleString()}만`
}

type Tab = 'trends' | 'compare' | 'deals'
type SortKey = 'deal_date' | 'district' | 'apt_name' | 'price' | 'area_m2' | 'floor'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

// Deal favorites (localStorage)
const FAV_DEALS_KEY = 'lucas-re-favorites'
function loadFavDeals(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_DEALS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function saveFavDeals(ids: Set<string>) {
  localStorage.setItem(FAV_DEALS_KEY, JSON.stringify([...ids]))
}

export function RealEstatePanel() {
  const { locale, t } = useLocale()
  const r = t.re
  const isKo = locale === 'ko'

  // Locale-aware deal types
  const DEAL_TYPES = useMemo(() =>
    DEAL_TYPES_DATA.map(dt => ({ ...dt, label: isKo ? dt.koLabel : dt.enLabel })),
    [isKo]
  )

  const [tab, setTab] = useState<Tab>('trends')
  const [districts, setDistricts] = useState<string[]>([])
  const [seoulMajor, setSeoulMajor] = useState<string[]>([])

  // Trends state
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [trendMonths, setTrendMonths] = useState(12)
  const [trendDealTypes, setTrendDealTypes] = useState<string[]>(['sale'])
  const [trendData, setTrendData] = useState<Record<string, TrendRow[]>>({})
  const [trendLoading, setTrendLoading] = useState(false)

  // Compare state
  const [compareDealType, setCompareDealType] = useState('sale')
  const [compareDistricts, setCompareDistricts] = useState<string[]>([])
  const [compareData, setCompareData] = useState<CompareRow[]>([])
  const [monthlyCompare, setMonthlyCompare] = useState<any[]>([])
  const [compareLoading, setCompareLoading] = useState(false)

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([])
  const [dealsDistrict, setDealsDistrict] = useState('')
  const [dealsDealType, setDealsDealType] = useState('')
  const [dealsLoading, setDealsLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('deal_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  // Apartment search
  const [aptSearch, setAptSearch] = useState('')

  // Price range filter (in 만원 units)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')

  // Favorites
  const [favDeals, setFavDeals] = useState<Set<string>>(() => loadFavDeals())
  const [showFavOnly, setShowFavOnly] = useState(false)

  const toggleFav = (id: number) => {
    const key = String(id)
    setFavDeals(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      saveFavDeals(next)
      return next
    })
  }

  useEffect(() => {
    api.reDistricts().then(d => {
      const distList = (d.districts || []).map((x: any) => x.district)
      setDistricts(distList)
      setSeoulMajor(d.seoul_major || [])
      const top3 = (d.seoul_major || distList).slice(0, 3)
      setCompareDistricts(top3)
    }).catch(() => {})
  }, [])

  // Load trends for selected deal types
  const loadTrends = useCallback(async () => {
    if (trendDealTypes.length === 0) return
    setTrendLoading(true)
    try {
      const results: Record<string, TrendRow[]> = {}
      await Promise.all(
        trendDealTypes.map(async dt => {
          const d = await api.reTrends(selectedDistrict || undefined, dt, trendMonths)
          results[dt] = d.trends || []
        })
      )
      setTrendData(results)
    } catch { setTrendData({}) }
    setTrendLoading(false)
  }, [selectedDistrict, trendDealTypes, trendMonths])

  useEffect(() => { if (tab === 'trends') loadTrends() }, [tab, loadTrends])

  // Merge trend data for multi-type chart
  const mergedTrendChart = useMemo(() => {
    const byMonth: Record<string, any> = {}
    for (const [dt, rows] of Object.entries(trendData)) {
      for (const r of rows) {
        if (!byMonth[r.month]) byMonth[r.month] = { month: r.month }
        byMonth[r.month][`avg_${dt}`] = r.avg_price
        byMonth[r.month][`count_${dt}`] = r.deal_count
      }
    }
    return Object.values(byMonth).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [trendData])

  // First active deal type's raw data for the table
  const trendTableRows = useMemo(() => {
    return Object.entries(trendData).flatMap(([, rows]) => rows)
  }, [trendData])

  // Load compare
  const loadCompare = useCallback(async () => {
    if (compareDistricts.length === 0) return
    setCompareLoading(true)
    try {
      const [snap, monthly] = await Promise.all([
        api.reCompare(compareDistricts.join(','), compareDealType, 6),
        api.reCompareMonthly(compareDistricts, compareDealType, 6),
      ])
      setCompareData(snap.comparison || [])
      setMonthlyCompare(monthly.comparison || [])
    } catch {
      setCompareData([])
      setMonthlyCompare([])
    }
    setCompareLoading(false)
  }, [compareDistricts, compareDealType])

  useEffect(() => { if (tab === 'compare') loadCompare() }, [tab, loadCompare])

  // Load deals
  const loadDeals = useCallback(async () => {
    setDealsLoading(true)
    try {
      const d = await api.reDeals(dealsDistrict || undefined, dealsDealType || undefined, 200)
      setDeals(d.deals || [])
      setPage(0)
    } catch { setDeals([]) }
    setDealsLoading(false)
  }, [dealsDistrict, dealsDealType])

  useEffect(() => { if (tab === 'deals') loadDeals() }, [tab, loadDeals])

  // Filter deals by apt search, price range, and favorites
  const sortedDeals = useMemo(() => {
    let filtered = deals
    if (showFavOnly) {
      filtered = filtered.filter(d => favDeals.has(String(d.id)))
    }
    if (aptSearch) {
      const q = aptSearch.toLowerCase()
      filtered = filtered.filter(d => d.apt_name?.toLowerCase().includes(q))
    }
    const minVal = priceMin ? Number(priceMin) : 0
    const maxVal = priceMax ? Number(priceMax) : Infinity
    if (minVal > 0 || maxVal < Infinity) {
      filtered = filtered.filter(d => d.price >= minVal && d.price <= maxVal)
    }
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return sorted
  }, [deals, sortKey, sortDir, aptSearch, priceMin, priceMax, showFavOnly, favDeals])

  const pagedDeals = useMemo(() => {
    return sortedDeals.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  }, [sortedDeals, page])

  const totalPages = Math.ceil(sortedDeals.length / PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  // Monthly comparison chart data
  const monthlyChartData = useMemo(() => {
    const byMonth: Record<string, any> = {}
    for (const row of monthlyCompare) {
      if (!byMonth[row.month]) byMonth[row.month] = { month: row.month }
      byMonth[row.month][row.district] = row.avg_price
    }
    return Object.values(byMonth).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [monthlyCompare])

  const toggleTrendDealType = (dt: string) => {
    setTrendDealTypes(prev =>
      prev.includes(dt) ? (prev.length > 1 ? prev.filter(x => x !== dt) : prev) : [...prev, dt]
    )
  }

  const toggleCompareDistrict = (d: string) => {
    setCompareDistricts(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].slice(0, 5)
    )
  }

  const districtList = seoulMajor.length > 0 ? seoulMajor : districts

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-medium">{r.title}</h2>
          <button onClick={() => downloadExport('/api/export/realestate?format=csv', 'realestate.csv')}
            className="px-2 py-1 text-[10px] rounded bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Export CSV">
            CSV
          </button>
        </div>
        <div className="flex gap-1">
          {(['trends', 'compare', 'deals'] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                tab === tb ? 'bg-blue-600/30 text-blue-400' : 'bg-slate-700/30 text-slate-400 hover:text-white'
              }`}>
              {{ trends: r.trends, compare: r.compare, deals: r.deals }[tb]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* === TRENDS TAB === */}
        {tab === 'trends' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}
                className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border border-slate-600">
                <option value="">{r.allDistricts}</option>
                {districtList.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={trendMonths} onChange={e => setTrendMonths(Number(e.target.value))}
                className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border border-slate-600">
                <option value={6}>{r.months6}</option>
                <option value={12}>{r.months12}</option>
                <option value={24}>{r.months24}</option>
              </select>
              <div className="flex gap-1 ml-2">
                {DEAL_TYPES.map(dt => (
                  <button key={dt.value} onClick={() => toggleTrendDealType(dt.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      trendDealTypes.includes(dt.value)
                        ? 'border-current text-white'
                        : 'border-slate-600/30 text-slate-500 hover:text-slate-300'
                    }`}
                    style={trendDealTypes.includes(dt.value) ? { color: dt.color, borderColor: dt.color + '80' } : {}}>
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            {trendLoading ? (
              <div className="text-center text-slate-500 py-10">{r.loadingTrends}</div>
            ) : mergedTrendChart.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <p className="text-sm">{r.noTrendData}</p>
                <p className="text-xs mt-1">{r.dataCollectedHourly}</p>
              </div>
            ) : (
              <>
                {/* Multi-type Price Trend Chart */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-sm text-slate-300 mb-3">
                    {r.avgPriceTrend} ({trendDealTypes.map(dt => DEAL_TYPES.find(tp => tp.value === dt)?.label).join(' / ')})
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mergedTrendChart}>
                      <CartesianGrid {...commonGridProps} />
                      <XAxis dataKey="month" tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} />
                      <YAxis tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} tickFormatter={v => formatPrice(v)} />
                      <Tooltip
                        {...commonTooltipProps}
                        formatter={(v) => [formatPrice(Number(v))]}
                      />
                      <Legend />
                      {trendDealTypes.map(dt => {
                        const info = DEAL_TYPES.find(t => t.value === dt)!
                        return (
                          <Line key={dt} type="monotone" dataKey={`avg_${dt}`} name={info.label}
                            stroke={info.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Deal Count Bar Chart */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-sm text-slate-300 mb-3">{r.monthlyDealCount}</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={mergedTrendChart}>
                      <CartesianGrid {...commonGridProps} />
                      <XAxis dataKey="month" tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} />
                      <YAxis tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} />
                      <Tooltip
                        {...commonTooltipProps}
                      />
                      <Legend />
                      {trendDealTypes.map(dt => {
                        const info = DEAL_TYPES.find(t => t.value === dt)!
                        return (
                          <Bar key={dt} dataKey={`count_${dt}`} name={info.label}
                            fill={info.color} radius={[4, 4, 0, 0]} />
                        )
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Trend Table */}
                <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="px-3 py-2 text-left">{r.month}</th>
                        <th className="px-3 py-2 text-left">{r.district}</th>
                        <th className="px-3 py-2 text-left">{r.type}</th>
                        <th className="px-3 py-2 text-right">{r.avg}</th>
                        <th className="px-3 py-2 text-right">{r.min}</th>
                        <th className="px-3 py-2 text-right">{r.maxPrice}</th>
                        <th className="px-3 py-2 text-right">{r.deals}</th>
                        <th className="px-3 py-2 text-right">{r.avgArea}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendTableRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="px-3 py-2 text-slate-300">{r.month}</td>
                          <td className="px-3 py-2 text-slate-300">{r.district}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              r.deal_type === 'sale' ? 'bg-blue-400/10 text-blue-400' :
                              r.deal_type === 'jeonse' ? 'bg-green-400/10 text-green-400' :
                              'bg-amber-400/10 text-amber-400'
                            }`}>{DEAL_TYPES.find(t => t.value === r.deal_type)?.label}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-blue-400 font-medium">{formatPrice(r.avg_price)}</td>
                          <td className="px-3 py-2 text-right text-green-400">{formatPrice(r.min_price)}</td>
                          <td className="px-3 py-2 text-right text-red-400">{formatPrice(r.max_price)}</td>
                          <td className="px-3 py-2 text-right text-slate-300">{r.deal_count}</td>
                          <td className="px-3 py-2 text-right text-slate-400">{r.avg_area?.toFixed(1)}m²</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* === COMPARE TAB === */}
        {tab === 'compare' && (
          <div className="space-y-4">
            {/* District selector chips + deal type */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">{r.type}:</span>
              <select value={compareDealType} onChange={e => setCompareDealType(e.target.value)}
                className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border border-slate-600">
                {DEAL_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
              </select>
            </div>
            <div className="flex gap-1 flex-wrap">
              {districtList.map((d) => (
                <button key={d} onClick={() => toggleCompareDistrict(d)}
                  className={`text-xs px-2 py-1 rounded-full transition ${
                    compareDistricts.includes(d)
                      ? 'text-white border'
                      : 'bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:text-white'
                  }`}
                  style={compareDistricts.includes(d) ? {
                    color: DISTRICT_COLORS[compareDistricts.indexOf(d) % DISTRICT_COLORS.length],
                    borderColor: DISTRICT_COLORS[compareDistricts.indexOf(d) % DISTRICT_COLORS.length] + '80',
                    backgroundColor: DISTRICT_COLORS[compareDistricts.indexOf(d) % DISTRICT_COLORS.length] + '20',
                  } : {}}>
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {compareDistricts.length}/5 {r.selected}
              {compareDistricts.length >= 5 && <span className="text-amber-400 ml-1">({r.max})</span>}
            </p>

            {compareLoading ? (
              <div className="text-center text-slate-500 py-10">{r.loadingCompare}</div>
            ) : compareData.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <p className="text-sm">{r.noCompareData}</p>
                <p className="text-xs mt-1">{r.selectDistrictsHint}</p>
              </div>
            ) : (
              <>
                {/* Average Price Bar */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-sm text-slate-300 mb-3">
                    {r.avgPriceByDistrict} ({DEAL_TYPES.find(tp => tp.value === compareDealType)?.label})
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={compareData}>
                      <CartesianGrid {...commonGridProps} />
                      <XAxis dataKey="district" tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} />
                      <YAxis tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} tickFormatter={v => formatPrice(v)} />
                      <Tooltip
                        {...commonTooltipProps}
                        formatter={(v, name) => [formatPrice(Number(v)), String(name)]}
                      />
                      <Legend />
                      <Bar dataKey="avg_price" name={r.avg} fill={ACCENT.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="avg_price_per_m2" name={r.perM2} fill={ACCENT.violet} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Trend Comparison */}
                {monthlyChartData.length > 0 && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <h3 className="text-sm text-slate-300 mb-3">{r.monthlyPriceCompare}</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={monthlyChartData}>
                        <CartesianGrid {...commonGridProps} />
                        <XAxis dataKey="month" tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} />
                        <YAxis tick={{ fill: SURFACE.textSecondary, fontSize: 11 }} tickFormatter={v => formatPrice(v)} />
                        <Tooltip
                          {...commonTooltipProps}
                          formatter={(v) => [formatPrice(Number(v))]}
                        />
                        <Legend />
                        {compareDistricts.map((d, i) => (
                          <Line key={d} type="monotone" dataKey={d}
                            stroke={DISTRICT_COLORS[i % DISTRICT_COLORS.length]}
                            strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Compare Table */}
                <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="px-3 py-2 text-left">{r.district}</th>
                        <th className="px-3 py-2 text-right">{r.avg}</th>
                        <th className="px-3 py-2 text-right">{r.perM2}</th>
                        <th className="px-3 py-2 text-right">{r.min}</th>
                        <th className="px-3 py-2 text-right">{r.maxPrice}</th>
                        <th className="px-3 py-2 text-right">{r.deals}</th>
                        <th className="px-3 py-2 text-right">{r.avgArea}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="px-3 py-2 font-medium" style={{ color: DISTRICT_COLORS[i % DISTRICT_COLORS.length] }}>{r.district}</td>
                          <td className="px-3 py-2 text-right text-blue-400 font-medium">{formatPrice(r.avg_price)}</td>
                          <td className="px-3 py-2 text-right text-purple-400">{formatPrice(r.avg_price_per_m2)}</td>
                          <td className="px-3 py-2 text-right text-green-400">{formatPrice(r.min_price)}</td>
                          <td className="px-3 py-2 text-right text-red-400">{formatPrice(r.max_price)}</td>
                          <td className="px-3 py-2 text-right text-slate-300">{r.deal_count}</td>
                          <td className="px-3 py-2 text-right text-slate-400">{r.avg_area?.toFixed(1)}m²</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* === DEALS TAB === */}
        {tab === 'deals' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <select value={dealsDistrict} onChange={e => { setDealsDistrict(e.target.value) }}
                className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border border-slate-600">
                <option value="">{r.allDistricts}</option>
                {districtList.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={dealsDealType} onChange={e => setDealsDealType(e.target.value)}
                className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border border-slate-600">
                <option value="">{r.allTypes}</option>
                {DEAL_TYPES.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
              </select>
              <button onClick={loadDeals}
                className="text-xs px-3 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition">
                {r.refresh}
              </button>
              <button onClick={() => setShowFavOnly(!showFavOnly)}
                className={`text-xs px-3 py-1 rounded flex items-center gap-1 transition ${
                  showFavOnly
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-700/30 text-slate-400 hover:text-white border border-slate-600/30'
                }`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill={showFavOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {favDeals.size > 0 ? `Favorites (${favDeals.size})` : 'Favorites'}
              </button>
              <span className="text-xs text-slate-500 ml-auto">{sortedDeals.length} {r.deals_count}</span>
            </div>

            {/* Apartment search + Price range filter */}
            <div className="flex gap-2 flex-wrap items-center">
              <input
                type="text"
                value={aptSearch}
                onChange={e => { setAptSearch(e.target.value); setPage(0) }}
                placeholder={r.searchAptPlaceholder}
                className="flex-1 min-w-[150px] px-2 py-1 text-xs bg-slate-900/50 border border-slate-600/50 rounded
                  text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <input
                type="number"
                value={priceMin}
                onChange={e => { setPriceMin(e.target.value); setPage(0) }}
                placeholder={r.priceMin}
                className="w-28 px-2 py-1 text-xs bg-slate-900/50 border border-slate-600/50 rounded
                  text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-xs text-slate-600">~</span>
              <input
                type="number"
                value={priceMax}
                onChange={e => { setPriceMax(e.target.value); setPage(0) }}
                placeholder={r.priceMax}
                className="w-28 px-2 py-1 text-xs bg-slate-900/50 border border-slate-600/50 rounded
                  text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              {(aptSearch || priceMin || priceMax) && (
                <button
                  onClick={() => { setAptSearch(''); setPriceMin(''); setPriceMax(''); setPage(0) }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {t.reset}
                </button>
              )}
            </div>

            {dealsLoading ? (
              <div className="text-center text-slate-500 py-10">{t.loading}</div>
            ) : deals.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <p className="text-sm">{r.noRecentDeals}</p>
              </div>
            ) : (
              <>
                <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="px-2 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left cursor-pointer hover:text-white select-none" onClick={() => handleSort('deal_date')}>
                          {r.date}{sortIcon('deal_date')}
                        </th>
                        <th className="px-3 py-2 text-left cursor-pointer hover:text-white select-none" onClick={() => handleSort('district')}>
                          {r.district}{sortIcon('district')}
                        </th>
                        <th className="px-3 py-2 text-left cursor-pointer hover:text-white select-none" onClick={() => handleSort('apt_name')}>
                          {r.apt}{sortIcon('apt_name')}
                        </th>
                        <th className="px-3 py-2 text-left">{r.type}</th>
                        <th className="px-3 py-2 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('price')}>
                          {r.priceLabel}{sortIcon('price')}
                        </th>
                        <th className="px-3 py-2 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('area_m2')}>
                          {r.area}{sortIcon('area_m2')}
                        </th>
                        <th className="px-3 py-2 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('floor')}>
                          {r.floor}{sortIcon('floor')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedDeals.map(d => (
                        <tr key={d.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${favDeals.has(String(d.id)) ? 'bg-amber-500/5' : ''}`}>
                          <td className="px-2 py-2">
                            <button onClick={() => toggleFav(d.id)}
                              className={`transition-colors ${favDeals.has(String(d.id)) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill={favDeals.has(String(d.id)) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-slate-400">{d.deal_date}</td>
                          <td className="px-3 py-2 text-slate-300">{d.district} {d.dong || ''}</td>
                          <td className="px-3 py-2 text-white font-medium truncate max-w-[120px]">{d.apt_name || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              d.deal_type === 'sale' ? 'bg-blue-400/10 text-blue-400' :
                              d.deal_type === 'jeonse' ? 'bg-green-400/10 text-green-400' :
                              'bg-amber-400/10 text-amber-400'
                            }`}>
                              {DEAL_TYPES.find(t => t.value === d.deal_type)?.label || d.deal_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-blue-400 font-medium">
                            {formatPrice(d.price)}
                            {d.deal_type === 'monthly' && d.monthly ? ` / ${d.monthly}만` : ''}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">{d.area_m2?.toFixed(1)}m²</td>
                          <td className="px-3 py-2 text-right text-slate-400">{d.floor || '-'}F</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="text-xs px-3 py-1.5 rounded bg-slate-700/50 text-slate-400 hover:text-white disabled:opacity-30 transition">
                      {r.prev}
                    </button>
                    <span className="text-xs text-slate-400">
                      {page + 1} / {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="text-xs px-3 py-1.5 rounded bg-slate-700/50 text-slate-400 hover:text-white disabled:opacity-30 transition">
                      {r.next}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
