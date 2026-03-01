const BASE = ''

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  return res.json()
}

export const api = {
  health: () => fetchJson<{ status: string }>('/api/health'),
  monitor: () => fetchJson<any>('/api/monitor/snapshot'),
  metricsHistory: (hours = 24) => fetchJson<{ history: any[]; count: number }>(`/api/monitor/history?hours=${hours}`),
  gpuDetail: () => fetchJson<{ gpu: any; ollama_models: any[]; gpu_processes: any[] }>('/api/monitor/gpu-detail'),
  processes: (limit = 15) => fetchJson<{ processes: any[] }>(`/api/monitor/processes?limit=${limit}`),
  diskDetail: () => fetchJson<{ disk: any }>('/api/monitor/disk-detail'),
  dailyUsage: () => fetchJson<{ daily: any[] }>('/api/usage/daily'),
  logs: (opts?: { level?: string; lines?: number; search?: string }) => {
    const params = new URLSearchParams()
    if (opts?.level) params.set('level', opts.level)
    if (opts?.lines) params.set('lines', String(opts.lines))
    if (opts?.search) params.set('search', opts.search)
    return fetchJson<{ logs: any[]; count: number }>(`/api/logs?${params}`)
  },
  logStats: () => fetchJson<{ total: number; counts: Record<string, number> }>('/api/logs/stats'),
  models: () => fetchJson<{ models: any[] }>('/api/models'),
  modelsRunning: () => fetchJson<{ models: any[] }>('/api/models/running'),
  modelWarmup: (name: string) => fetchJson<any>(`/api/models/warmup/${encodeURIComponent(name)}`, { method: 'POST' }),
  modelInfo: (name: string) => fetchJson<any>(`/api/models/info/${encodeURIComponent(name)}`),
  conversations: () => fetchJson<{ conversations: any[] }>('/api/chat/conversations'),
  messages: (convId: number) => fetchJson<{ messages: any[] }>(`/api/chat/conversations/${convId}/messages`),
  chat: (message: string, model: string, conversation_id?: number) =>
    fetchJson<any>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model, conversation_id }),
    }),
  tasks: () => fetchJson<{ tasks: any[] }>('/api/tasks'),

  // Schedules
  schedules: (from?: string, to?: string) =>
    fetchJson<{ schedules: any[] }>(`/api/schedules?${new URLSearchParams({ ...(from ? { from_date: from } : {}), ...(to ? { to_date: to } : {}) })}`),
  addSchedule: (data: any) =>
    fetchJson<any>('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),
  deleteSchedule: (id: number) =>
    fetchJson<any>(`/api/schedules/${id}`, { method: 'DELETE' }),

  // Expenses
  expenses: (from?: string, to?: string) =>
    fetchJson<{ expenses: any[] }>(`/api/expenses?${new URLSearchParams({ ...(from ? { from_date: from } : {}), ...(to ? { to_date: to } : {}) })}`),
  addExpense: (data: any) =>
    fetchJson<any>('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  expenseSummary: (month: string) =>
    fetchJson<any>(`/api/expenses/summary/${month}`),
  deleteExpense: (id: number) =>
    fetchJson<any>(`/api/expenses/${id}`, { method: 'DELETE' }),

  // Usage
  usage: () => fetchJson<any>('/api/usage'),

  // Stocks
  stocks: (market?: string) =>
    fetchJson<{ stocks: any[] }>(`/api/reports/stocks?market=${market || 'all'}`),
  indices: () =>
    fetchJson<{ indices: any[] }>('/api/reports/indices'),
  stockHistory: (symbol: string, period?: string) =>
    fetchJson<{ symbol: string; period: string; data: any[] }>(`/api/reports/stocks/history/${encodeURIComponent(symbol)}?period=${period || '1mo'}`),
  stockList: () =>
    fetchJson<{ stocks: any[] }>('/api/reports/stocks/list'),
  sectors: () =>
    fetchJson<{ sectors: any[] }>('/api/reports/sectors'),

  // Indicators
  stockIndicators: (symbol: string) =>
    fetchJson<any>(`/api/reports/stocks/indicators/${encodeURIComponent(symbol)}`),

  // Portfolio
  portfolio: () =>
    fetchJson<any>('/api/reports/portfolio'),
  addPortfolio: (data: { symbol: string; name: string; quantity: number; avg_price: number }) =>
    fetchJson<any>('/api/reports/portfolio', { method: 'POST', body: JSON.stringify(data) }),
  updatePortfolio: (id: number, data: { quantity?: number; avg_price?: number }) =>
    fetchJson<any>(`/api/reports/portfolio/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePortfolio: (id: number) =>
    fetchJson<any>(`/api/reports/portfolio/${id}`, { method: 'DELETE' }),

  // Real Estate
  reTrends: (district?: string, dealType?: string, months?: number) =>
    fetchJson<{ trends: any[]; filters: any }>(`/api/realestate/trends?${new URLSearchParams({
      ...(district ? { district } : {}),
      deal_type: dealType || 'sale',
      months: String(months || 12),
    })}`),
  reTrendsApt: (aptName: string, dealType?: string, months?: number) =>
    fetchJson<{ trends: any[]; apt_name: string }>(`/api/realestate/trends/apt?${new URLSearchParams({
      apt_name: aptName,
      deal_type: dealType || 'sale',
      months: String(months || 24),
    })}`),
  reCompare: (districts?: string, dealType?: string, months?: number) =>
    fetchJson<{ comparison: any[]; deal_type: string; months: number }>(`/api/realestate/compare?${new URLSearchParams({
      ...(districts ? { districts } : {}),
      deal_type: dealType || 'sale',
      months: String(months || 6),
    })}`),
  reCompareMonthly: (districts: string[], dealType?: string, months?: number) =>
    fetchJson<{ comparison: any[]; districts: string[] }>('/api/realestate/compare/monthly', {
      method: 'POST',
      body: JSON.stringify({ districts, deal_type: dealType || 'sale', months: months || 6 }),
    }),
  reDistricts: () =>
    fetchJson<{ districts: any[]; seoul_major: string[] }>('/api/realestate/districts'),
  reWatchlist: () =>
    fetchJson<{ watchlist: any[] }>('/api/realestate/watchlist'),
  reWatchlistAdd: (data: { district: string; dong?: string; apt_name?: string; deal_type?: string; memo?: string; target_price?: number }) =>
    fetchJson<any>('/api/realestate/watchlist', { method: 'POST', body: JSON.stringify(data) }),
  reWatchlistDelete: (id: number) =>
    fetchJson<any>(`/api/realestate/watchlist/${id}`, { method: 'DELETE' }),
  reDeals: (district?: string, dealType?: string, limit?: number) =>
    fetchJson<{ deals: any[]; count: number }>(`/api/realestate/deals?${new URLSearchParams({
      ...(district ? { district } : {}),
      ...(dealType ? { deal_type: dealType } : {}),
      limit: String(limit || 50),
    })}`),

  // Research
  researchTopics: (status?: string) =>
    fetchJson<{ topics: any[] }>(`/api/research/topics${status ? `?status=${status}` : ''}`),
  researchReports: (limit?: number) =>
    fetchJson<{ reports: any[] }>(`/api/research/reports?limit=${limit || 20}`),
  researchReport: (id: number) =>
    fetchJson<any>(`/api/research/reports/${id}`),
  researchEvidence: (topicId: number) =>
    fetchJson<{ evidence: any[] }>(`/api/research/evidence/${topicId}`),
  researchTrigger: (query: string) =>
    fetchJson<any>(`/api/research/trigger?${new URLSearchParams({ query })}`, { method: 'POST' }),
  researchStatus: () =>
    fetchJson<{ engine: any }>('/api/research/status'),

  // Signals
  signals: (limit?: number) =>
    fetchJson<{ signals: any[]; count: number }>(`/api/research/signals?limit=${limit || 50}`),
  signalScan: () =>
    fetchJson<{ status: string; signals: any[]; count: number }>('/api/research/signals/scan', { method: 'POST' }),

  // Daily Reports (from daily_reports table + Worker-1 date-based API)
  dailyReports: (limit?: number) =>
    fetchJson<{ reports: any[] }>(`/api/reports/history?limit=${limit || 30}`),
  dailyReportByDate: (date: string) =>
    fetchJson<any>(`/api/research/reports/${encodeURIComponent(date)}`),

  // Sentiment Analysis (Worker-1 Phase 2)
  sentiment: (symbol?: string) =>
    fetchJson<{ sentiments: any[]; summary?: any }>(`/api/research/sentiment${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`),
  sentimentNews: (symbol?: string, limit?: number) =>
    fetchJson<{ news: any[] }>(`/api/research/sentiment/news?${new URLSearchParams({
      ...(symbol ? { symbol } : {}),
      limit: String(limit || 20),
    })}`),

  // Trends (Worker-1 Phase 3)
  trendsKeywords: () =>
    fetchJson<{ trends: any[]; daily: any }>('/api/trends/keywords'),
  trendsCategories: () =>
    fetchJson<{ category_trends: any[] }>('/api/trends/categories'),
  trendsInsights: () =>
    fetchJson<{ insights: any[] }>('/api/trends/insights/weekly'),
  trendsPipeline: () =>
    fetchJson<any>('/api/trends/pipeline/stats'),
  trendsNews: (category?: string) =>
    fetchJson<{ items: any[]; count: number }>(`/api/trends/sources/news${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  trendsQueue: () =>
    fetchJson<{ queued: any[]; processing: any; completed: any[]; queue_size: number; is_processing: boolean }>('/api/trends/queue'),

  // Challenges (direct call to Scheduler at :7778)
  challenges: () =>
    fetch('http://localhost:7778/api/challenges', { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json())
      .catch(() => []),
}

/** Download a file from an export endpoint as a Blob */
export async function downloadExport(url: string, filename: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
