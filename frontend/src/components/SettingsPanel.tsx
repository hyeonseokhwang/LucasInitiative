import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useLocale } from '../hooks/useLocale'

// ---- localStorage helpers ----
const SETTINGS_KEY = 'lucas-dashboard-settings'

interface DashboardSettings {
  // Appearance
  theme: 'dark' | 'light'
  autoRefreshInterval: number // seconds: 15, 30, 60, 0 (disabled)
  // Ollama
  defaultModel: string
  // API Keys (stored masked, actual key in separate key)
  anthropicKeyMasked: string
  naverClientIdMasked: string
  // Data collection intervals (minutes)
  stockPollInterval: number
  realestatePollInterval: number
  researchCycleInterval: number
  // System thresholds (percent)
  cpuAlertThreshold: number
  ramAlertThreshold: number
  gpuAlertThreshold: number
  gpuMemAlertThreshold: number
}

const DEFAULT_SETTINGS: DashboardSettings = {
  theme: 'dark',
  autoRefreshInterval: 30,
  defaultModel: 'qwen2.5:14b',
  anthropicKeyMasked: '',
  naverClientIdMasked: '',
  stockPollInterval: 30,
  realestatePollInterval: 60,
  researchCycleInterval: 120,
  cpuAlertThreshold: 90,
  ramAlertThreshold: 85,
  gpuAlertThreshold: 95,
  gpuMemAlertThreshold: 90,
}

function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: DashboardSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ---- Section wrapper ----
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="text-blue-400">{icon}</div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

// ---- Field components ----
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="shrink-0 min-w-[140px]">
        <label className="text-xs font-medium text-slate-300">{label}</label>
        {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-1 max-w-xs">
        {children}
      </div>
    </div>
  )
}

function SliderField({ value, min, max, step, unit, onChange }: {
  value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
      <span className="text-xs font-mono text-slate-300 w-16 text-right tabular-nums">
        {value}{unit}
      </span>
    </div>
  )
}

