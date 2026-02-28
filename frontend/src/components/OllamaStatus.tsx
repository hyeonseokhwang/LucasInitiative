import type { OllamaInfo } from '../types'

interface Props {
  data: OllamaInfo | null
}

export function OllamaStatus({ data }: Props) {
  if (!data) return null

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-3 h-3 rounded-full ${data.running ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-sm font-medium text-white">
          Ollama {data.running ? 'Online' : 'Offline'}
        </span>
        <span className="text-xs text-slate-500 ml-auto">
          {data.models_count} models available
        </span>
      </div>
      {data.loaded_models.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.loaded_models.map(m => (
            <span key={m} className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-300 rounded-md">
              {m}
            </span>
          ))}
        </div>
      )}
      {data.loaded_models.length === 0 && data.running && (
        <p className="text-xs text-slate-500">No models loaded in VRAM. Will load on first chat.</p>
      )}
    </div>
  )
}
