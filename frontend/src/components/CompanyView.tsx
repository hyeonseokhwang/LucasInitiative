import { useState, useEffect } from 'react'
import { fetchJson } from '../lib/api'

interface AgentLog {
  time: string
  status: string
  task: string
  report: string
}

interface Agent {
  id: string
  name: string
  role: string
  department: string
  avatar: string
  status: string
  current_task: string
  last_report: string
  last_active: string | null
  task_count: number
  logs: AgentLog[]
}

const AVATAR_MAP: Record<string, string> = {
  boss: '\u{1F468}\u{200D}\u{1F4BC}',
  director: '\u{1F916}',
  trader: '\u{1F4C8}',
  building: '\u{1F3E0}',
  developer: '\u{1F468}\u{200D}\u{1F4BB}',
  designer: '\u{1F3A8}',
  government: '\u{1F3DB}',
}

const STATUS_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  idle: { dot: 'bg-slate-400', label: 'Standby', bg: 'border-slate-600/50' },
  working: { dot: 'bg-emerald-400 animate-pulse', label: 'Working', bg: 'border-emerald-500/50 shadow-emerald-500/10 shadow-lg' },
  reporting: { dot: 'bg-blue-400 animate-pulse', label: 'Reporting', bg: 'border-blue-500/50' },
  sleeping: { dot: 'bg-slate-600', label: 'Offline', bg: 'border-slate-700/50 opacity-60' },
}

const DEPT_COLORS: Record<string, string> = {
  headquarters: 'from-amber-500/20 to-amber-600/5',
  stock_division: 'from-green-500/20 to-green-600/5',
  realestate_division: 'from-blue-500/20 to-blue-600/5',
  dev_division: 'from-purple-500/20 to-purple-600/5',
  design_division: 'from-pink-500/20 to-pink-600/5',
  govt_division: 'from-cyan-500/20 to-cyan-600/5',
}

export function CompanyView({ agentUpdate }: { agentUpdate: any }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<Agent | null>(null)
  const [detailLogs, setDetailLogs] = useState<AgentLog[]>([])

  useEffect(() => {
    fetchJson<{ agents: Agent[] }>('/api/agents').then(d => setAgents(d.agents || []))
  }, [])

  // Update agent status from WebSocket
  useEffect(() => {
    if (agentUpdate) {
      setAgents(prev => prev.map(a =>
        a.id === agentUpdate.id
          ? { ...a, status: agentUpdate.status, current_task: agentUpdate.current_task, last_report: agentUpdate.last_report || a.last_report, task_count: agentUpdate.task_count || a.task_count }
          : a
      ))
      // Update selected detail if viewing
      if (selected?.id === agentUpdate.id) {
        setSelected(prev => prev ? { ...prev, status: agentUpdate.status, current_task: agentUpdate.current_task, last_report: agentUpdate.last_report || prev.last_report } : null)
      }
    }
  }, [agentUpdate])

  const openDetail = async (agent: Agent) => {
    setSelected(agent)
    const data = await fetchJson<{ logs: AgentLog[] }>(`/api/agents/${agent.id}/logs`)
    setDetailLogs(data.logs || [])
  }

  const hq = agents.filter(a => a.department === 'headquarters')
  const divisions = agents.filter(a => a.department !== 'headquarters')

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">LUCAS INITIATIVE</h2>
        <p className="text-sm text-slate-400 mt-1">AI-Powered Virtual Company</p>
      </div>

      {/* HQ Row */}
      <div className="flex justify-center gap-4">
        {hq.map(agent => (
          <AgentCard key={agent.id} agent={agent} onClick={() => openDetail(agent)} large />
        ))}
      </div>

      {/* Org Line */}
      <div className="flex justify-center">
        <div className="w-px h-8 bg-slate-600" />
      </div>

      {/* Divisions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {divisions.map(agent => (
          <AgentCard key={agent.id} agent={agent} onClick={() => openDetail(agent)} />
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Detail Header */}
            <div className={`p-5 bg-gradient-to-b ${DEPT_COLORS[selected.department] || ''}`}>
              <div className="flex items-center gap-4">
                <div className="text-4xl">{AVATAR_MAP[selected.avatar] || '\u{1F464}'}</div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                  <p className="text-sm text-slate-300">{selected.role}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${STATUS_STYLES[selected.status]?.dot || 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-400">{STATUS_STYLES[selected.status]?.label || selected.status}</span>
                    <span className="text-xs text-slate-500">| {selected.task_count} tasks done</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  className="ml-auto text-slate-400 hover:text-white text-xl">x</button>
              </div>
              {selected.current_task && selected.status === 'working' && (
                <div className="mt-3 bg-slate-900/40 rounded-lg px-3 py-2">
                  <span className="text-xs text-emerald-400">Currently: </span>
                  <span className="text-sm text-white">{selected.current_task}</span>
                </div>
              )}
              {selected.last_report && (
                <div className="mt-2 bg-slate-900/30 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">Last report: </span>
                  <span className="text-sm text-slate-300">{selected.last_report}</span>
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div className="p-4 overflow-y-auto max-h-[40vh]">
              <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Activity Log</h4>
              {detailLogs.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No activity yet</p>
              )}
              {[...detailLogs].reverse().map((log, i) => (
                <div key={i} className="flex gap-3 mb-2.5">
                  <span className="text-xs text-slate-500 w-14 shrink-0 mt-0.5">{log.time}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        log.status === 'working' ? 'bg-emerald-400' : 'bg-slate-500'
                      }`} />
                      <span className="text-sm text-slate-300">{log.task || log.status}</span>
                    </div>
                    {log.report && (
                      <p className="text-xs text-slate-500 ml-3.5 mt-0.5">{log.report}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, onClick, large }: { agent: Agent; onClick: () => void; large?: boolean }) {
  const style = STATUS_STYLES[agent.status] || STATUS_STYLES.idle
  const deptColor = DEPT_COLORS[agent.department] || ''

  return (
    <button
      onClick={onClick}
      className={`relative bg-gradient-to-b ${deptColor} bg-slate-800/60 rounded-xl border ${style.bg} p-4 transition-all hover:scale-105 hover:bg-slate-700/60 text-left ${large ? 'w-48' : 'w-full'}`}
    >
      {/* Status dot */}
      <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${style.dot}`} />

      {/* Avatar */}
      <div className={`${large ? 'text-3xl' : 'text-2xl'} mb-2`}>
        {AVATAR_MAP[agent.avatar] || '\u{1F464}'}
      </div>

      {/* Info */}
      <div className="font-medium text-white text-sm">{agent.name}</div>
      <div className="text-xs text-slate-400 mt-0.5">{agent.role}</div>

      {/* Speech Bubble */}
      {agent.status === 'working' && agent.current_task && (
        <div className="mt-2 bg-slate-900/60 rounded-lg px-2 py-1.5 relative">
          <div className="absolute -top-1 left-3 w-2 h-2 bg-slate-900/60 rotate-45" />
          <p className="text-xs text-emerald-300 truncate">{agent.current_task}</p>
        </div>
      )}
      {agent.status === 'idle' && agent.last_report && (
        <div className="mt-2 bg-slate-900/40 rounded-lg px-2 py-1.5 relative">
          <div className="absolute -top-1 left-3 w-2 h-2 bg-slate-900/40 rotate-45" />
          <p className="text-xs text-slate-400 truncate">{agent.last_report}</p>
        </div>
      )}

      {/* Task count */}
      {agent.task_count > 0 && (
        <div className="mt-2 text-xs text-slate-500">{agent.task_count} tasks</div>
      )}
    </button>
  )
}
