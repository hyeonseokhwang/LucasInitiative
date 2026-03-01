import { useState, useEffect, useMemo, useCallback } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { LocaleContext, loadLocale, saveLocale, useLocale } from './hooks/useLocale'
import { messages } from './lib/i18n'
import type { Locale } from './lib/i18n'
import { api } from './lib/api'
import { SystemMetrics } from './components/SystemMetrics'
import { MetricsChart } from './components/MetricsChart'
import { UsageChart } from './components/UsageChart'
import { OllamaStatus } from './components/OllamaStatus'
import { TaskLog } from './components/TaskLog'
import { ChatPanel } from './components/ChatPanel'
import { SchedulePanel } from './components/SchedulePanel'
import { ExpensePanel } from './components/ExpensePanel'
import { ReportsPanel } from './components/ReportsPanel'
import { ResearchPanel } from './components/ResearchPanel'
import { CompanyView } from './components/CompanyView'
import { StockPanel } from './components/StockPanel'
import { PortfolioPanel } from './components/PortfolioPanel'
import { SectorPanel } from './components/SectorPanel'
import { RealEstatePanel } from './components/RealEstatePanel'
import { WatchlistPanel } from './components/WatchlistPanel'
import { HomeOverview } from './components/HomeOverview'
import { SettingsPanel } from './components/SettingsPanel'
import { ModelManagementPanel } from './components/ModelManagementPanel'
import { LogViewer } from './components/LogViewer'
import { InputHistoryPanel } from './components/InputHistoryPanel'
import { SignalPanel } from './components/SignalPanel'
import { DailyReportPanel } from './components/DailyReportPanel'
import { SentimentPanel } from './components/SentimentPanel'
import { DivisionPanel } from './components/DivisionPanel'
import { WorkerJobPanel } from './components/WorkerJobPanel'
import { TokenUsagePanel } from './components/TokenUsagePanel'
import { CommandPalette, type PaletteCommand } from './components/CommandPalette'
import { NotificationBell } from './components/NotificationBell'
import { PanelWrapper } from './components/PanelWrapper'
import { GridLayout } from './components/GridLayout'
import { useLayoutSettings } from './hooks/useLayoutSettings'

type View = 'home' | 'company' | 'dashboard' | 'chat' | 'schedule' | 'expense' | 'stocks' | 'portfolio' | 'sectors' | 'realestate' | 'watchlist' | 'reports' | 'research' | 'signals' | 'inputhistory' | 'dailyreport' | 'sentiment' | 'divisions' | 'workers' | 'tokenusage' | 'models' | 'logs' | 'settings'

