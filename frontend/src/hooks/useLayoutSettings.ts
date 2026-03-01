import { useState, useCallback, useEffect } from 'react'

export type LayoutMode = 'focus' | 'grid'
export type LayoutPreset = '2x1' | '2x2' | '3x2'

export type GridPanel = 'stocks' | 'portfolio' | 'sectors' | 'realestate' | 'watchlist' | 'reports' | 'research' | 'schedule' | 'expense' | 'system'

const STORAGE_KEY = 'lucas-layout-settings'

interface LayoutSettings {
  mode: LayoutMode
  preset: LayoutPreset
  selectedPanels: GridPanel[]
}

const DEFAULT_SETTINGS: LayoutSettings = {
  mode: 'focus',
  preset: '2x2',
  selectedPanels: ['stocks', 'portfolio', 'system', 'research'],
}

function loadSettings(): LayoutSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings: LayoutSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

export const GRID_PANEL_LABELS: Record<GridPanel, string> = {
  stocks: 'Stocks',
  portfolio: 'Portfolio',
  sectors: 'Sectors',
  realestate: 'Real Estate',
  watchlist: 'Watchlist',
  reports: 'Reports',
  research: 'Research',
  schedule: 'Schedule',
  expense: 'Expenses',
  system: 'System',
}

export const PRESET_LABELS: Record<LayoutPreset, string> = {
  '2x1': '2 Panels',
  '2x2': '4 Panels',
  '3x2': '6 Panels',
}

export const PRESET_COLS: Record<LayoutPreset, number> = {
  '2x1': 2,
  '2x2': 2,
  '3x2': 3,
}

export const PRESET_MAX: Record<LayoutPreset, number> = {
  '2x1': 2,
  '2x2': 4,
  '3x2': 6,
}

export function useLayoutSettings() {
  const [settings, setSettings] = useState<LayoutSettings>(loadSettings)

  useEffect(() => { saveSettings(settings) }, [settings])

  const setMode = useCallback((mode: LayoutMode) => {
    setSettings(s => ({ ...s, mode }))
  }, [])

  const setPreset = useCallback((preset: LayoutPreset) => {
    setSettings(s => ({ ...s, preset }))
  }, [])

  const togglePanel = useCallback((panel: GridPanel) => {
    setSettings(s => {
      const has = s.selectedPanels.includes(panel)
      const max = PRESET_MAX[s.preset]
      if (has) {
        return { ...s, selectedPanels: s.selectedPanels.filter(p => p !== panel) }
      }
      if (s.selectedPanels.length >= max) return s
      return { ...s, selectedPanels: [...s.selectedPanels, panel] }
    })
  }, [])

  return {
    mode: settings.mode,
    preset: settings.preset,
    selectedPanels: settings.selectedPanels,
    setMode,
    setPreset,
    togglePanel,
  }
}
