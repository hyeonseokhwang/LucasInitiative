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
  models: () => fetchJson<{ models: any[] }>('/api/models'),
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
}
