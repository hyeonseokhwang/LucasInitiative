import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { ChatMessage, ModelInfo } from '../types'

interface Props {
  chatTokens: { convId: number; token: string } | null
  chatComplete: any
}

export function ChatPanel({ chatTokens, chatComplete }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('supervisor')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [convId, setConvId] = useState<number | null>(null)
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.models().then(d => {
      const supervisorModel: ModelInfo = {
        name: 'supervisor',
        label: 'Supervisor (PM)',
        category: 'supervisor',
        recommended: true,
        note: 'Claude API - judges & delegates',
        size: 0,
      }
      setModels([supervisorModel, ...(d.models || [])])
    })
  }, [])

  useEffect(() => {
    if (chatTokens) {
      setStreaming(prev => prev + chatTokens.token)
    }
  }, [chatTokens])

  useEffect(() => {
    if (chatComplete) {
      setStreaming('')
      setLoading(false)
      if (convId) {
        api.messages(convId).then(d => setMessages(d.messages || []))
      }
    }
  }, [chatComplete])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setLoading(true)
    setStreaming('')

    // Optimistic add
    setMessages(prev => [...prev, {
      id: Date.now(), conversation_id: convId || 0,
      role: 'user', content: msg, created_at: new Date().toISOString()
    }])

    try {
      const res = await api.chat(msg, model, convId || undefined)
      if (res.conversation_id) setConvId(res.conversation_id)
      if (!res.error && res.conversation_id) {
        const d = await api.messages(res.conversation_id)
        setMessages(d.messages || [])
      }
    } catch {
      setLoading(false)
    }
  }

  const newChat = () => {
    setConvId(null)
    setMessages([])
    setStreaming('')
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-3">
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="bg-slate-700 text-sm text-white rounded-lg px-3 py-1.5 border border-slate-600 outline-none"
        >
          {models.map(m => (
            <option key={m.name} value={m.name}>
              {m.label}{m.recommended ? ' *' : ''}{m.note ? ` (${m.note})` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={newChat}
          className="ml-auto text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition"
        >
          + New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-center text-slate-500 mt-20">
            <p className="text-lg mb-2">Lucas AI Dashboard</p>
            <p className="text-sm">Start a conversation with your local AI</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/70 text-slate-200'
            }`}>
              <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              {m.role === 'assistant' && m.model && (
                <div className="mt-2 text-xs text-slate-400 flex gap-3">
                  <span>{m.model}</span>
                  {m.duration_ms && <span>{(m.duration_ms / 1000).toFixed(1)}s</span>}
                  {m.tokens_used && <span>{m.tokens_used} tok</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-slate-700/70 text-slate-200">
              <div className="whitespace-pre-wrap text-sm">{streaming}<span className="animate-pulse">|</span></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 bg-slate-700 text-white rounded-xl px-4 py-3 outline-none border border-slate-600 focus:border-blue-500 transition disabled:opacity-50 text-sm"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl px-6 py-3 font-medium transition text-sm"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
