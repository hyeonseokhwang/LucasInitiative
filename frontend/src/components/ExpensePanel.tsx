import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { ExpenseItem, ExpenseSummary } from '../types'

const CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'income', 'etc']
const CAT_LABELS: Record<string, string> = {
  food: 'Food', transport: 'Transport', shopping: 'Shopping',
  bills: 'Bills', entertainment: 'Entertainment', income: 'Income', etc: 'Etc',
}
const CAT_EMOJI: Record<string, string> = {
  food: '', transport: '', shopping: '', bills: '',
  entertainment: '', income: '', etc: '',
}

export function ExpensePanel() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [description, setDescription] = useState('')
  const [isIncome, setIsIncome] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)

  const load = () => {
    api.expenses().then(d => setExpenses(d.expenses || []))
    api.expenseSummary(currentMonth).then(d => setSummary(d))
  }

  useEffect(() => { load() }, [])

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
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <h2 className="text-white font-medium">Expenses</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition">
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="px-4 py-3 border-b border-slate-700/50 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-slate-400">Income</div>
            <div className="text-green-400 text-sm font-medium">+{summary.total_income.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Expense</div>
            <div className="text-red-400 text-sm font-medium">-{summary.total_expense.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Balance</div>
            <div className={`text-sm font-medium ${summary.balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {summary.balance.toLocaleString()}
            </div>
          </div>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {expenses.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <p className="text-sm">No expenses yet</p>
            <p className="text-xs mt-1">Add one or tell the PM in chat</p>
          </div>
        )}
        {expenses.map(e => (
          <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-700/30">
            <span className="text-lg w-6 text-center">{CAT_EMOJI[e.category] || CAT_EMOJI.etc}</span>
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
  )
}
