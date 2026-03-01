import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useLocale } from '../hooks/useLocale'

interface SentimentItem {
  symbol: string
  name: string
  score: number          // -1.0 ~ +1.0
  positive: number       // count or percentage
  negative: number
  neutral: number
  news_count: number
  last_updated: string
}

interface NewsItem {
  title: string
  source: string
  date: string
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
  symbol?: string
  url?: string
}

function SentimentGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  // score: -1.0 (very bearish) to +1.0 (very bullish)
  const pct = ((score + 1) / 2) * 100 // 0~100
  const r = size === 'sm' ? 20 : 28
  const svgSize = size === 'sm' ? 48 : 68
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  const color = score > 0.3 ? '#34d399' : score > 0 ? '#6ee7b7' :
    score > -0.3 ? '#fbbf24' : '#f87171'

  return (
    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
      <circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-700" />
      <circle
        cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
        className="transition-all duration-700"
      />
      <text x={svgSize / 2} y={svgSize / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size === 'sm' ? 10 : 13} fontWeight="bold">
        {score > 0 ? '+' : ''}{score.toFixed(2)}
      </text>
    </svg>
  )
}

function SentimentBar({ positive, negative, neutral }: { positive: number; negative: number; neutral: number }) {
  const total = positive + negative + neutral || 1
  const pPct = (positive / total) * 100
  const nPct = (negative / total) * 100

  return (
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
      {pPct > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pPct}%` }} />}
      {(100 - pPct - nPct) > 0 && <div className="bg-slate-500 transition-all duration-500" style={{ width: `${100 - pPct - nPct}%` }} />}
      {nPct > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${nPct}%` }} />}
    </div>
  )
}

export function SentimentPanel() {
  const { t } = useLocale()
  const s = t.sent

  const [sentiments, setSentiments] = useState<SentimentItem[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sentData, newsData] = await Promise.allSettled([
        api.sentiment(),
        api.sentimentNews(undefined, 30),
      ])
      if (sentData.status === 'fulfilled') setSentiments(sentData.value.sentiments || [])
      if (newsData.status === 'fulfilled') setNews(newsData.value.news || [])
    } catch { /* API not ready yet */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredSentiments = sentiments.filter(item => {
    if (search) {
      const q = search.toLowerCase()
      return item.symbol?.toLowerCase().includes(q) || item.name?.toLowerCase().includes(q)
    }
    return true
  })

  const filteredNews = news.filter(n => {
    if (selectedSymbol) return n.symbol === selectedSymbol
    return true
  })

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return s.bullish
    if (score > 0) return s.positive
    if (score > -0.3) return s.mixed
    return s.bearish
  }

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (sentiment === 'negative') return 'bg-red-500/20 text-red-400 border-red-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  const overallScore = sentiments.length > 0
    ? sentiments.reduce((sum, s) => sum + (s.score || 0), 0) / sentiments.length
    : 0

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">{s.title}</h2>
          {sentiments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{s.overall}:</span>
              <span className={`text-sm font-bold ${
                overallScore > 0.3 ? 'text-emerald-400' :
                overallScore > 0 ? 'text-emerald-300' :
                overallScore > -0.3 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {getSentimentLabel(overallScore)}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="flex-1 px-3 py-1.5 text-xs rounded-md bg-slate-900/50 border border-slate-700/50 text-white
              placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
          {selectedSymbol && (
            <button
              onClick={() => setSelectedSymbol(null)}
              className="px-2 py-1 text-[10px] rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30"
            >
              {selectedSymbol} &times;
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            {s.loading}
          </div>
        ) : sentiments.length === 0 && news.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-700/30 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="text-sm">{s.noData}</p>
            <p className="text-xs mt-1 text-center max-w-xs">{s.noDataHint}</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Sentiment Cards Grid */}
            {filteredSentiments.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 font-medium mb-2">
                  {s.sentimentScore} ({filteredSentiments.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredSentiments.map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(selectedSymbol === item.symbol ? null : item.symbol)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selectedSymbol === item.symbol
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-slate-700/20 border-slate-700/50 hover:bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <SentimentGauge score={item.score} size="sm" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white block truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-500">{item.symbol}</span>
                        </div>
                      </div>
                      <SentimentBar positive={item.positive} negative={item.negative} neutral={item.neutral} />
                      <div className="flex items-center justify-between mt-1.5 text-[10px]">
                        <div className="flex gap-2">
                          <span className="text-emerald-400">{s.positive} {item.positive}</span>
                          <span className="text-red-400">{s.negative} {item.negative}</span>
                          <span className="text-slate-500">{s.neutral} {item.neutral}</span>
                        </div>
                        <span className="text-slate-600">{item.news_count} {s.newsCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* News Headlines */}
            {filteredNews.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 font-medium mb-2">
                  {s.headlines} ({filteredNews.length})
                </div>
                <div className="space-y-1.5">
                  {filteredNews.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg border border-slate-700/50 p-2.5 hover:bg-slate-700/20 transition-colors"
                    >
                      <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border ${getSentimentColor(item.sentiment)}`}>
                        {item.sentiment === 'positive' ? '+' : item.sentiment === 'negative' ? '-' : '~'}
                      </span>
                      <div className="flex-1 min-w-0">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-slate-200 hover:text-blue-400 leading-relaxed line-clamp-2">
                            {item.title}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-200 leading-relaxed line-clamp-2">{item.title}</span>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                          {item.symbol && <span className="text-slate-400">{item.symbol}</span>}
                          {item.source && <span>{item.source}</span>}
                          {item.date && <span>{item.date}</span>}
                          <span className="ml-auto font-mono">
                            {item.score > 0 ? '+' : ''}{item.score?.toFixed(2)}
                          </span>
                        </div>
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
