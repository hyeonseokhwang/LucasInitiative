import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

export interface PaletteCommand {
  id: string
  label: string
  category: string
  shortcut?: string
  action: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  commands: PaletteCommand[]
  searchProvider?: (query: string) => Promise<PaletteCommand[]>
}

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  // Exact substring match = highest score
  if (t.includes(q)) return { match: true, score: 100 - t.indexOf(q) }

  // Fuzzy: every query char must appear in order
  let qi = 0
  let score = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === 0 || t[ti - 1] === ' ') ? 10 : 1 // word boundary bonus
      qi++
    }
  }

  if (qi === q.length) return { match: true, score }
  return { match: false, score: 0 }
}

const CATEGORY_COLORS: Record<string, string> = {
  'Navigate': 'text-blue-400',
  'Action': 'text-emerald-400',
  'Search': 'text-amber-400',
  'Report': 'text-cyan-400',
  'Research': 'text-purple-400',
  'Daily': 'text-orange-400',
  'Stock': 'text-red-400',
}

export function CommandPalette({ open, onClose, commands, searchProvider }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<PaletteCommand[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setSearchResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search provider call (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || !searchProvider) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      searchProvider(query)
        .then(results => { setSearchResults(results); setSearching(false) })
        .catch(() => { setSearchResults([]); setSearching(false) })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, searchProvider])

  // Filter and sort commands + merge search results
  const filtered = useMemo(() => {
    const cmdResults = !query.trim() ? commands : commands
      .map(cmd => ({ cmd, ...fuzzyMatch(query, `${cmd.label} ${cmd.category}`) }))
      .filter(r => r.match)
      .sort((a, b) => b.score - a.score)
      .map(r => r.cmd)
    return [...cmdResults, ...searchResults]
  }, [query, commands, searchResults])

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex(prev => Math.min(prev, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selectedIndex] as HTMLElement
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const executeSelected = useCallback(() => {
    const cmd = filtered[selectedIndex]
    if (cmd) {
      onClose()
      cmd.action()
    }
  }, [filtered, selectedIndex, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        executeSelected()
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filtered.length, executeSelected, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-500"
          />
          <kbd className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              {searching ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </span>
              ) : 'No matching commands or results'}
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { onClose(); cmd.action() }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? 'bg-blue-600/30 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span className={`text-[10px] font-medium uppercase tracking-wider w-16 shrink-0 ${
                  CATEGORY_COLORS[cmd.category] || 'text-slate-500'
                }`}>
                  {cmd.category}
                </span>
                <span className="flex-1 text-sm truncate">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded shrink-0">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-700 text-[10px] text-slate-500">
          <span><kbd className="bg-slate-700 px-1 py-0.5 rounded mr-1">&uarr;&darr;</kbd> Navigate</span>
          <span><kbd className="bg-slate-700 px-1 py-0.5 rounded mr-1">Enter</kbd> Select</span>
          <span><kbd className="bg-slate-700 px-1 py-0.5 rounded mr-1">Esc</kbd> Close</span>
          {searching && (
            <span className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 border border-slate-500 border-t-transparent rounded-full animate-spin" />
              Searching...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
