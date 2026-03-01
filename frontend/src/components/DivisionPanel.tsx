import { useState, useEffect } from 'react'
import { useLocale } from '../hooks/useLocale'
import divisionsData from '../data/divisions.json'

type ViewMode = 'cards' | 'orgchart'
type ProductStatus = 'running' | 'developing' | 'planning'
type Phase = 'production' | 'development' | 'testing' | 'planning'

interface Product {
  id: string
  name: string
  nameKo: string
  desc: string
  descKo: string
  port: number | null
  url: string | null
  healthUrl: string | null
  status: ProductStatus
  stack: string[]
  phase: Phase
  revenueModel: string | null
}

interface Division {
  id: string
  name: string
  nameKo: string
  color: string
  icon: string
  workers: string[]
  products: Product[]
}

const PHASE_STEPS: Phase[] = ['planning', 'development', 'testing', 'production']

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; labelKo: string }> = {
  running:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Running',    labelKo: '가동중' },
  developing: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: 'Developing', labelKo: '개발중' },
  planning:   { bg: 'bg-slate-500/15',   text: 'text-slate-400',   label: 'Planning',   labelKo: '기획중' },
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  blue:    { border: 'border-blue-500/30',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    glow: 'shadow-blue-500/10' },
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  amber:   { border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   glow: 'shadow-amber-500/10' },
  cyan:    { border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/10' },
}

const ICON_MAP: Record<string, string> = {
  flask: 'M9 3v2m6-2v2M9 5a2 2 0 0 0-2 2v1a2 2 0 0 0 .586 1.414l.914.914A2 2 0 0 1 9 11.74V19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7.26a2 2 0 0 1 .586-1.414l.914-.914A2 2 0 0 0 17 8V7a2 2 0 0 0-2-2H9z',
  rocket: 'M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.63 8.37m6 6a14.98 14.98 0 0 1-6-6m0 0L3 15l5.5 1.5L10 22l3.63-7.63z',
  chart: 'M3 3v18h18M7 16l4-8 4 4 4-6',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
}

