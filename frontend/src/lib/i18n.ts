// ====================================================================
// Internationalization — ko/en locale system
// ====================================================================

export type Locale = 'ko' | 'en'

// ---- Text dictionary ----
export interface Messages {
  // Common
  appTitle: string
  live: string
  disconnected: string
  loading: string
  save: string
  cancel: string
  edit: string
  reset: string
  saved: string

  // Header
  apiLabel: string
  calls: string
  tok: string

  // Nav tabs
  nav: {
    home: string
    company: string
    dashboard: string
    chat: string
    schedule: string
    expense: string
    stocks: string
    portfolio: string
    sectors: string
    realestate: string
    watchlist: string
    reports: string
    research: string
    models: string
    logs: string
    settings: string
  }

  // Home tab
  home: {
    systemStatus: string
    dashboard: string
    gpuTemp: string
    stocksPortfolio: string
    realEstate: string
    research: string
    apiUsageCost: string
    loadingIndices: string
    noPortfolioData: string
    watchlist: string
    recentDeals: string
    noWatchlistItems: string
    noRecentDeals: string
    noResearchReports: string
    confidence: string
    evidence: string
    apiCalls: string
    tokens: string
    cost: string
    budget: string
    remaining: string
    noUsageData: string
    view: string
  }

  // Settings tab
  settings: {
    title: string
    language: string
    languageHint: string
    ollamaModel: string
    defaultModel: string
    defaultModelHint: string
    availableModels: string
    loadingModels: string
    apiKeys: string
    anthropicKey: string
    anthropicHint: string
    naverClientId: string
    naverHint: string
    keysWarning: string
    notSet: string
    dataCollection: string
    stockPolling: string
    stockPollingHint: string
    realEstatePolling: string
    realEstatePollingHint: string
    researchCycle: string
    researchCycleHint: string
    alertThresholds: string
    cpuUsage: string
    ramUsage: string
    gpuUtil: string
    gpuMemory: string
    alertHint: string
    vramAlertHint: string
    resetDefaults: string
  }
}

const ko: Messages = {
  appTitle: 'LUCAS AI',
  live: '연결됨',
  disconnected: '연결 끊김',
  loading: '로딩 중...',
  save: '저장',
  cancel: '취소',
  edit: '수정',
  reset: '초기화',
  saved: '저장됨',

  apiLabel: 'API',
  calls: '호출',
  tok: '토큰',

  nav: {
    home: '홈',
    company: '회사',
    dashboard: '대시보드',
    chat: '채팅',
    schedule: '일정',
    expense: '가계부',
    stocks: '주식',
    portfolio: '포트폴리오',
    sectors: '섹터',
    realestate: '부동산',
    watchlist: '관심목록',
    reports: '리포트',
    research: '리서치',
    models: '모델',
    logs: '로그',
    settings: '설정',
  },

  home: {
    systemStatus: '시스템 상태',
    dashboard: '대시보드',
    gpuTemp: 'GPU 온도',
    stocksPortfolio: '주식 & 포트폴리오',
    realEstate: '부동산',
    research: '리서치',
    apiUsageCost: 'API 사용량 & 비용',
    loadingIndices: '지수 로딩 중...',
    noPortfolioData: '포트폴리오 데이터 없음',
    watchlist: '관심목록',
    recentDeals: '최근 거래',
    noWatchlistItems: '관심 항목 없음',
    noRecentDeals: '최근 거래 없음',
    noResearchReports: '리서치 보고서 없음',
    confidence: '신뢰도',
    evidence: '증거',
    apiCalls: 'API 호출',
    tokens: '토큰',
    cost: '비용',
    budget: '예산',
    remaining: '잔여',
    noUsageData: '사용 데이터 없음',
    view: '보기',
  },

  settings: {
    title: '설정',
    language: '언어',
    languageHint: '인터페이스 언어',
    ollamaModel: 'Ollama 모델',
    defaultModel: '기본 모델',
    defaultModelHint: '채팅/슈퍼바이저 기본값',
    availableModels: '사용 가능한 모델',
    loadingModels: '모델 로딩 중...',
    apiKeys: 'API 키',
    anthropicKey: 'Anthropic API 키',
    anthropicHint: 'Claude 슈퍼바이저 모드',
    naverClientId: 'Naver Client ID',
    naverHint: '주식/부동산 데이터',
    keysWarning: '키는 브라우저 localStorage에 저장됩니다. 프로덕션에서는 환경 변수를 사용하세요.',
    notSet: '미설정',
    dataCollection: '데이터 수집',
    stockPolling: '주식 폴링',
    stockPollingHint: '시장 데이터 새로고침',
    realEstatePolling: '부동산 폴링',
    realEstatePollingHint: '부동산 데이터 새로고침',
    researchCycle: '리서치 주기',
    researchCycleHint: '자동 리서치 간격',
    alertThresholds: '알림 임계값',
    cpuUsage: 'CPU 사용량',
    ramUsage: 'RAM 사용량',
    gpuUtil: 'GPU 사용률',
    gpuMemory: 'GPU 메모리',
    alertHint: '초과 시 알림',
    vramAlertHint: 'VRAM 사용량 알림',
    resetDefaults: '기본값으로 초기화',
  },
}

