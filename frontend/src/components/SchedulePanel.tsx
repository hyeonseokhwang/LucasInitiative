import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { ScheduleItem } from '../types'

const CATEGORIES = ['general', 'work', 'personal', 'meeting']
const CAT_COLORS: Record<string, string> = {
  general: 'bg-blue-500',
  work: 'bg-amber-500',
  personal: 'bg-green-500',
  meeting: 'bg-purple-500',
}

export function SchedulePanel() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [category, setCategory] = useState('general')
  const [description, setDescription] = useState('')

  const load = () => {
    api.schedules().then(d => setSchedules(d.schedules || []))
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!title.trim() || !startAt) return
    await api.addSchedule({
      title: title.trim(),
      start_at: startAt,
      end_at: endAt || undefined,
      category,
      description: description.trim() || undefined,
    })
    setTitle('')
    setStartAt('')
    setEndAt('')
    setDescription('')
    setShowForm(false)
    load()
  }

  const remove = async (id: number) => {
    await api.deleteSchedule(id)
    load()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    let relative = ''
    if (days === 0) relative = 'Today'
    else if (days === 1) relative = 'Tomorrow'
    else if (days > 1 && days < 7) relative = `${days}d later`
    else if (days < 0) relative = `${-days}d ago`

    const dateStr = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
    const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

    return { dateStr, timeStr, relative, isPast: diff < 0 }
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <h2 className="text-white font-medium">Schedules</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="p-4 border-b border-slate-700/50 space-y-3">
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Title" className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600 focus:border-blue-500"
          />
          <div className="flex gap-2">
            <input
              type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
              className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600"
            />
            <input
              type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)}
              placeholder="End (optional)" className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)" className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none border border-slate-600"
            />
          </div>
          <button onClick={submit} disabled={!title.trim() || !startAt}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition">
            Add Schedule
          </button>
        </div>
      )}

      {/* Schedule List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {schedules.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <p className="text-sm">No schedules yet</p>
            <p className="text-xs mt-1">Add one or ask the PM in chat</p>
          </div>
        )}
        {schedules.map(s => {
          const { dateStr, timeStr, relative, isPast } = formatDate(s.start_at)
          return (
            <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg ${isPast ? 'bg-slate-800/50 opacity-60' : 'bg-slate-700/50'}`}>
              <div className={`w-2 h-2 rounded-full mt-2 ${CAT_COLORS[s.category] || 'bg-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">{s.title}</span>
                  {relative && <span className="text-xs text-blue-400 shrink-0">{relative}</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{dateStr} {timeStr}</div>
                {s.description && <div className="text-xs text-slate-500 mt-1">{s.description}</div>}
              </div>
              <button onClick={() => remove(s.id)}
                className="text-slate-600 hover:text-red-400 text-xs transition shrink-0">
                x
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