function DivisionIcon({ icon, className }: { icon: string; className?: string }) {
  const path = ICON_MAP[icon] || ICON_MAP.cog
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

function PhaseBar({ phase }: { phase: Phase }) {
  const idx = PHASE_STEPS.indexOf(phase)
  return (
    <div className="flex gap-0.5">
      {PHASE_STEPS.map((step, i) => (
        <div key={step} className="flex-1 flex flex-col items-center gap-0.5">
          <div className={`h-1 w-full rounded-full ${
            i <= idx ? 'bg-emerald-500' : 'bg-slate-700'
          }`} />
          <span className={`text-[8px] ${i <= idx ? 'text-slate-300' : 'text-slate-600'}`}>
            {step.slice(0, 4)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DivisionPanel() {
  const { locale, t } = useLocale()
  const d = t.div
  const isKo = locale === 'ko'

  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [healthMap, setHealthMap] = useState<Record<string, boolean>>({})
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  const divisions = divisionsData.divisions as Division[]
  const ceo = divisionsData.ceo
  const commander = divisionsData.commander

  // Health checks
  useEffect(() => {
    const allProducts = divisions.flatMap(div => div.products)
    allProducts.forEach(p => {
      if (p.healthUrl) {
        fetch(p.healthUrl, { signal: AbortSignal.timeout(3000) })
          .then(r => setHealthMap(prev => ({ ...prev, [p.id]: r.ok })))
          .catch(() => setHealthMap(prev => ({ ...prev, [p.id]: false })))
      }
    })
  }, [])

  // Stats
  const allProducts = divisions.flatMap(div => div.products)
  const totalProducts = allProducts.length
  const runningProducts = allProducts.filter(p => p.status === 'running').length
  const uptimeRate = totalProducts > 0 ? Math.round((runningProducts / totalProducts) * 100) : 0
  const allWorkers = [...new Set(divisions.flatMap(div => div.workers))]

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{d.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {divisions.length} {d.divisions} &middot; {totalProducts} {d.products} &middot; {allWorkers.length} {d.workers}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Summary stats */}
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-400">{runningProducts} {d.running}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">{d.uptime}:</span>
                <span className={`font-mono font-bold ${uptimeRate >= 80 ? 'text-emerald-400' : uptimeRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {uptimeRate}%
                </span>
              </div>
            </div>
            {/* View toggle */}
            <div className="flex rounded-lg border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'cards' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d.cardView}
              </button>
              <button
                onClick={() => setViewMode('orgchart')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'orgchart' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d.orgChart}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'cards' ? (
          <div className="space-y-6">
            {divisions.map(div => {
              const colors = COLOR_MAP[div.color] || COLOR_MAP.blue
              const divRunning = div.products.filter(p => p.status === 'running').length
              return (
                <div key={div.id} className={`rounded-xl border ${colors.border} bg-slate-800/30 overflow-hidden`}>
                  {/* Division Header */}
                  <div className={`px-4 py-3 ${colors.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text}`}>
                        <DivisionIcon icon={div.icon} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {isKo ? div.nameKo : div.name}
                          <span className="ml-2 text-xs font-normal text-slate-400">({isKo ? div.name : div.nameKo})</span>
                        </h3>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                          <span>{div.products.length} {d.products}</span>
                          <span>{div.workers.length} {d.workers}</span>
                          <span>{divRunning}/{div.products.length} {d.running}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {div.products.map(product => {
                      const st = STATUS_STYLES[product.status] || STATUS_STYLES.planning
                      const isHealthy = healthMap[product.id] === true
                      const healthPending = product.healthUrl && healthMap[product.id] === undefined
                      const isExpanded = expandedProduct === product.id

                      return (
                        <div
                          key={product.id}
                          className={`rounded-lg border border-slate-700/50 bg-slate-800/50 overflow-hidden transition-all ${
                            isExpanded ? 'ring-1 ring-blue-500/30' : 'hover:border-slate-600/50'
                          }`}
                        >
                          {/* Product Card Top */}
                          <button
                            className="w-full text-left p-3"
                            onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white truncate">
                                    {isKo ? product.nameKo : product.name}
                                  </span>
                                  {/* Health dot */}
                                  {product.healthUrl && (
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                                      healthPending ? 'bg-slate-500 animate-pulse' :
                                      isHealthy ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' :
                                      'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                                    }`} />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                  {isKo ? product.descKo : product.desc}
                                </p>
                              </div>
                              <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${st.bg} ${st.text}`}>
                                {isKo ? st.labelKo : st.label}
                              </span>
                            </div>

                            {/* Port + Link */}
                            <div className="flex items-center gap-2 text-[10px]">
                              {product.port && (
                                <span className="text-slate-500 font-mono">:{product.port}</span>
                              )}
                              {product.url && (
                                <a
                                  href={product.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {d.openLink}
                                </a>
                              )}
                            </div>
                          </button>

                          {/* Expanded Detail */}
                          {isExpanded && (
                            <div className="border-t border-slate-700/40 p-3 space-y-3 bg-slate-900/20">
                              {/* Tech Stack */}
                              <div>
                                <div className="text-[10px] text-slate-500 mb-1">{d.techStack}</div>
                                <div className="flex flex-wrap gap-1">
                                  {product.stack.map(tech => (
                                    <span key={tech} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-700/50 text-slate-300 border border-slate-600/30">
                                      {tech}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Revenue Model */}
                              {product.revenueModel && (
                                <div>
                                  <div className="text-[10px] text-slate-500 mb-1">{d.revenueModel}</div>
                                  <span className="text-xs text-emerald-400">{product.revenueModel}</span>
                                </div>
                              )}

                              {/* Development Phase */}
                              <div>
                                <div className="text-[10px] text-slate-500 mb-1">{d.devPhase}</div>
                                <PhaseBar phase={product.phase} />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Org Chart View */
          <div className="flex flex-col items-center py-6">
            {/* CEO */}
            <div className="flex flex-col items-center mb-2">
              <div className="px-6 py-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-center">
                <div className="text-sm font-bold text-white">{isKo ? ceo.nameKo : ceo.name}</div>
                <div className="text-[10px] text-amber-400">{isKo ? ceo.roleKo : ceo.role}</div>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-600" />

            {/* Commander */}
            <div className="flex flex-col items-center mb-2">
              <div className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 text-center">
                <div className="text-sm font-bold text-white">{isKo ? commander.nameKo : commander.name}</div>
                <div className="text-[10px] text-blue-400">{isKo ? commander.roleKo : commander.role}</div>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-600" />

            {/* Horizontal connector */}
            <div className="flex items-start w-full max-w-4xl">
              <div className="flex-1 border-t border-slate-600" />
            </div>

            {/* Divisions row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl mt-2">
              {divisions.map(div => {
                const colors = COLOR_MAP[div.color] || COLOR_MAP.blue
                return (
                  <div key={div.id} className="flex flex-col items-center">
                    {/* Division node */}
                    <div className={`w-full px-4 py-2.5 rounded-xl ${colors.bg} border ${colors.border} text-center mb-3`}>
                      <div className={`text-xs font-bold ${colors.text}`}>
                        {isKo ? div.nameKo : div.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{div.workers.length} {d.workers}</div>
                    </div>

                    {/* Products under division */}
                    <div className="space-y-1.5 w-full">
                      {div.products.map(product => {
                        const st = STATUS_STYLES[product.status] || STATUS_STYLES.planning
                        const isHealthy = healthMap[product.id] === true
                        return (
                          <div key={product.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                            {product.healthUrl ? (
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isHealthy ? 'bg-emerald-400' : healthMap[product.id] === false ? 'bg-red-400' : 'bg-slate-500 animate-pulse'
                              }`} />
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.bg}`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-slate-200 truncate">
                                {isKo ? product.nameKo : product.name}
                              </div>
                              {product.port && (
                                <div className="text-[9px] text-slate-600 font-mono">:{product.port}</div>
                              )}
                            </div>
                            <span className={`text-[9px] ${st.text}`}>
                              {isKo ? st.labelKo : st.label}
                            </span>
                          </div>
                        )
                      })}

                      {/* Workers */}
                      <div className="flex flex-wrap gap-1 mt-2 px-2">
                        {div.workers.map(w => (
                          <span key={w} className="px-1.5 py-0.5 text-[9px] rounded bg-slate-700/40 text-slate-500 border border-slate-700/30">
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
