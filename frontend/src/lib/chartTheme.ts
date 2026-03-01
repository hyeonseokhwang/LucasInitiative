// ====================================================================
// Shared color palette & chart theme — Single source of truth
// Matches CSS custom properties defined in index.css
// ====================================================================

// ---- Core Palette (accent colors) ----
export const ACCENT = {
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#eab308',
  amber: '#f59e0b',
  orange: '#f97316',
  purple: '#a855f7',
  violet: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  indigo: '#6366f1',
  gray: '#6b7280',
  greenAlt: '#22c55e',   // green-500 (lighter green)
} as const

// ---- Neutral / Surface ----
export const SURFACE = {
  bgPrimary: '#0f172a',  // slate-950
  bgCard: '#1e293b',     // slate-800
  bgHover: '#334155',    // slate-700
  textPrimary: '#e2e8f0',  // slate-200
  textSecondary: '#94a3b8', // slate-400
  textMuted: '#64748b',     // slate-500
} as const

// ---- Chart Infrastructure ----
export const CHART_GRID_COLOR = 'rgba(51, 65, 85, 0.5)' // slate-700/50
export const CHART_AXIS_COLOR = SURFACE.textMuted         // slate-500
export const CHART_TOOLTIP_BG = SURFACE.bgCard             // slate-800
export const CHART_TOOLTIP_BORDER = SURFACE.bgHover        // slate-700

// ---- Semantic Chart Colors ----
export const CHART_COLORS = {
  cpu: ACCENT.blue,
  ram: ACCENT.purple,
  gpu: ACCENT.green,
  vram: ACCENT.orange,
  temp: ACCENT.red,
  power: ACCENT.yellow,
  income: ACCENT.green,
  expense: ACCENT.red,
  balance: ACCENT.blue,
  confidence: ACCENT.green,
  apiCost: ACCENT.amber,
  tokens: ACCENT.violet,
} as const

// ---- Expense Category Colors ----
export const EXPENSE_COLORS: Record<string, string> = {
  food: ACCENT.orange,
  transport: ACCENT.blue,
  shopping: ACCENT.pink,
  bills: ACCENT.violet,
  entertainment: ACCENT.green,
  income: ACCENT.greenAlt,
  etc: ACCENT.gray,
}

// ---- Confidence Bucket Colors ----
export const CONFIDENCE_COLORS = [
  ACCENT.red,       // 0-20%
  ACCENT.orange,    // 20-40%
  ACCENT.yellow,    // 40-60%
  ACCENT.greenAlt,  // 60-80%
  ACCENT.green,     // 80-100%
] as const

// ---- Multi-series palette (for dynamic chart series) ----
export const SERIES_PALETTE = [
  ACCENT.blue, ACCENT.red, ACCENT.green, ACCENT.amber,
  ACCENT.violet, ACCENT.pink, ACCENT.cyan, ACCENT.orange,
  ACCENT.indigo, ACCENT.teal,
] as const

// ---- Stock Candle Colors (TradingView / Material style) ----
export const CANDLE = {
  up: '#26a69a',
  down: '#ef5350',
  upAlpha: 'rgba(38,166,154,0.5)',
  downAlpha: 'rgba(239,83,80,0.5)',
  upHistAlpha: 'rgba(38,166,154,0.7)',
  downHistAlpha: 'rgba(239,83,80,0.7)',
} as const

// ---- lightweight-charts shared layout ----
export const lwcLayout = {
  background: { color: SURFACE.bgCard },
  textColor: SURFACE.textSecondary,
}

export const lwcGrid = {
  vertLines: { color: SURFACE.bgHover },
  horzLines: { color: SURFACE.bgHover },
}

export const lwcScaleBorder = CHART_TOOLTIP_BORDER // #475569

// ---- Recharts shared props ----
export const commonAxisProps = {
  stroke: CHART_AXIS_COLOR,
  fontSize: 11,
  tickLine: false,
}

export const commonGridProps = {
  strokeDasharray: '3 3',
  stroke: CHART_GRID_COLOR,
}

export const commonTooltipProps = {
  contentStyle: {
    backgroundColor: CHART_TOOLTIP_BG,
    border: `1px solid ${CHART_TOOLTIP_BORDER}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: SURFACE.textPrimary,
  },
}

export const legendStyle = { fontSize: '11px', color: SURFACE.textSecondary }
