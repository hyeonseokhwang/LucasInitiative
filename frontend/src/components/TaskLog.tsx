import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { TaskItem } from '../types'

interface Props {
  taskUpdate: any
}

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-slate-500/20 text-slate-300',
  pending: 'bg-yellow-500/20 text-yellow-300',
}

export function TaskLog({ taskUpdate }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([])

  const loadTasks = async () => {
    try {
      const data = await api.tasks()
      setTasks(data.tasks)
    } catch {}
  }

  useEffect(() => { loadTasks() }, [])
  useEffect(() => { if (taskUpdate) loadTasks() }, [taskUpdate])

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-medium text-white">Recent Tasks</h3>
      </div>
      <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="p-4 text-sm text-slate-500 text-center">No tasks yet. Start a chat!</p>
        )}
        {tasks.map(t => (
          <div key={t.id} className="px-4 py-2 flex items-center gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[t.status] || ''}`}>
              {t.status}
            </span>
            <span className="text-slate-300 truncate flex-1">
              {t.description || t.type}
            </span>
            {t.model && (
              <span className="text-xs text-slate-500">{t.model}</span>
            )}
            {t.completed_at && t.started_at && (
              <span className="text-xs text-slate-500 tabular-nums">
                {((new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
