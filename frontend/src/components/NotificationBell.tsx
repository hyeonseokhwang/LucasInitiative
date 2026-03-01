import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'

export interface Notification {
  id: string
  type: 'stock_alert' | 'research_complete' | 'collector' | 'system'
  title: string
  message: string
  symbol?: string
  timestamp: string
  read: boolean
}

interface Props {
  collectorAlert: any
  researchComplete: any
  onNavigate?: (view: string) => void
}

export function NotificationBell({ collectorAlert, researchComplete, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const idCounter = useRef(0)

  const unreadCount = notifications.filter(n => !n.read).length

  // Load initial alerts from backend
  useEffect(() => {
    api.stocks().catch(() => null) // warm up
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      const [alertRes, newsRes] = await Promise.all([
        fetch('/api/reports/collector/alerts?limit=10').then(r => r.json()),
        fetch('/api/reports/collector/news?limit=5').then(r => r.json()),
      ])

      const items: Notification[] = []

      // Stock alerts
      for (const a of (alertRes.alerts || [])) {
        items.push({
          id: `alert-${a.id}`,
          type: 'stock_alert',
          title: a.title || 'Stock Alert',
          message: a.content || '',
          timestamp: a.created_at,
          read: false,
        })
      }

      // News
      for (const n of (newsRes.news || [])) {
        items.push({
          id: `news-${n.id}`,
          type: 'collector',
          title: n.title || 'News',
          message: n.content?.slice(0, 100) || '',
          timestamp: n.created_at,
          read: true, // news starts as read
        })
      }

      // Keep most recent items, mark as read if older than session
      const readIds = new Set(JSON.parse(localStorage.getItem('lucas_read_notifications') || '[]'))
      items.forEach(i => { if (readIds.has(i.id)) i.read = true })

      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id))
        const newItems = items.filter(i => !existingIds.has(i.id))
        return [...newItems, ...prev].slice(0, 50)
      })
    } catch { /* ignore */ }
  }

  // Receive real-time collector alerts via WebSocket
  useEffect(() => {
    if (!collectorAlert) return
    const n: Notification = {
      id: `ws-alert-${Date.now()}-${idCounter.current++}`,
      type: 'stock_alert',
      title: collectorAlert.message || 'Alert',
      message: `${collectorAlert.category} - ${collectorAlert.count || 0} items`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setNotifications(prev => [n, ...prev].slice(0, 50))
  }, [collectorAlert])

  // Receive real-time research completions
  useEffect(() => {
    if (!researchComplete) return
    const n: Notification = {
      id: `ws-research-${Date.now()}-${idCounter.current++}`,
      type: 'research_complete',
      title: researchComplete.title || 'Research Complete',
      message: researchComplete.summary?.slice(0, 120) || '',
      timestamp: new Date().toISOString(),
      read: false,
    }
    setNotifications(prev => [n, ...prev].slice(0, 50))
  }, [researchComplete])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      const readIds = updated.map(n => n.id)
      localStorage.setItem('lucas_read_notifications', JSON.stringify(readIds))
      return updated
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      const readIds = updated.filter(n => n.read).map(n => n.id)
      localStorage.setItem('lucas_read_notifications', JSON.stringify(readIds))
      return updated
    })
  }, [])

  const handleClick = (n: Notification) => {
    markRead(n.id)
    if (n.type === 'stock_alert' && onNavigate) {
      onNavigate('stocks')
    } else if (n.type === 'research_complete' && onNavigate) {
      onNavigate('research')
    }
    setOpen(false)
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'stock_alert': return { bg: 'bg-red-500/20', text: 'text-red-400', icon: '↕' }
      case 'research_complete': return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '🔍' }
      case 'collector': return { bg: 'bg-green-500/20', text: 'text-green-400', icon: '📰' }
      default: return { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: 'ℹ' }
    }
  }

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
        title="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
            <h3 className="text-sm font-medium text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                  Mark all read
                </button>
              )}
              <button onClick={loadAlerts} className="text-xs text-slate-500 hover:text-slate-300">
                Refresh
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-sm">No notifications</div>
            ) : (
              notifications.map(n => {
                const ti = typeIcon(n.type)
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-2.5 border-b border-slate-700/30 cursor-pointer transition hover:bg-slate-700/30 ${
                      !n.read ? 'bg-slate-700/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs ${ti.bg} ${ti.text}`}>
                        {ti.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                        </div>
                        {n.message && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{n.message}</p>
                        )}
                        <span className="text-[10px] text-slate-600 mt-0.5 block">{timeAgo(n.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
