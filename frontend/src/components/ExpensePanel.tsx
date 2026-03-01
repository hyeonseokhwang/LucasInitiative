import { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts'
import { api, fetchJson, downloadExport } from '../lib/api'
import { ACCENT, SURFACE, CHART_COLORS, EXPENSE_COLORS, commonAxisProps, commonGridProps, commonTooltipProps, legendStyle } from '../lib/chartTheme'
import type { ExpenseItem, ExpenseSummary } from '../types'

const CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'income', 'etc']
const CAT_LABELS: Record<string, string> = {
  food: 'Food', transport: 'Transport', shopping: 'Shopping',
  bills: 'Bills', entertainment: 'Entertainment', income: 'Income', etc: 'Etc',
}

type TrendPeriod = 'daily' | 'weekly' | 'monthly'

// --- Helpers ---

function getWeekKey(d: Date): string {
  const start = new Date(d)
  start.setDate(start.getDate() - start.getDay())
  return start.toISOString().slice(0, 10)
}

function aggregateByPeriod(expenses: ExpenseItem[], period: TrendPeriod) {
  const map: Record<string, { income: number; expense: number; label: string }> = {}

  for (const e of expenses) {
    const date = new Date(e.paid_at)
    let key: string
    let label: string

    if (period === 'daily') {
      key = e.paid_at.slice(0, 10)
      label = `${date.getMonth() + 1}/${date.getDate()}`
    } else if (period === 'weekly') {
      key = getWeekKey(date)
      label = `${new Date(key).getMonth() + 1}/${new Date(key).getDate()}~`
    } else {
      key = e.paid_at.slice(0, 7)
      label = `${date.getFullYear()}.${date.getMonth() + 1}`
    }

    if (!map[key]) map[key] = { income: 0, expense: 0, label }
    if (e.is_income) {
      map[key].income += e.amount
    } else {
      map[key].expense += e.amount
    }
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
}

const BUDGET_KEY = 'lucas-monthly-budget'

function loadBudget(): number {
  try {
    return parseInt(localStorage.getItem(BUDGET_KEY) || '0') || 0
  } catch {
    return 0
  }
}

function saveBudget(v: number) {
  try { localStorage.setItem(BUDGET_KEY, String(v)) } catch {}
}

// --- Sub-components ---

function TrendChart({ expenses, period }: { expenses: ExpenseItem[]; period: TrendPeriod }) {
  const data = useMemo(() => aggregateByPeriod(expenses, period), [expenses, period])

  if (data.length === 0) {
    return <div className="text-xs text-slate-500 text-center py-6">No data for trend chart</div>
  }

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="label" {...commonAxisProps} minTickGap={15} />
          <YAxis {...commonAxisProps} width={50} tickFormatter={v => v >= 10000 ? `${Math.round(v / 10000)}M` : v.toLocaleString()} />
          <Tooltip
            {...commonTooltipProps}
            formatter={(v: number, name: string) => [`${v.toLocaleString()} KRW`, name === 'income' ? 'Income' : 'Expense']}
          />
          <Area type="monotone" dataKey="income" stroke={CHART_COLORS.income} fill="url(#gradIncome)" strokeWidth={1.5} dot={false} />
          <Area type="monotone" dataKey="expense" stroke={CHART_COLORS.expense} fill="url(#gradExpense)" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function CategoryDrilldown({ expenses, summary }: { expenses: ExpenseItem[]; summary: ExpenseSummary }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const expenseBreakdown = useMemo(() => {
    return (summary.breakdown || [])
      .filter(b => !b.is_income && b.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [summary])

  const totalExpense = summary.total_expense || 1

  const categoryItems = useMemo(() => {
    if (!expanded) return []
    return expenses
      .filter(e => !e.is_income && e.category === expanded)
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
  }, [expenses, expanded])

  if (expenseBreakdown.length === 0) return null

  return (
    <div className="space-y-1">
      {expenseBreakdown.map(b => {
        const pct = Math.round((b.total / totalExpense) * 100)
        const isOpen = expanded === b.category

        return (
          <div key={b.category}>
            <button
              onClick={() => setExpanded(isOpen ? null : b.category)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                isOpen ? 'bg-slate-700/40' : 'hover:bg-slate-700/20'
              }`}
            >
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-slate-500 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[b.category] || ACCENT.gray }} />
              <span className="text-xs text-slate-300 flex-1">{CAT_LABELS[b.category] || b.category}</span>
              <span className="text-xs text-slate-400 tabular-nums">{b.total.toLocaleString()}</span>
              <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
              {/* Mini bar */}
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: EXPENSE_COLORS[b.category] || ACCENT.gray }}
                />
              </div>
            </button>

            {/* Drilldown items */}
            {isOpen && categoryItems.length > 0 && (
              <div className="ml-8 mr-2 mb-1 space-y-0.5">
                {categoryItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-slate-900/30">
                    <span className="text-slate-300 flex-1 min-w-0 truncate">
                      {item.description || '-'}
                    </span>
                    <span className="text-red-400 tabular-nums shrink-0">-{item.amount.toLocaleString()}</span>
                    <span className="text-slate-600 shrink-0">
                      {new Date(item.paid_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BudgetProgress({ summary, budget, onSetBudget }: {
  summary: ExpenseSummary
  budget: number
  onSetBudget: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(budget || ''))

  const spent = summary.total_expense
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0

  const save = () => {
    const v = parseInt(input) || 0
    onSetBudget(v)
    setEditing(false)
  }

  return (
    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Monthly Budget</span>
        {!editing ? (
          <button onClick={() => { setInput(String(budget || '')); setEditing(true) }}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
            {budget > 0 ? 'Edit' : 'Set Budget'}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="Amount"
              className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500"
            />
            <button onClick={save} className="text-[10px] text-blue-400 hover:text-blue-300">OK</button>
            <button onClick={() => setEditing(false)} className="text-[10px] text-slate-500 hover:text-slate-300">x</button>
          </div>
        )}
      </div>

      {budget > 0 ? (
        <>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{spent.toLocaleString()} / {budget.toLocaleString()} KRW</span>
            <span className={`font-medium ${pct > 100 ? 'text-red-400' : pct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {pct}%
              {pct > 100 && <span className="text-red-400 ml-1">OVER</span>}
            </span>
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            {budget - spent >= 0
              ? `${(budget - spent).toLocaleString()} KRW remaining`
              : `${(spent - budget).toLocaleString()} KRW over budget`}
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-600">Set a monthly budget to track spending</div>
      )}
    </div>
  )
}

function ApiCostSection() {
  const [daily, setDaily] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    fetchJson<{ daily: any[] }>('/api/usage/daily').then(d => setDaily((d.daily || []).reverse())).catch(() => {})
    fetchJson<any>('/api/usage').then(setUsage).catch(() => {})
  }, [])

  if (!usage && daily.length === 0) return null

  const budgetPct = usage ? Math.round((usage.total_cost_usd / (usage.budget_usd || 5)) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Budget Bar */}
      {usage && (
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">API Budget</span>
            <span className="text-xs text-slate-400">
              <span className="text-amber-400">${usage.total_cost_usd?.toFixed(4)}</span>
              <span className="text-slate-600 mx-1">/</span>
              ${usage.budget_usd || 5}
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>{usage.api_calls || 0} calls | {(usage.total_tokens || 0).toLocaleString()} tokens</span>
            <span>{Math.round(usage.budget_remaining_krw || 0).toLocaleString()} KRW left</span>
          </div>
        </div>
      )}

      {/* Daily Cost + Token Chart */}
      {daily.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Daily API Cost</div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gradApiCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.apiCost} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.apiCost} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...commonGridProps} />
                  <XAxis dataKey="day" {...commonAxisProps} tickFormatter={d => d.slice(5)} minTickGap={20} />
                  <YAxis {...commonAxisProps} width={40} tickFormatter={v => `$${v}`} />
                  <Tooltip {...commonTooltipProps} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                  <Area type="monotone" dataKey="cost_usd" stroke={CHART_COLORS.apiCost} fill="url(#gradApiCost)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Daily Tokens</div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <CartesianGrid {...commonGridProps} />
                  <XAxis dataKey="day" {...commonAxisProps} tickFormatter={d => d.slice(5)} minTickGap={20} />
                  <YAxis {...commonAxisProps} width={40} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip {...commonTooltipProps} formatter={(v: number, name: string) => [v.toLocaleString(), name === 'input_tokens' ? 'Input' : 'Output']} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={legendStyle} />
                  <Bar dataKey="input_tokens" name="Input" fill={CHART_COLORS.cpu} stackId="t" />
                  <Bar dataKey="output_tokens" name="Output" fill={CHART_COLORS.tokens} stackId="t" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Panel ---

export function ExpensePanel() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [description, setDescription] = useState('')
  const [isIncome, setIsIncome] = useState(false)
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('daily')
  const [budget, setBudget] = useState(loadBudget)
  const [activeSection, setActiveSection] = useState<'overview' | 'api'>('overview')

  const currentMonth = new Date().toISOString().slice(0, 7)

  const load = () => {
    api.expenses().then(d => setExpenses(d.expenses || []))
    api.expenseSummary(currentMonth).then(d => setSummary(d))
  }

  useEffect(() => { load() }, [])

  const handleSetBudget = (v: number) => {
    setBudget(v)
    saveBudget(v)
  }

  const submit = async () => {
    const amt = parseInt(amount)
    if (!amt || amt <= 0) return
    await api.addExpense({
      amount: amt,
      category: isIncome ? 'income' : category,
      description: description.trim() || undefined,
      is_income: isIncome,
    })
    setAmount('')
    setDescription('')
    setShowForm(false)
    load()
  }

  const remove = async (id: number) => {
    await api.deleteExpense(id)
    load()
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-medium">Expenses</h2>
          {/* Section Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-900/50 rounded-md p-0.5 ml-2">
            <button
              onClick={() => setActiveSection('overview')}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                activeSection === 'overview' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveSection('api')}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                activeSection === 'api' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              API Cost
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadExport('/api/export/expenses?format=csv', 'expenses.csv')}
            className="px-2 py-1 text-[10px] rounded bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition" title="Export CSV">
            CSV
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition">
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeSection === 'overview' ? (
          <div className="space-y-0">
            {/* Summary Cards */}
            {summary && (
              <div className="px-4 py-3 border-b border-slate-700/50 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Income</div>
                  <div className="text-green-400 text-sm font-bold">+{summary.total_income.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Expense</div>
                  <div className="text-red-400 text-sm font-bold">-{summary.total_expense.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Balance</div>
                  <div className={`text-sm font-bold ${summary.balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {summary.balance >= 0 ? '+' : ''}{summary.balance.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Budget Progress */}
            {summary && (
              <div className="px-4 py-3 border-b border-slate-700/50">
                <BudgetProgress summary={summary} budget={budget} onSetBudget={handleSetBudget} />
              </div>
            )}

            {/* Trend Chart */}
            {expenses.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Spending Trend</span>
                  <div className="flex items-center gap-0.5 bg-slate-900/50 rounded-md p-0.5">
                    {(['daily', 'weekly', 'monthly'] as TrendPeriod[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setTrendPeriod(p)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-colors capitalize ${
                          trendPeriod === p ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <TrendChart expenses={expenses} period={trendPeriod} />
              </div>
            )}

            {/* Charts Row: Donut + Income vs Expense */}
            {summary && summary.breakdown && summary.breakdown.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Donut Chart */}
                  {(() => {
                    const expenseData = summary.breakdown
                      .filter(b => !b.is_income && b.total > 0)
                      .map(b => ({ name: CAT_LABELS[b.category] || b.category, value: b.total, category: b.category }))
                    if (expenseData.length === 0) return null
                    const total = expenseData.reduce((s, d) => s + d.value, 0)
                    return (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Expense Breakdown</div>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={expenseData}
                                cx="50%" cy="50%"
                                innerRadius={40} outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {expenseData.map((entry, idx) => (
                                  <Cell key={idx} fill={EXPENSE_COLORS[entry.category] || ACCENT.gray} />
                                ))}
                              </Pie>
                              <Tooltip {...commonTooltipProps} formatter={(value: number) => [`${value.toLocaleString()} KRW`, '']} />
                              <text x="50%" y="48%" textAnchor="middle" fill={SURFACE.textSecondary} fontSize={10}>Total</text>
                              <text x="50%" y="58%" textAnchor="middle" fill={SURFACE.textPrimary} fontSize={13} fontWeight="bold">
                                {total >= 10000 ? `${Math.round(total / 10000)}M` : total.toLocaleString()}
                              </text>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Income vs Expense Bar */}
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Income vs Expense</div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[{
                            name: summary.month,
                            income: summary.total_income,
                            expense: summary.total_expense,
                          }]}
                          margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
                        >
                          <CartesianGrid {...commonGridProps} />
                          <XAxis dataKey="name" {...commonAxisProps} />
                          <YAxis {...commonAxisProps} width={50} tickFormatter={v => v >= 10000 ? `${Math.round(v / 10000)}M` : v.toLocaleString()} />
                          <Tooltip {...commonTooltipProps} formatter={(v: number) => [`${v.toLocaleString()} KRW`, '']} />
                          <Bar dataKey="income" name="Income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" name="Expense" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-1">
                      <span className={`text-xs font-bold ${summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {summary.balance >= 0 ? '+' : ''}{summary.balance.toLocaleString()} KRW
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">balance</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Drilldown */}
            {summary && summary.breakdown && summary.breakdown.filter(b => !b.is_income).length > 0 && (
              <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Category Details</div>
                <CategoryDrilldown expenses={expenses} summary={summary} />
              </div>
            )}

            {/* Add Form */}
            {showForm && (
              <div className="p-4 border-b border-slate-700/50 space-y-3">
                <div className="flex gap-2">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="Amount (KRW)" className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600 focus:border-blue-500" />
                  <button onClick={() => setIsIncome(!isIncome)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isIncome ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                    {isIncome ? 'Income' : 'Expense'}
                  </button>
                </div>
                <div className="flex gap-2">
                  {!isIncome && (
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600">
                      {CATEGORIES.filter(c => c !== 'income').map(c => (
                        <option key={c} value={c}>{CAT_LABELS[c]}</option>
                      ))}
                    </select>
                  )}
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Description" className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600" />
                </div>
                <button onClick={submit} disabled={!amount || parseInt(amount) <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition">
                  Record
                </button>
              </div>
            )}

            {/* Expense List */}
            <div className="p-4 space-y-2">
              {expenses.length === 0 && (
                <div className="text-center text-slate-500 mt-6">
                  <p className="text-sm">No expenses yet</p>
                  <p className="text-xs mt-1">Add one or tell the PM in chat</p>
                </div>
              )}
              {expenses.map(e => (
                <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-700/30">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[e.category] || ACCENT.gray }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${e.is_income ? 'text-green-400' : 'text-white'}`}>
                        {e.is_income ? '+' : '-'}{e.amount.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500">{CAT_LABELS[e.category] || e.category}</span>
                    </div>
                    {e.description && <div className="text-xs text-slate-400 truncate">{e.description}</div>}
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">
                    {new Date(e.paid_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </div>
                  <button onClick={() => remove(e.id)} className="text-slate-600 hover:text-red-400 text-xs transition">x</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* API Cost Section */
          <div className="p-4">
            <ApiCostSection />
          </div>
        )}
      </div>
    </div>
  )
}
