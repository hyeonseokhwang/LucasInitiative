import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from 'lightweight-charts'
import { api, downloadExport } from '../lib/api'
import { ACCENT, CANDLE, lwcLayout, lwcGrid, lwcScaleBorder } from '../lib/chartTheme'

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
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [indices, setIndices] = useState<IndexItem[]>([])
  const [selected, setSelected] = useState<StockItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'kr' | 'us'>('all')

  useEffect(() => {
    api.stocks(filter).then(d => setStocks(d.stocks || []))
    api.indices().then(d => setIndices(d.indices || []))
  }, [filter])

  const changeCls = (pct: number) => pct > 0 ? 'text-red-400' : pct < 0 ? 'text-blue-400' : 'text-slate-400'
  const changePrefix = (pct: number) => pct > 0 ? '+' : ''

  if (selected) {
    return (
      <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-white mb-2 flex items-center gap-1">
            &lt; Back
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-white font-medium text-lg">{selected.name}</h2>
            <span className="text-xs text-slate-500">{selected.symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{selected.market}</span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-2xl font-bold text-white">{formatPrice(selected.price, selected.market)}</span>
            <span className={`text-sm font-medium ${changeCls(selected.change_pct)}`}>
              {changePrefix(selected.change_pct)}{selected.change_pct}%
            </span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>Open: {selected.open_price.toLocaleString()}</span>
            <span>High: {selected.high.toLocaleString()}</span>
            <span>Low: {selected.low.toLocaleString()}</span>
            <span>Vol: {selected.volume.toLocaleString()}</span>
            <span>Cap: {formatCap(selected.market_cap)}</span>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <StockChart symbol={selected.symbol} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-medium">Stocks</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['all', 'kr', 'us'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-xs rounded ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => downloadExport(`/api/export/stocks?format=csv&market=${filter}`, 'stocks.csv')}
              className="px-2 py-1 text-[10px] rounded bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Export CSV">
              CSV
            </button>
          </div>
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

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 border-b border-slate-700/30 sticky top-0 bg-slate-800/90">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-right px-2 py-2">Price</th>
              <th className="text-right px-2 py-2">Change</th>
              <th className="text-right px-2 py-2 hidden md:table-cell">Volume</th>
              <th className="text-right px-4 py-2 hidden lg:table-cell">Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {stocks.filter(s => !('error' in s)).map(s => (
              <tr key={s.symbol} onClick={() => setSelected(s)}
                className="border-b border-slate-700/20 hover:bg-slate-700/30 cursor-pointer transition">
                <td className="px-4 py-2.5">
                  <div className="text-white font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.symbol.replace('.KS', '').replace('.KQ', '')} · {s.market}</div>
                </td>
                <td className="text-right px-2 py-2.5 text-white font-medium">
                  {formatPrice(s.price, s.market)}
                </td>
                <td className={`text-right px-2 py-2.5 font-medium ${changeCls(s.change_pct)}`}>
                  {changePrefix(s.change_pct)}{s.change_pct}%
                </td>
                <td className="text-right px-2 py-2.5 text-slate-400 hidden md:table-cell">
                  {s.volume.toLocaleString()}
                </td>
                <td className="text-right px-4 py-2.5 text-slate-400 hidden lg:table-cell">
                  {formatCap(s.market_cap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