// ---- Main Component ----
export function SettingsPanel() {
  const { locale, setLocale, t } = useLocale()
  const s = t.settings
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings)
  const [models, setModels] = useState<{ name: string; size?: number }[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [apiKeyEdit, setApiKeyEdit] = useState<{ field: 'anthropic' | 'naver'; value: string } | null>(null)

  // Fetch available Ollama models
  const fetchModels = useCallback(async () => {
    try {
      const data = await api.models()
      setModels(data.models || [])
    } catch { /* ignore */ }
    setModelsLoading(false)
  }, [])

  useEffect(() => { fetchModels() }, [fetchModels])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light')
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  const update = (patch: Partial<DashboardSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleApiKeySave = (field: 'anthropic' | 'naver', rawKey: string) => {
    if (!rawKey.trim()) return
    // Mask and store
    const masked = rawKey.length > 8
      ? rawKey.slice(0, 4) + '*'.repeat(rawKey.length - 8) + rawKey.slice(-4)
      : '*'.repeat(rawKey.length)
    // Store actual key separately (not in settings object to avoid JSON exposure)
    localStorage.setItem(`lucas-apikey-${field}`, rawKey)
    if (field === 'anthropic') {
      update({ anthropicKeyMasked: masked })
    } else {
      update({ naverClientIdMasked: masked })
    }
    setApiKeyEdit(null)
  }

  return (
    <div className="h-[calc(100vh-120px)] overflow-auto">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{s.title}</h2>
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 animate-pulse">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              {t.saved}
            </span>
          )}
        </div>

        {/* 0. Language */}
        <Section
          title={s.language}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
        >
          <FieldRow label={s.language} hint={s.languageHint}>
            <div className="flex gap-2">
              <button
                onClick={() => setLocale('ko')}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  locale === 'ko'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent'
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => setLocale('en')}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  locale === 'en'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent'
                }`}
              >
                English
              </button>
            </div>
          </FieldRow>
        </Section>

        {/* 0b. Theme */}
        <Section
          title={s.theme}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        >
          <FieldRow label={s.theme} hint={s.themeHint}>
            <div className="flex gap-2">
              <button
                onClick={() => update({ theme: 'dark' })}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  settings.theme === 'dark'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent'
                }`}
              >
                {s.themeDark}
              </button>
              <button
                onClick={() => update({ theme: 'light' })}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  settings.theme === 'light'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent'
                }`}
              >
                {s.themeLight}
              </button>
            </div>
          </FieldRow>
        </Section>

        {/* 0c. Auto Refresh Interval */}
        <Section
          title={s.autoRefresh}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><path d="M21 3v9h-9"/></svg>}
        >
          <FieldRow label={s.autoRefresh} hint={s.autoRefreshHint}>
            <div className="flex gap-2">
              {[
                { value: 15, label: '15s' },
                { value: 30, label: '30s' },
                { value: 60, label: '60s' },
                { value: 0, label: s.refreshDisabled },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update({ autoRefreshInterval: opt.value })}
                  className={`flex-1 px-2 py-2 text-xs rounded-md transition-colors ${
                    settings.autoRefreshInterval === opt.value
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FieldRow>
        </Section>

        {/* 1. Ollama Model Settings */}
        <Section
          title={s.ollamaModel}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        >
          <FieldRow label={s.defaultModel} hint={s.defaultModelHint}>
            {modelsLoading ? (
              <div className="text-xs text-slate-500 animate-pulse">{s.loadingModels}</div>
            ) : (
              <select
                value={settings.defaultModel}
                onChange={e => update({ defaultModel: e.target.value })}
                className="w-full text-sm bg-slate-900 text-slate-200 rounded-md px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name} {m.size ? `(${(m.size / 1e9).toFixed(1)}GB)` : ''}
                  </option>
                ))}
              </select>
            )}
          </FieldRow>

          {/* Available models list */}
          {!modelsLoading && models.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{s.availableModels} ({models.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {models.map(m => (
                  <button
                    key={m.name}
                    onClick={() => update({ defaultModel: m.name })}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      settings.defaultModel === m.name
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-transparent'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* 2. API Key Management */}
        <Section
          title={s.apiKeys}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>}
        >
          {/* Anthropic API Key */}
          <FieldRow label={s.anthropicKey} hint={s.anthropicHint}>
            {apiKeyEdit?.field === 'anthropic' ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  autoFocus
                  value={apiKeyEdit.value}
                  onChange={e => setApiKeyEdit({ field: 'anthropic', value: e.target.value })}
                  placeholder="sk-ant-..."
                  className="flex-1 text-sm bg-slate-900 text-slate-200 rounded-md px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  onClick={() => handleApiKeySave('anthropic', apiKeyEdit.value)}
                  className="px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors"
                >
                  {t.save}
                </button>
                <button
                  onClick={() => setApiKeyEdit(null)}
                  className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 text-sm font-mono text-slate-400 bg-slate-900/50 rounded-md px-3 py-2 border border-slate-700/50 truncate">
                  {settings.anthropicKeyMasked || <span className="text-slate-600 italic">{s.notSet}</span>}
                </div>
                <button
                  onClick={() => setApiKeyEdit({ field: 'anthropic', value: '' })}
                  className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors shrink-0"
                >
                  {t.edit}
                </button>
              </div>
            )}
          </FieldRow>

          {/* Naver API Key */}
          <FieldRow label={s.naverClientId} hint={s.naverHint}>
            {apiKeyEdit?.field === 'naver' ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  autoFocus
                  value={apiKeyEdit.value}
                  onChange={e => setApiKeyEdit({ field: 'naver', value: e.target.value })}
                  placeholder="Client ID..."
                  className="flex-1 text-sm bg-slate-900 text-slate-200 rounded-md px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  onClick={() => handleApiKeySave('naver', apiKeyEdit.value)}
                  className="px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-md text-white transition-colors"
                >
                  {t.save}
                </button>
                <button
                  onClick={() => setApiKeyEdit(null)}
                  className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 text-sm font-mono text-slate-400 bg-slate-900/50 rounded-md px-3 py-2 border border-slate-700/50 truncate">
                  {settings.naverClientIdMasked || <span className="text-slate-600 italic">{s.notSet}</span>}
                </div>
                <button
                  onClick={() => setApiKeyEdit({ field: 'naver', value: '' })}
                  className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors shrink-0"
                >
                  {t.edit}
                </button>
              </div>
            )}
          </FieldRow>

          <div className="text-[10px] text-amber-400/70 flex items-center gap-1.5 pt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {s.keysWarning}
          </div>
        </Section>

        {/* 3. Data Collection Intervals */}
        <Section
          title={s.dataCollection}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        >
          <FieldRow label={s.stockPolling} hint={s.stockPollingHint}>
            <SliderField
              value={settings.stockPollInterval}
              min={5} max={120} step={5} unit="min"
              onChange={v => update({ stockPollInterval: v })}
            />
          </FieldRow>

          <FieldRow label={s.realEstatePolling} hint={s.realEstatePollingHint}>
            <SliderField
              value={settings.realestatePollInterval}
              min={15} max={360} step={15} unit="min"
              onChange={v => update({ realestatePollInterval: v })}
            />
          </FieldRow>

          <FieldRow label={s.researchCycle} hint={s.researchCycleHint}>
            <SliderField
              value={settings.researchCycleInterval}
              min={30} max={720} step={30} unit="min"
              onChange={v => update({ researchCycleInterval: v })}
            />
          </FieldRow>
        </Section>

        {/* 4. System Resource Thresholds */}
        <Section
          title={s.alertThresholds}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        >
          <FieldRow label={s.cpuUsage} hint={s.alertHint}>
            <SliderField
              value={settings.cpuAlertThreshold}
              min={50} max={100} step={5} unit="%"
              onChange={v => update({ cpuAlertThreshold: v })}
            />
          </FieldRow>

          <FieldRow label={s.ramUsage} hint={s.alertHint}>
            <SliderField
              value={settings.ramAlertThreshold}
              min={50} max={100} step={5} unit="%"
              onChange={v => update({ ramAlertThreshold: v })}
            />
          </FieldRow>

          <FieldRow label={s.gpuUtil} hint={s.alertHint}>
            <SliderField
              value={settings.gpuAlertThreshold}
              min={50} max={100} step={5} unit="%"
              onChange={v => update({ gpuAlertThreshold: v })}
            />
          </FieldRow>

          <FieldRow label={s.gpuMemory} hint={s.vramAlertHint}>
            <SliderField
              value={settings.gpuMemAlertThreshold}
              min={50} max={100} step={5} unit="%"
              onChange={v => update({ gpuMemAlertThreshold: v })}
            />
          </FieldRow>
        </Section>

        {/* Reset */}
        <div className="flex justify-end pb-4">
          <button
            onClick={() => {
              setSettings({ ...DEFAULT_SETTINGS })
              saveSettings(DEFAULT_SETTINGS)
              setSaved(true)
              setTimeout(() => setSaved(false), 2000)
            }}
            className="px-4 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            {s.resetDefaults}
          </button>
        </div>
      </div>
    </div>
  )
}
