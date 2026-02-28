import { useState, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { api } from './lib/api'
import { SystemMetrics } from './components/SystemMetrics'
import { OllamaStatus } from './components/OllamaStatus'
import { TaskLog } from './components/TaskLog'
import { ChatPanel } from './components/ChatPanel'
import { SchedulePanel } from './components/SchedulePanel'
import { ExpensePanel } from './components/ExpensePanel'
import { ReportsPanel } from './components/ReportsPanel'
import { CompanyView } from './components/CompanyView'

type View = 'company' | 'dashboard' | 'chat' | 'schedule' | 'expense' | 'reports'

function App() {
  const { metrics, connected, chatTokens, chatComplete, taskUpdate, agentUpdate } = useWebSocket()
  const [view, setView] = useState<View>('company')
  const [usage, setUsage] = useState<any>(null)

  // Load usage on mount and after chat completes
  useEffect(() => { api.usage().then(setUsage).catch(() => {}) }, [])
  useEffect(() => { if (chatComplete) api.usage().then(setUsage).catch(() => {}) }, [chatComplete])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700/50 px-4 py-3 flex items-center gap-4 sticky top-0 z-50 backdrop-blur-sm">
        <h1 className="text-lg font-bold text-white tracking-tight">LUCAS AI</h1>

        {/* Mini metrics */}
        {metrics && (
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 ml-2">
            <span>CPU {metrics.cpu.percent.toFixed(0)}%</span>
            <span>GPU {metrics.gpu.util_percent}%</span>
            <span>RAM {metrics.ram.used_gb}/{metrics.ram.total_gb}GB</span>
            <span>VRAM {(metrics.gpu.mem_used_mb / 1024).toFixed(1)}GB</span>
          </div>
        )}

        {/* API Usage */}
        {usage && (
          <div className="hidden md:flex items-center gap-3 text-xs">
            <span className="text-slate-500">API</span>
            <span className="text-amber-400">{usage.api_calls} calls</span>
            <span className="text-slate-400">{(usage.total_tokens || 0).toLocaleString()} tok</span>
            <span className="text-green-400">${usage.total_cost_usd?.toFixed(4)} ({Math.round(usage.total_cost_krw || 0).toLocaleString()}won)</span>
            <span className="text-slate-500">/ ${usage.budget_usd} ({Math.round(usage.budget_usd * (usage.exchange_rate || 1400)).toLocaleString()}won)</span>
          </div>
        )}

        {/* Connection status */}
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-500">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-800/40 border-b border-slate-700/30 px-4 flex gap-1">
        {(['company', 'dashboard', 'chat', 'schedule', 'expense', 'reports'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              view === v
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {{ company: 'Company', dashboard: 'Dashboard', chat: 'Chat', schedule: 'Schedule', expense: 'Expense', reports: 'Reports' }[v]}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="p-4 max-w-7xl mx-auto">
        {view === 'company' && (
          <CompanyView agentUpdate={agentUpdate} />
        )}

        {view === 'dashboard' && (
          <div className="space-y-4">
            <SystemMetrics data={metrics} />
            <OllamaStatus data={metrics?.ollama || null} />
            <TaskLog taskUpdate={taskUpdate} />
          </div>
        )}

        {view === 'chat' && (
          <div className="h-[calc(100vh-120px)]">
            <ChatPanel chatTokens={chatTokens} chatComplete={chatComplete} />
          </div>
        )}

        {view === 'schedule' && (
          <div className="h-[calc(100vh-120px)]">
            <SchedulePanel />
          </div>
        )}

        {view === 'expense' && (
          <div className="h-[calc(100vh-120px)]">
            <ExpensePanel />
          </div>
        )}

        {view === 'reports' && (
          <div className="h-[calc(100vh-120px)]">
            <ReportsPanel />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