function AppInner() {
  const { metrics, connected, chatTokens, chatComplete, taskUpdate, agentUpdate, collectorAlert, researchUpdate, researchComplete } = useWebSocket()
  const { locale, setLocale, t } = useLocale()
  const [view, setView] = useState<View>('home')
  const [usage, setUsage] = useState<any>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [globalRefresh, setGlobalRefresh] = useState(0)
  const refreshAll = useCallback(() => setGlobalRefresh(t => t + 1), [])
  const layout = useLayoutSettings()

  // Load usage on mount and after chat completes
  useEffect(() => { api.usage().then(setUsage).catch(() => {}) }, [])
  useEffect(() => { if (chatComplete) api.usage().then(setUsage).catch(() => {}) }, [chatComplete])

  // Tab list for shortcuts (order = Ctrl+1~9 mapping)
  const TABS: View[] = ['home', 'company', 'dashboard', 'chat', 'schedule', 'expense', 'stocks', 'portfolio', 'sectors']

  const navigateTo = useCallback((v: View) => setView(v), [])

  // Keyboard shortcuts: Ctrl+1~9 for tabs, Ctrl+K for palette, Esc to close
  useKeyboardShortcuts(useMemo(() => [
    ...TABS.map((tab, i) => ({
      key: String(i + 1), ctrl: true,
      action: () => navigateTo(tab),
      description: `Go to ${tab}`,
    })),
    { key: 'k', ctrl: true, action: () => setPaletteOpen(v => !v), description: 'Command palette' },
    { key: 'Escape', action: () => setPaletteOpen(false), description: 'Close palette' },
  ], [navigateTo]))

  // Command palette commands — use locale-aware labels
  const TAB_LABELS = t.nav

  const paletteCommands: PaletteCommand[] = useMemo(() => [
    // Navigation commands
    ...Object.entries(TAB_LABELS).map(([key, label], i) => ({
      id: `nav-${key}`,
      label: `Go to ${label}`,
      category: 'Navigate',
      shortcut: i < 9 ? `Ctrl+${i + 1}` : undefined,
      action: () => navigateTo(key as View),
    })),
    // Action commands
    { id: 'act-research', label: 'Start New Research', category: 'Action', action: () => { navigateTo('research') } },
    { id: 'act-chat', label: 'Start New Chat', category: 'Action', action: () => { navigateTo('chat') } },
    { id: 'act-expense', label: 'Add Expense', category: 'Action', action: () => { navigateTo('expense') } },
    { id: 'act-schedule', label: 'Add Schedule', category: 'Action', action: () => { navigateTo('schedule') } },
    { id: 'act-watchlist', label: 'Add to Watchlist', category: 'Action', action: () => { navigateTo('watchlist') } },
    { id: 'act-refresh', label: 'Refresh All Panels', category: 'Action', action: () => { refreshAll() } },
    { id: 'act-grid', label: 'Switch to Grid Mode', category: 'Action', action: () => { layout.setMode('grid') } },
    { id: 'act-focus', label: 'Switch to Focus Mode', category: 'Action', action: () => { layout.setMode('focus') } },
    // Search commands
    { id: 'search-stock', label: 'Search Stocks', category: 'Search', action: () => { navigateTo('stocks') } },
    { id: 'search-realestate', label: 'Search Real Estate', category: 'Search', action: () => { navigateTo('realestate') } },
    { id: 'search-reports', label: 'Browse Reports', category: 'Search', action: () => { navigateTo('reports') } },
  ], [navigateTo])

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

        {/* Layout Toggle + Global Refresh + Command Palette + Connection status */}
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell
            collectorAlert={collectorAlert}
            researchComplete={researchComplete}
            onNavigate={(v) => setView(v as View)}
          />
          <button
            onClick={() => layout.setMode(layout.mode === 'focus' ? 'grid' : 'focus')}
            className={`p-1.5 rounded-md transition-colors ${
              layout.mode === 'grid'
                ? 'bg-blue-600/30 text-blue-400 hover:bg-blue-600/40'
                : 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
            }`}
            title={layout.mode === 'grid' ? 'Switch to Focus mode' : 'Switch to Grid mode'}
          >
            {layout.mode === 'grid' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            )}
          </button>
          <button
            onClick={refreshAll}
            className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh all panels"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.22-8.56" /><path d="M21 3v9h-9" />
            </svg>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-700/50 border border-slate-600/50
              text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <span>Search</span>
            <kbd className="text-[10px] bg-slate-600/50 px-1 py-0.5 rounded">Ctrl+K</kbd>
          </button>
          <button
            onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
            className="px-2 py-1 text-xs rounded-md bg-slate-700/50 border border-slate-600/50 text-slate-400 hover:text-white hover:border-slate-500 transition-colors font-medium"
            title="Switch language"
          >
            {locale === 'ko' ? 'EN' : 'KO'}
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-xs text-slate-500">{connected ? t.live : t.disconnected}</span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-800/40 border-b border-slate-700/30 px-4 flex gap-1 overflow-x-auto">
        {(['home', 'divisions', 'workers', 'tokenusage', 'stocks', 'realestate', 'signals', 'sentiment', 'dailyreport', 'research', 'inputhistory', 'dashboard', 'company', 'chat', 'schedule', 'expense', 'portfolio', 'sectors', 'watchlist', 'reports', 'models', 'logs', 'settings'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              view === v
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.nav[v]}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="p-4 max-w-7xl mx-auto">
        {/* Grid Mode */}
        {layout.mode === 'grid' && (
          <GridLayout
            selectedPanels={layout.selectedPanels}
            preset={layout.preset}
            onTogglePanel={layout.togglePanel}
            onSetPreset={layout.setPreset}
            onNavigate={(v) => { layout.setMode('focus'); setView(v as View) }}
            metrics={metrics}
          />
        )}

        {/* Focus Mode */}
        {layout.mode === 'focus' && view === 'home' && (
          <HomeOverview metrics={metrics} onNavigate={(v) => setView(v as View)} />
        )}

        {layout.mode === 'focus' && view === 'company' && (
          <CompanyView agentUpdate={agentUpdate} />
        )}

        {layout.mode === 'focus' && view === 'dashboard' && (
          <div className="space-y-4">
            <SystemMetrics data={metrics} />
            <MetricsChart liveMetrics={metrics} />
            <UsageChart />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <OllamaStatus data={metrics?.ollama || null} />
              <TaskLog taskUpdate={taskUpdate} />
            </div>
          </div>
        )}

        {layout.mode === 'focus' && view === 'chat' && (
          <div className="h-[calc(100vh-120px)]">
            <ChatPanel chatTokens={chatTokens} chatComplete={chatComplete} />
          </div>
        )}

        {layout.mode === 'focus' && view === 'schedule' && (
          <PanelWrapper title="Schedule" refreshTrigger={globalRefresh}>
            <SchedulePanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'expense' && (
          <PanelWrapper title="Expenses" refreshTrigger={globalRefresh}>
            <ExpensePanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'stocks' && (
          <PanelWrapper title="Stocks" interval={30000} refreshTrigger={globalRefresh}>
            <StockPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'portfolio' && (
          <PanelWrapper title="Portfolio" interval={30000} refreshTrigger={globalRefresh}>
            <PortfolioPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'sectors' && (
          <PanelWrapper title="Sectors" interval={30000} refreshTrigger={globalRefresh}>
            <SectorPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'realestate' && (
          <PanelWrapper title="Real Estate" interval={60000} refreshTrigger={globalRefresh}>
            <RealEstatePanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'watchlist' && (
          <PanelWrapper title="Watchlist" interval={60000} refreshTrigger={globalRefresh}>
            <WatchlistPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'reports' && (
          <PanelWrapper title="Reports" interval={60000} refreshTrigger={globalRefresh}>
            <ReportsPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'research' && (
          <PanelWrapper title="Research" interval={60000} refreshTrigger={globalRefresh}>
            <ResearchPanel researchUpdate={researchUpdate} researchComplete={researchComplete} />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'signals' && (
          <PanelWrapper title="Signals" interval={60000} refreshTrigger={globalRefresh}>
            <SignalPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'inputhistory' && (
          <PanelWrapper title="Input History" interval={30000} refreshTrigger={globalRefresh}>
            <InputHistoryPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'dailyreport' && (
          <PanelWrapper title="Daily Reports" interval={60000} refreshTrigger={globalRefresh}>
            <DailyReportPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'sentiment' && (
          <PanelWrapper title="Sentiment" interval={60000} refreshTrigger={globalRefresh}>
            <SentimentPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'divisions' && (
          <PanelWrapper title="Divisions" interval={30000} refreshTrigger={globalRefresh}>
            <DivisionPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'workers' && (
          <PanelWrapper title="Workers" interval={15000} refreshTrigger={globalRefresh}>
            <WorkerJobPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'tokenusage' && (
          <PanelWrapper title="Token Usage" interval={60000} refreshTrigger={globalRefresh}>
            <TokenUsagePanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'logs' && (
          <LogViewer />
        )}

        {layout.mode === 'focus' && view === 'models' && (
          <PanelWrapper title="Models" interval={15000} refreshTrigger={globalRefresh}>
            <ModelManagementPanel />
          </PanelWrapper>
        )}

        {layout.mode === 'focus' && view === 'settings' && (
          <SettingsPanel />
        )}
      </main>

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} />
    </div>
  )
}

function App() {
  const [locale, setLocale] = useState<Locale>(loadLocale)

  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l)
    saveLocale(l)
  }, [])

  const ctxValue = useMemo(() => ({
    locale,
    setLocale: handleSetLocale,
    t: messages[locale],
  }), [locale, handleSetLocale])

  return (
    <LocaleContext.Provider value={ctxValue}>
      <AppInner />
    </LocaleContext.Provider>
  )
}

export default App
