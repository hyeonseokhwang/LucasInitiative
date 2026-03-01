import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from 'lightweight-charts'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api, downloadExport } from '../lib/api'
import { ACCENT, CANDLE, SERIES_PALETTE, lwcLayout, lwcGrid, lwcScaleBorder } from '../lib/chartTheme'
import { useLocale } from '../hooks/useLocale'
import { SignalBadges } from './SignalPanel'
import { RefreshIndicator } from './RefreshIndicator'

interface StockItem {
  symbol: string
  name: string
  market: string
  price: number
  change_pct: number
  prev_close: number
  market_cap: number
  open_price: number
  high: number
  low: number
  volume: number
  sector?: string
}

interface IndexItem {
  symbol: string
  name: string
  region: string
  price: number
  change_pct: number
}

const PERIODS = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
]

function formatPrice(price: number, market: string) {
  if (market === 'US') return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  return `${price.toLocaleString('ko-KR')}원`
}

function formatCap(cap: number) {
  if (!cap) return '-'
  if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}조`
  if (cap >= 1e8) return `${(cap / 1e8).toFixed(0)}억`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return cap.toLocaleString()
}

// Convert API indicator data [{date, value}] to LineData[]
function toLineData(arr: { date: string; value: number }[] | undefined): LineData[] {
  if (!arr) return []
  return arr.map(d => ({ time: d.date as Time, value: d.value }))
}

type IndicatorToggle = {
  ma: boolean
  bollinger: boolean
  rsi: boolean
  macd: boolean
}

function StockChart({ symbol }: { symbol: string }) {
  // Main chart refs
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const mainChartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ma60Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)

  // RSI chart refs
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const rsiLineRef = useRef<ISeriesApi<'Line'> | null>(null)

  // MACD chart refs
  const macdContainerRef = useRef<HTMLDivElement>(null)
  const macdChartRef = useRef<IChartApi | null>(null)
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  const [period, setPeriod] = useState('3mo')
  const [loading, setLoading] = useState(false)
  const [indicators, setIndicators] = useState<IndicatorToggle>({ ma: true, bollinger: false, rsi: false, macd: false })

  const toggleIndicator = (key: keyof IndicatorToggle) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Sync time scales across charts
  const syncTimeScales = useCallback(() => {
    const main = mainChartRef.current
    if (!main) return
    const subCharts = [rsiChartRef.current, macdChartRef.current].filter(Boolean) as IChartApi[]

    main.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return
      subCharts.forEach(c => c.timeScale().setVisibleLogicalRange(range))
    })
    subCharts.forEach(c => {
      c.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (!range) return
        main.timeScale().setVisibleLogicalRange(range)
      })
    })
  }, [])

  // Load OHLCV + indicators
  const loadData = useCallback(async () => {
    if (!mainChartRef.current) return
    setLoading(true)
    try {
      const [histRes, indRes] = await Promise.all([
        api.stockHistory(symbol, period),
        // Indicators use 6mo backend default; only fetch for daily+ periods
        (period !== '1d' && period !== '5d') ? api.stockIndicators(symbol) : Promise.resolve(null),
      ])

      if (!histRes.data || histRes.data.length === 0 || histRes.data[0]?.error) return
      const useTimestamp = period === '1d' || period === '5d'

      const candles: CandlestickData[] = histRes.data.map((d: any) => ({
        time: (useTimestamp ? d.time : d.date) as Time,
        open: d.open, high: d.high, low: d.low, close: d.close,
      }))

      const volumes: HistogramData[] = histRes.data.map((d: any) => ({
        time: (useTimestamp ? d.time : d.date) as Time,
        value: d.volume,
        color: d.close >= d.open ? CANDLE.upAlpha : CANDLE.downAlpha,
      }))

      candleRef.current?.setData(candles)
      volumeRef.current?.setData(volumes)

      if (indRes) {
        // MA
        ma5Ref.current?.setData(toLineData(indRes.sma?.sma5))
        ma20Ref.current?.setData(toLineData(indRes.sma?.sma20))
        const sma50or60 = indRes.sma?.sma50 || []
        ma60Ref.current?.setData(toLineData(sma50or60))

        // Bollinger Bands
        bbUpperRef.current?.setData(toLineData(indRes.bollinger?.upper))
        bbMiddleRef.current?.setData(toLineData(indRes.bollinger?.middle))
        bbLowerRef.current?.setData(toLineData(indRes.bollinger?.lower))

        // RSI
        rsiLineRef.current?.setData(toLineData(indRes.rsi))

        // MACD
        macdLineRef.current?.setData(toLineData(indRes.macd?.macd))
        macdSignalRef.current?.setData(toLineData(indRes.macd?.signal))
        const macdHist: HistogramData[] = (indRes.macd?.histogram || []).map((d: any) => ({
          time: d.date as Time,
          value: d.value,
          color: d.value >= 0 ? CANDLE.upHistAlpha : CANDLE.downHistAlpha,
        }))
        macdHistRef.current?.setData(macdHist)
      } else {
        // Clear indicator data for intraday
        ;[ma5Ref, ma20Ref, ma60Ref, bbUpperRef, bbMiddleRef, bbLowerRef].forEach(r => r.current?.setData([]))
        rsiLineRef.current?.setData([])
        macdLineRef.current?.setData([])
        macdSignalRef.current?.setData([])
        macdHistRef.current?.setData([])
      }

      mainChartRef.current?.timeScale().fitContent()
      rsiChartRef.current?.timeScale().fitContent()
      macdChartRef.current?.timeScale().fitContent()
    } catch (e) {
      console.error('Chart data error:', e)
    } finally {
      setLoading(false)
    }
  }, [symbol, period])

  // Create/destroy main chart
  useEffect(() => {
    if (!mainContainerRef.current) return
    const chart = createChart(mainContainerRef.current, {
      layout: lwcLayout,
      grid: lwcGrid,
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: lwcScaleBorder },
      timeScale: { borderColor: lwcScaleBorder, timeVisible: period === '1d' || period === '5d' },
      width: mainContainerRef.current.clientWidth,
      height: 350,
    })
    mainChartRef.current = chart

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: CANDLE.up, downColor: CANDLE.down,
      borderUpColor: CANDLE.up, borderDownColor: CANDLE.down,
      wickUpColor: CANDLE.up, wickDownColor: CANDLE.down,
    })

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    volumeRef.current = vol

    // MA lines
    ma5Ref.current = chart.addSeries(LineSeries, { color: ACCENT.yellow, lineWidth: 1, title: 'MA5', visible: indicators.ma })
    ma20Ref.current = chart.addSeries(LineSeries, { color: ACCENT.blue, lineWidth: 1, title: 'MA20', visible: indicators.ma })
    ma60Ref.current = chart.addSeries(LineSeries, { color: ACCENT.purple, lineWidth: 1, title: 'MA50', visible: indicators.ma })

    // Bollinger Bands
    bbUpperRef.current = chart.addSeries(LineSeries, { color: ACCENT.orange, lineWidth: 1, lineStyle: 2, title: 'BB Upper', visible: indicators.bollinger })
    bbMiddleRef.current = chart.addSeries(LineSeries, { color: ACCENT.orange, lineWidth: 1, title: 'BB Mid', visible: indicators.bollinger })
    bbLowerRef.current = chart.addSeries(LineSeries, { color: ACCENT.orange, lineWidth: 1, lineStyle: 2, title: 'BB Lower', visible: indicators.bollinger })

    const handleResize = () => {
      if (mainContainerRef.current) chart.applyOptions({ width: mainContainerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); mainChartRef.current = null }
  }, [symbol])

  // Create/destroy RSI chart
  useEffect(() => {
    if (!indicators.rsi || !rsiContainerRef.current) { return }
    const chart = createChart(rsiContainerRef.current, {
      layout: lwcLayout,
      grid: lwcGrid,
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: lwcScaleBorder },
      timeScale: { borderColor: lwcScaleBorder, visible: !indicators.macd },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
    })
    rsiChartRef.current = chart
    rsiLineRef.current = chart.addSeries(LineSeries, { color: ACCENT.yellow, lineWidth: 2, title: 'RSI(14)' })
    // Overbought/oversold lines
    chart.addSeries(LineSeries, { color: 'rgba(239,68,68,0.3)', lineWidth: 1, lineStyle: 2 }).setData([])
    chart.addSeries(LineSeries, { color: 'rgba(59,130,246,0.3)', lineWidth: 1, lineStyle: 2 }).setData([])

    const handleResize = () => {
      if (rsiContainerRef.current) chart.applyOptions({ width: rsiContainerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)
    syncTimeScales()

    return () => { window.removeEventListener('resize', handleResize); chart.remove(); rsiChartRef.current = null; rsiLineRef.current = null }
  }, [indicators.rsi, symbol, syncTimeScales])

  // Create/destroy MACD chart
  useEffect(() => {
    if (!indicators.macd || !macdContainerRef.current) { return }
    const chart = createChart(macdContainerRef.current, {
      layout: lwcLayout,
      grid: lwcGrid,
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: lwcScaleBorder },
      timeScale: { borderColor: lwcScaleBorder },
      width: macdContainerRef.current.clientWidth,
      height: 120,
    })
    macdChartRef.current = chart
    macdHistRef.current = chart.addSeries(HistogramSeries, { priceFormat: { type: 'price' }, priceScaleId: '' })
    macdHistRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
    macdLineRef.current = chart.addSeries(LineSeries, { color: ACCENT.blue, lineWidth: 2, title: 'MACD' })
    macdSignalRef.current = chart.addSeries(LineSeries, { color: ACCENT.red, lineWidth: 1, title: 'Signal' })

    const handleResize = () => {
      if (macdContainerRef.current) chart.applyOptions({ width: macdContainerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)
    syncTimeScales()

    return () => { window.removeEventListener('resize', handleResize); chart.remove(); macdChartRef.current = null }
  }, [indicators.macd, symbol, syncTimeScales])

  // Toggle MA visibility
  useEffect(() => {
    ma5Ref.current?.applyOptions({ visible: indicators.ma })
    ma20Ref.current?.applyOptions({ visible: indicators.ma })
    ma60Ref.current?.applyOptions({ visible: indicators.ma })
  }, [indicators.ma])

  // Toggle Bollinger visibility
  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: indicators.bollinger })
    bbMiddleRef.current?.applyOptions({ visible: indicators.bollinger })
    bbLowerRef.current?.applyOptions({ visible: indicators.bollinger })
  }, [indicators.bollinger])

  // Load data when symbol/period changes or when sub-charts mount
  useEffect(() => { loadData() }, [loadData])
  // Reload when RSI/MACD toggled on (new chart created needs data)
  useEffect(() => {
    if (indicators.rsi || indicators.macd) {
      // Small delay for chart to initialize
      const t = setTimeout(loadData, 100)
      return () => clearTimeout(t)
    }
  }, [indicators.rsi, indicators.macd, loadData])

  const toggleBtn = (key: keyof IndicatorToggle, label: string, color: string) => (
    <button onClick={() => toggleIndicator(key)}
      className={`px-2 py-1 text-xs rounded border transition ${
        indicators[key]
          ? `${color} border-current`
          : 'text-slate-500 border-slate-600 hover:text-slate-300'
      }`}>
      {label}
    </button>
  )

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-2 py-1 text-xs rounded ${period === p.value ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
            {p.label}
          </button>
        ))}
        <span className="w-px h-4 bg-slate-600 mx-1" />
        {toggleBtn('ma', 'MA', 'text-yellow-400')}
        {toggleBtn('bollinger', 'Bollinger', 'text-orange-400')}
        {toggleBtn('rsi', 'RSI', 'text-yellow-500')}
        {toggleBtn('macd', 'MACD', 'text-blue-400')}
        {loading && <span className="text-xs text-slate-500 ml-2">Loading...</span>}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-2 text-xs text-slate-400 flex-wrap">
        {indicators.ma && <>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" /> MA5</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> MA20</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block" /> MA50</span>
        </>}
        {indicators.bollinger && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> Bollinger</span>}
      </div>

      {/* Main Chart (Candlestick + Volume + MA + Bollinger overlay) */}
      <div ref={mainContainerRef} className="rounded-t-lg overflow-hidden" />

      {/* RSI Sub-chart */}
      {indicators.rsi && (
        <div>
          <div className="text-xs text-slate-500 px-2 py-1 bg-slate-800 border-t border-slate-700/30">
            RSI(14) — <span className="text-red-400">70 overbought</span> / <span className="text-blue-400">30 oversold</span>
          </div>
          <div ref={rsiContainerRef} className="overflow-hidden" />
        </div>
      )}

      {/* MACD Sub-chart */}
      {indicators.macd && (
        <div>
          <div className="text-xs text-slate-500 px-2 py-1 bg-slate-800 border-t border-slate-700/30">
            MACD(12,26,9) — <span className="text-blue-400">MACD</span> / <span className="text-red-400">Signal</span>
          </div>
          <div ref={macdContainerRef} className="rounded-b-lg overflow-hidden" />
        </div>
      )}

      {!indicators.rsi && !indicators.macd && <div className="h-1 rounded-b-lg bg-slate-800" />}
    </div>
  )
}

export function StockPanel() {
  const { t } = useLocale()
  const s = t.stocks

  const [stocks, setStocks] = useState<StockItem[]>([])
  const [indices, setIndices] = useState<IndexItem[]>([])
  const [selected, setSelected] = useState<StockItem | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareTargets, setCompareTargets] = useState<[StockItem | null, StockItem | null]>([null, null])
  const [filter, setFilter] = useState<'all' | 'kr' | 'us'>('all')
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [signalList, setSignalList] = useState<any[]>([])

  const loadStockData = useCallback(async () => {
    const [stockRes, idxRes, sigRes] = await Promise.allSettled([
      api.stocks(filter),
      api.indices(),
      api.signals(100),
    ])
    if (stockRes.status === 'fulfilled') setStocks(stockRes.value.stocks || [])
    if (idxRes.status === 'fulfilled') setIndices(idxRes.value.indices || [])
    if (sigRes.status === 'fulfilled') setSignalList(sigRes.value.signals || [])
  }, [filter])

  useEffect(() => { loadStockData() }, [loadStockData])

  // Extract unique sectors from stock data
  const sectors = useMemo(() => {
    const set = new Set<string>()
    stocks.forEach(st => { if (st.sector) set.add(st.sector) })
    return Array.from(set).sort()
  }, [stocks])

  // Filter stocks by search and sector
  const filteredStocks = useMemo(() => {
    return stocks.filter(st => {
      if ('error' in st) return false
      if (sectorFilter && st.sector !== sectorFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const nameMatch = st.name.toLowerCase().includes(q)
        const symbolMatch = st.symbol.toLowerCase().replace('.ks', '').replace('.kq', '').includes(q)
        if (!nameMatch && !symbolMatch) return false
      }
      return true
    })
  }, [stocks, search, sectorFilter])

  // Group stocks by sector for display
  const groupedBySector = useMemo(() => {
    if (!sectorFilter && !search) return null // show flat list when no filtering
    const map = new Map<string, StockItem[]>()
    filteredStocks.forEach(st => {
      const key = st.sector || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(st)
    })
    return map
  }, [filteredStocks, sectorFilter, search])

  // Portfolio summary stats
  const portfolioStats = useMemo(() => {
    const valid = stocks.filter(st => !('error' in st) && st.price > 0)
    const gainers = valid.filter(st => st.change_pct > 0)
    const losers = valid.filter(st => st.change_pct < 0)
    const unchanged = valid.filter(st => st.change_pct === 0)
    const topGainers = [...valid].sort((a, b) => b.change_pct - a.change_pct).slice(0, 3)
    const topLosers = [...valid].sort((a, b) => a.change_pct - b.change_pct).slice(0, 3)
    const avgChange = valid.length > 0 ? valid.reduce((s, st) => s + st.change_pct, 0) / valid.length : 0
    const sectorMap = new Map<string, { count: number; avgChange: number }>()
    valid.forEach(st => {
      const key = st.sector || 'Other'
      const prev = sectorMap.get(key) || { count: 0, avgChange: 0 }
      sectorMap.set(key, {
        count: prev.count + 1,
        avgChange: (prev.avgChange * prev.count + st.change_pct) / (prev.count + 1),
      })
    })
    return { total: valid.length, gainers: gainers.length, losers: losers.length, unchanged: unchanged.length, topGainers, topLosers, avgChange, sectorMap }
  }, [stocks])

  // Sector pie chart data
  const sectorPieData = useMemo(() => {
    return Array.from(portfolioStats.sectorMap.entries())
      .map(([name, data]) => ({ name, value: data.count, avgChange: data.avgChange }))
      .sort((a, b) => b.value - a.value)
  }, [portfolioStats.sectorMap])

  const PIE_COLORS = SERIES_PALETTE

  const changeCls = (pct: number) => pct > 0 ? 'text-red-400' : pct < 0 ? 'text-blue-400' : 'text-slate-400'
  const changePrefix = (pct: number) => pct > 0 ? '+' : ''

  const isTopMover = (st: StockItem) => {
    return portfolioStats.topGainers.some(g => g.symbol === st.symbol) || portfolioStats.topLosers.some(l => l.symbol === st.symbol)
  }

  const renderStockRow = (st: StockItem) => (
    <tr key={st.symbol} onClick={() => setSelected(st)}
      className={`border-b border-slate-700/20 hover:bg-slate-700/30 cursor-pointer transition ${
        isTopMover(st) ? (st.change_pct > 0 ? 'bg-red-500/5' : st.change_pct < 0 ? 'bg-blue-500/5' : '') : ''
      }`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-medium">{st.name}</span>
          <SignalBadges symbol={st.symbol} signals={signalList} />
        </div>
        <div className="text-xs text-slate-500">
          {st.symbol.replace('.KS', '').replace('.KQ', '')} · {st.market}
          {st.sector && <span className="ml-1 text-slate-600">· {st.sector}</span>}
        </div>
      </td>
      <td className="text-right px-2 py-2.5 text-white font-medium">
        {formatPrice(st.price, st.market)}
      </td>
      <td className={`text-right px-2 py-2.5 font-medium ${changeCls(st.change_pct)}`}>
        {changePrefix(st.change_pct)}{st.change_pct}%
      </td>
      <td className="text-right px-2 py-2.5 text-slate-400 hidden md:table-cell">
        {st.volume.toLocaleString()}
      </td>
      <td className="text-right px-4 py-2.5 text-slate-400 hidden lg:table-cell">
        {formatCap(st.market_cap)}
      </td>
    </tr>
  )

  if (selected) {
    return (
      <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-white mb-2 flex items-center gap-1">
            &lt; {s.back}
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-white font-medium text-lg">{selected.name}</h2>
            <span className="text-xs text-slate-500">{selected.symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{selected.market}</span>
            {selected.sector && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-400">{selected.sector}</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-2xl font-bold text-white">{formatPrice(selected.price, selected.market)}</span>
            <span className={`text-sm font-medium ${changeCls(selected.change_pct)}`}>
              {changePrefix(selected.change_pct)}{selected.change_pct}%
            </span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>{s.open}: {selected.open_price.toLocaleString()}</span>
            <span>{s.high}: {selected.high.toLocaleString()}</span>
            <span>{s.low}: {selected.low.toLocaleString()}</span>
            <span>{s.volume}: {selected.volume.toLocaleString()}</span>
            <span>{s.marketCap}: {formatCap(selected.market_cap)}</span>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <StockChart symbol={selected.symbol} />
        </div>
      </div>
    )
  }

  // Compare view: two stocks side by side
  if (compareMode && compareTargets[0] && compareTargets[1]) {
    const [a, b] = compareTargets as [StockItem, StockItem]
    const metrics = [
      { label: s.price, a: formatPrice(a.price, a.market), b: formatPrice(b.price, b.market) },
      { label: s.change, a: `${changePrefix(a.change_pct)}${a.change_pct}%`, b: `${changePrefix(b.change_pct)}${b.change_pct}%`, aCls: changeCls(a.change_pct), bCls: changeCls(b.change_pct) },
      { label: s.volume, a: a.volume.toLocaleString(), b: b.volume.toLocaleString() },
      { label: s.marketCap, a: formatCap(a.market_cap), b: formatCap(b.market_cap) },
      { label: s.open, a: a.open_price.toLocaleString(), b: b.open_price.toLocaleString() },
      { label: s.high, a: a.high.toLocaleString(), b: b.high.toLocaleString() },
      { label: s.low, a: a.low.toLocaleString(), b: b.low.toLocaleString() },
    ]
    return (
      <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <button onClick={() => { setCompareMode(false); setCompareTargets([null, null]) }}
            className="text-xs text-slate-400 hover:text-white mb-2 flex items-center gap-1">&lt; Back to list</button>
          <h2 className="text-white font-medium">Compare: {a.name} vs {b.name}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Metrics comparison */}
          <div className="bg-slate-900/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-2 text-left text-slate-500 text-xs">Metric</th>
                  <th className="px-4 py-2 text-right text-blue-400 text-xs">{a.name}</th>
                  <th className="px-4 py-2 text-right text-purple-400 text-xs">{b.name}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(m => (
                  <tr key={m.label} className="border-b border-slate-700/30">
                    <td className="px-4 py-2 text-slate-400 text-xs">{m.label}</td>
                    <td className={`px-4 py-2 text-right text-xs font-medium ${m.aCls || 'text-white'}`}>{m.a}</td>
                    <td className={`px-4 py-2 text-right text-xs font-medium ${m.bCls || 'text-white'}`}>{m.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Side by side charts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-blue-400 font-medium mb-2">{a.name} ({a.symbol})</div>
              <StockChart symbol={a.symbol} />
            </div>
            <div>
              <div className="text-xs text-purple-400 font-medium mb-2">{b.name} ({b.symbol})</div>
              <StockChart symbol={b.symbol} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Compare mode: selecting stocks
  if (compareMode) {
    const slot = compareTargets[0] ? 1 : 0
    return (
      <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <button onClick={() => { setCompareMode(false); setCompareTargets([null, null]) }}
            className="text-xs text-slate-400 hover:text-white mb-2 flex items-center gap-1">&lt; Cancel</button>
          <h2 className="text-white font-medium">Select stocks to compare</h2>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className={`px-2 py-1 rounded ${compareTargets[0] ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400 animate-pulse'}`}>
              {compareTargets[0] ? compareTargets[0].name : 'Select 1st stock...'}
            </span>
            <span className="text-slate-600">vs</span>
            <span className={`px-2 py-1 rounded ${compareTargets[1] ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700 text-slate-400'}`}>
              {compareTargets[1] ? compareTargets[1].name : 'Select 2nd stock...'}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-700/30 sticky top-0 bg-slate-800/90">
              <tr>
                <th className="text-left px-4 py-2">{s.name}</th>
                <th className="text-right px-2 py-2">{s.price}</th>
                <th className="text-right px-2 py-2">{s.change}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(st => (
                <tr key={st.symbol}
                  onClick={() => {
                    const next: [StockItem | null, StockItem | null] = [...compareTargets]
                    next[slot] = st
                    setCompareTargets(next)
                  }}
                  className="border-b border-slate-700/20 hover:bg-slate-700/30 cursor-pointer transition">
                  <td className="px-4 py-2.5">
                    <span className="text-white font-medium">{st.name}</span>
                    <div className="text-xs text-slate-500">{st.symbol.replace('.KS', '').replace('.KQ', '')}</div>
                  </td>
                  <td className="text-right px-2 py-2.5 text-white">{formatPrice(st.price, st.market)}</td>
                  <td className={`text-right px-2 py-2.5 ${changeCls(st.change_pct)}`}>{changePrefix(st.change_pct)}{st.change_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-medium">{s.title}</h2>
            <RefreshIndicator onRefresh={loadStockData} intervalSec={30} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['all', 'kr', 'us'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-xs rounded ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                  {f === 'all' ? s.allMarkets : f.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setCompareMode(true)}
              className="px-2 py-1 text-[10px] rounded bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Compare 2 stocks">
              Compare
            </button>
            <button onClick={() => downloadExport(`/api/export/stocks?format=csv&market=${filter}`, 'stocks.csv')}
              className="px-2 py-1 text-[10px] rounded bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Export CSV">
              CSV
            </button>
          </div>
        </div>

        {/* Search + Sector Filter */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded-md
              text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded-md text-slate-300
              focus:outline-none focus:border-blue-500/50"
          >
            <option value="">{s.allSectors}</option>
            {sectors.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
          {(search || sectorFilter) && (
            <span className="text-xs text-slate-500 self-center">
              {filteredStocks.length}/{stocks.length}
            </span>
          )}
        </div>

        {/* Market Indices */}
        <div className="flex gap-3 flex-wrap">
          {indices.map(idx => (
            <div key={idx.symbol} className="bg-slate-700/40 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-300">{idx.name}</span>
              <span className="ml-2 text-white font-medium">{idx.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className={`ml-1 ${changeCls(idx.change_pct)}`}>
                {changePrefix(idx.change_pct)}{idx.change_pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      {stocks.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-700/50">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{portfolioStats.total}</div>
              <div className="text-[10px] text-slate-500 uppercase">Tracked</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-red-400">{portfolioStats.gainers}</div>
              <div className="text-[10px] text-slate-500 uppercase">Gainers</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-blue-400">{portfolioStats.losers}</div>
              <div className="text-[10px] text-slate-500 uppercase">Losers</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className={`text-lg font-bold ${changeCls(portfolioStats.avgChange)}`}>
                {changePrefix(portfolioStats.avgChange)}{portfolioStats.avgChange.toFixed(2)}%
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Avg Change</div>
            </div>
          </div>

          {/* Top Movers */}
          <div className="grid grid-cols-2 gap-2">
            {/* Top Gainers */}
            <div className="bg-red-500/5 rounded-lg p-2.5 border border-red-500/10">
              <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 font-medium">Top Gainers</div>
              {portfolioStats.topGainers.map(st => (
                <div key={st.symbol} className="flex items-center justify-between py-0.5 cursor-pointer hover:bg-red-500/5 rounded px-1"
                  onClick={() => setSelected(st)}>
                  <span className="text-xs text-white truncate">{st.name}</span>
                  <span className="text-xs text-red-400 font-medium shrink-0 ml-2">+{st.change_pct}%</span>
                </div>
              ))}
            </div>
            {/* Top Losers */}
            <div className="bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10">
              <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5 font-medium">Top Losers</div>
              {portfolioStats.topLosers.map(st => (
                <div key={st.symbol} className="flex items-center justify-between py-0.5 cursor-pointer hover:bg-blue-500/5 rounded px-1"
                  onClick={() => setSelected(st)}>
                  <span className="text-xs text-white truncate">{st.name}</span>
                  <span className="text-xs text-blue-400 font-medium shrink-0 ml-2">{st.change_pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sector Donut Chart */}
          {sectorPieData.length > 0 && (
            <div className="mt-3 bg-slate-900/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">Sector Distribution</div>
              <div className="flex items-center gap-4">
                <div className="w-[180px] h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorPieData}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {sectorPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number, name: string) => [`${value} stocks`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                  {sectorPieData.map((sec, i) => (
                    <div key={sec.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-300 truncate">{sec.name}</span>
                      <span className="text-slate-500 ml-auto">{sec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b border-slate-700/30 sticky top-0 bg-slate-800/90">
            <tr>
              <th className="text-left px-4 py-2">{s.name}</th>
              <th className="text-right px-2 py-2">{s.price}</th>
              <th className="text-right px-2 py-2">{s.change}</th>
              <th className="text-right px-2 py-2 hidden md:table-cell">{s.volume}</th>
              <th className="text-right px-4 py-2 hidden lg:table-cell">{s.marketCap}</th>
            </tr>
          </thead>
          <tbody>
            {groupedBySector ? (
              // Grouped display when filtering
              Array.from(groupedBySector.entries()).map(([sector, items]) => (
                <>{/* Sector header row */}
                  <tr key={`sector-${sector}`}>
                    <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-800/60 border-b border-slate-700/30">
                      {sector} <span className="font-normal text-slate-500">({items.length})</span>
                    </td>
                  </tr>
                  {items.map(renderStockRow)}
                </>
              ))
            ) : (
              // Flat list (default, no filtering)
              filteredStocks.map(renderStockRow)
            )}
            {filteredStocks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                  {s.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