const en: Messages = {
  appTitle: 'LUCAS AI',
  live: 'Live',
  disconnected: 'Disconnected',
  loading: 'Loading...',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  reset: 'Reset',
  saved: 'Saved',

  apiLabel: 'API',
  calls: 'calls',
  tok: 'tok',

  nav: {
    home: 'Home',
    company: 'Company',
    dashboard: 'Dashboard',
    chat: 'Chat',
    schedule: 'Schedule',
    expense: 'Expense',
    stocks: 'Stocks',
    portfolio: 'Portfolio',
    sectors: 'Sectors',
    realestate: 'Real Estate',
    watchlist: 'Watchlist',
    reports: 'Reports',
    research: 'Research',
    models: 'Models',
    logs: 'Logs',
    settings: 'Settings',
  },

  home: {
    systemStatus: 'System Status',
    dashboard: 'Dashboard',
    gpuTemp: 'GPU Temp',
    stocksPortfolio: 'Stocks & Portfolio',
    realEstate: 'Real Estate',
    research: 'Research',
    apiUsageCost: 'API Usage & Cost',
    loadingIndices: 'Loading indices...',
    noPortfolioData: 'No portfolio data',
    watchlist: 'Watchlist',
    recentDeals: 'Recent Deals',
    noWatchlistItems: 'No watchlist items',
    noRecentDeals: 'No recent deals',
    noResearchReports: 'No research reports yet',
    confidence: 'Confidence',
    evidence: 'evidence',
    apiCalls: 'API Calls',
    tokens: 'Tokens',
    cost: 'Cost',
    budget: 'Budget',
    remaining: 'remaining',
    noUsageData: 'No usage data',
    view: 'View',
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    languageHint: 'Interface language',
    ollamaModel: 'Ollama Model',
    defaultModel: 'Default Model',
    defaultModelHint: 'Chat/Supervisor default',
    availableModels: 'Available Models',
    loadingModels: 'Loading models...',
    apiKeys: 'API Keys',
    anthropicKey: 'Anthropic API Key',
    anthropicHint: 'Claude Supervisor mode',
    naverClientId: 'Naver Client ID',
    naverHint: 'Stock/Real Estate data',
    keysWarning: 'Keys are stored in browser localStorage. Use environment variables for production.',
    notSet: 'Not set',
    dataCollection: 'Data Collection',
    stockPolling: 'Stock Polling',
    stockPollingHint: 'Market data refresh',
    realEstatePolling: 'Real Estate Polling',
    realEstatePollingHint: 'Real estate data refresh',
    researchCycle: 'Research Cycle',
    researchCycleHint: 'Auto-research interval',
    alertThresholds: 'Alert Thresholds',
    cpuUsage: 'CPU Usage',
    ramUsage: 'RAM Usage',
    gpuUtil: 'GPU Utilization',
    gpuMemory: 'GPU Memory',
    alertHint: 'Alert when exceeded',
    vramAlertHint: 'VRAM usage alert',
    resetDefaults: 'Reset to Defaults',
  },
}

export const messages: Record<Locale, Messages> = { ko, en }

// ---- Number formatting ----
export function formatNumber(value: number, locale: Locale): string {
  return locale === 'ko'
    ? value.toLocaleString('ko-KR')
    : value.toLocaleString('en-US')
}

export function formatCurrency(value: number, locale: Locale): string {
  if (locale === 'ko') {
    return `${Math.round(value).toLocaleString('ko-KR')}원`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatCurrencyCompact(value: number, locale: Locale): string {
  if (locale === 'ko') {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억원`
    if (value >= 10000) return `${Math.round(value / 10000).toLocaleString('ko-KR')}만원`
    return `${Math.round(value).toLocaleString('ko-KR')}원`
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

// ---- Date formatting ----
export function formatDate(ts: string, locale: Locale): string {
  try {
    const d = new Date(ts)
    return locale === 'ko'
      ? d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}

export function formatDateTime(ts: string, locale: Locale): string {
  try {
    const d = new Date(ts)
    return locale === 'ko'
      ? d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

export function formatDateShort(ts: string, locale: Locale): string {
  try {
    const d = new Date(ts)
    return locale === 'ko'
      ? d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}
