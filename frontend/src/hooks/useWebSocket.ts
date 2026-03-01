import { useState, useEffect, useRef, useCallback } from 'react'
import type { SystemSnapshot, WsMessage } from '../types'

export function useWebSocket() {
  const [metrics, setMetrics] = useState<SystemSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [chatTokens, setChatTokens] = useState<{ convId: number; token: string } | null>(null)
  const [chatComplete, setChatComplete] = useState<any>(null)
  const [taskUpdate, setTaskUpdate] = useState<any>(null)
  const [agentUpdate, setAgentUpdate] = useState<any>(null)
  const [researchUpdate, setResearchUpdate] = useState<any>(null)
  const [researchComplete, setResearchComplete] = useState<any>(null)
  const [collectorAlert, setCollectorAlert] = useState<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      setConnected(true)
      retryRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        switch (msg.type) {
          case 'metrics':
            setMetrics(msg.data)
            break
          case 'chat_token':
            setChatTokens({ convId: msg.data.conversation_id, token: msg.data.token })
            break
          case 'chat_complete':
            setChatComplete(msg.data)
            break
          case 'task_update':
            setTaskUpdate(msg.data)
            break
          case 'agent_update':
            setAgentUpdate(msg.data)
            break
          case 'collector_alert':
            setCollectorAlert(msg.data)
            break
          case 'research_update':
            setResearchUpdate(msg.data)
            break
          case 'research_complete':
            setResearchComplete(msg.data)
            break
        }
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000)
      retryRef.current++
      setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  return { metrics, connected, chatTokens, chatComplete, taskUpdate, agentUpdate, collectorAlert, researchUpdate, researchComplete }
}
