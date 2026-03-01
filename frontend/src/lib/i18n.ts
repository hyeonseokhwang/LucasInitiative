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
    signals: string
    inputhistory: string
    dailyreport: string
    sentiment: string
    divisions: string
    workers: string
    tokenusage: string
    llmactivity: string
    models: string
    logs: string
    settings: string
  }

  // Signals tab
  sig: {
    title: string
    scan: string
    scanning: string
    lastScan: string
    noSignals: string
    noSignalsHint: string
    goldenCross: string
    deathCross: string
    rsiOversold: string
    rsiOverbought: string
    volumeBreakout: string
    buy: string
    sell: string
    caution: string
    strong: string
    moderate: string
    detected: string
    signalCount: string
  }

  // LLM Activity
  llm: {
    title: string
    active: string
    available: string
    swaps: string
    polling: string
    currentModel: string
    noActive: string
    noActiveHint: string
    vramUsage: string
    freeVram: string
    vramChart: string
    modelStats: string
    activeTime: string
    avgGpu: string
    avgVram: string
    samples: string
    swapHistory: string
    availableModels: string
    villageStatus: string
    villageDay: string
    conversations: string
    tokensGenerated: string
    noData: string
  }

  // Token Usage
  tok_panel: {
    title: string
    lastUpdated: string
    planUsage: string
    usageSummary: string
    totalTokens: string
    inputTokens: string
    outputTokens: string
    apiCalls: string
    estimatedCost: string
    projections: string
    dailyAvg: string
    weeklyEst: string
    monthlyEst: string
    hourlyUsage: string
    dailyUsage: string
    apiCostComparison: string
    apiCostDesc: string
    equivalent: string
    costOptTitle: string
    singlePlan: string
    dualPlan: string
    apiDirect: string
    dualBenefit: string
    apiDirectNote: string
    currentUsage: string
    verdict: string
    noData: string
  }

  // Worker Jobs
  wj: {
    title: string
    active: string
    totalReports: string
    polling: string
    liveView: string
    timeline: string
    noWorkers: string
    noWorkersHint: string
    reports: string
    recentReports: string
    needsDecision: string
    noReports: string
  }

  // Division management
  div: {
    title: string
    divisions: string
    products: string
    workers: string
    running: string
    uptime: string
    cardView: string
    orgChart: string
    openLink: string
    techStack: string
    revenueModel: string
    devPhase: string
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
    serviceStatus: string
    online: string
    offline: string
    todayActivity: string
    workerReports: string
    signalsDetected: string
    quickLinks: string
  }

  // Stocks tab
  stocks: {
    title: string
    back: string
    search: string
    searchPlaceholder: string
    allMarkets: string
    allSectors: string
    name: string
    price: string
    change: string
    volume: string
    marketCap: string
    open: string
    high: string
    low: string
    noData: string
    sector: string
  }

  // Real Estate tab
  re: {
    title: string
    trends: string
    compare: string
    deals: string
    allDistricts: string
    allTypes: string
    sale: string
    jeonse: string
    monthly: string
    months6: string
    months12: string
    months24: string
    avgPriceTrend: string
    monthlyDealCount: string
    loadingTrends: string
    noTrendData: string
    dataCollectedHourly: string
    avgPriceByDistrict: string
    monthlyPriceCompare: string
    loadingCompare: string
    noCompareData: string
    selectDistrictsHint: string
    selected: string
    max: string
    refresh: string
    deals_count: string
    noRecentDeals: string
    date: string
    district: string
    apt: string
    type: string
    priceLabel: string
    area: string
    floor: string
    prev: string
    next: string
    searchApt: string
    searchAptPlaceholder: string
    priceRange: string
    priceMin: string
    priceMax: string
    month: string
    avg: string
    min: string
    maxPrice: string
    avgArea: string
    perM2: string
  }

  // Sentiment Analysis
  sent: {
    title: string
    positive: string
    negative: string
    neutral: string
    score: string
    headlines: string
    noData: string
    noDataHint: string
    loading: string
    source: string
    date: string
    overall: string
    bullish: string
    bearish: string
    mixed: string
    searchSymbol: string
    searchPlaceholder: string
    sentimentScore: string
    newsCount: string
  }

  // Home - Challenge widget
  challenge: {
    title: string
    progress: string
    dDay: string
    milestones: string
    earnings: string
    target: string
    current: string
    remaining: string
    completed: string
    active: string
    noChallenges: string
    noChallengesHint: string
    deadline: string
  }

  // Daily Report tab
  dr: {
    title: string
    selectDate: string
    noReports: string
    noReportsHint: string
    generatedAt: string
    reportType: string
    combined: string
    stock: string
    realestate: string
    loadingReport: string
    back: string
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
    signals: '시그널',
    inputhistory: '입력내역',
    dailyreport: '일일리포트',
    sentiment: '감성분석',
    divisions: '사업부',
    workers: '워커',
    tokenusage: '토큰',
    llmactivity: 'LLM',
    models: '모델',
    logs: '로그',
    settings: '설정',
  },

  sig: {
    title: '금융 시그널',
    scan: '스캔',
    scanning: '스캔 중...',
    lastScan: '마지막 스캔',
    noSignals: '감지된 시그널이 없습니다',
    noSignalsHint: '스캔 버튼을 눌러 시그널을 감지하세요',
    goldenCross: '골든크로스',
    deathCross: '데드크로스',
    rsiOversold: 'RSI 과매도',
    rsiOverbought: 'RSI 과매수',
    volumeBreakout: '거래량 돌파',
    buy: '매수',
    sell: '매도',
    caution: '주의',
    strong: '강함',
    moderate: '보통',
    detected: '감지',
    signalCount: '개 시그널',
  },

  div: {
    title: '사업부 관리',
    divisions: '개 부서',
    products: '개 제품',
    workers: '명 워커',
    running: '가동중',
    uptime: '가동률',
    cardView: '카드',
    orgChart: '조직도',
    openLink: '접속',
    techStack: '기술 스택',
    revenueModel: '수익 모델',
    devPhase: '개발 단계',
  },

  llm: {
    title: '로컬 LLM 활동',
    active: '활성',
    available: '사용 가능',
    swaps: '스왑',
    polling: '폴링',
    currentModel: '현재 활성 모델',
    noActive: '활성 모델 없음',
    noActiveHint: 'Ollama에 로드된 모델이 없습니다',
    vramUsage: 'VRAM 사용량',
    freeVram: '여유 VRAM',
    vramChart: 'VRAM 사용량 추이',
    modelStats: '모델별 통계',
    activeTime: '활동 시간',
    avgGpu: '평균 GPU',
    avgVram: '평균 VRAM',
    samples: '샘플 수',
    swapHistory: '모델 스왑 히스토리',
    availableModels: '사용 가능한 모델',
    villageStatus: 'LLM Village 상태',
    villageDay: '시뮬레이션 일차',
    conversations: '대화 수',
    tokensGenerated: '생성 토큰',
    noData: '데이터 없음',
  },

  tok_panel: {
    title: '토큰 사용량 분석',
    lastUpdated: '마지막 업데이트',
    planUsage: '플랜 사용량',
    usageSummary: '사용량 요약',
    totalTokens: '총 토큰',
    inputTokens: '입력 토큰',
    outputTokens: '출력 토큰',
    apiCalls: 'API 호출',
    estimatedCost: '추정 비용',
    projections: '사용량 예측',
    dailyAvg: '일 평균',
    weeklyEst: '주간 예상',
    monthlyEst: '월간 예상',
    hourlyUsage: '시간별 사용량 (오늘)',
    dailyUsage: '일별 사용량 (최근 14일)',
    apiCostComparison: 'API 비용 환산',
    apiCostDesc: '동일한 사용량을 Claude API로 직접 처리했다면 얼마였을지 비교합니다.',
    equivalent: '환산 비용',
    costOptTitle: '비용 최적화 분석',
    singlePlan: '싱글 플랜 (Max)',
    dualPlan: '듀얼 플랜 (Max x2)',
    apiDirect: 'API 직접 사용',
    dualBenefit: '2배 용량, 병렬 워커 분산',
    apiDirectNote: 'Opus 기준, 사용한 만큼만 과금',
    currentUsage: '현재 사용량',
    verdict: '분석 결과',
    noData: '데이터 없음',
  },

  wj: {
    title: '워커 현황',
    active: '작업중',
    totalReports: '건 보고',
    polling: '폴링',
    liveView: '실시간',
    timeline: '타임라인',
    noWorkers: '활성 워커 없음',
    noWorkersHint: 'Command Center(localhost:9000)가 실행 중인지 확인하세요',
    reports: '건 보고',
    recentReports: '최근 보고',
    needsDecision: '판단 필요',
    noReports: '보고 내역 없음',
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
    serviceStatus: '서비스 상태',
    online: '온라인',
    offline: '오프라인',
    todayActivity: '오늘의 활동',
    workerReports: '워커 보고',
    signalsDetected: '감지된 시그널',
    quickLinks: '퀵 링크',
  },

  stocks: {
    title: '주식',
    back: '뒤로',
    search: '검색',
    searchPlaceholder: '종목명 또는 코드 검색...',
    allMarkets: '전체',
    allSectors: '전체 섹터',
    name: '종목명',
    price: '현재가',
    change: '등락률',
    volume: '거래량',
    marketCap: '시가총액',
    open: '시가',
    high: '고가',
    low: '저가',
    noData: '종목 데이터가 없습니다',
    sector: '섹터',
  },

  re: {
    title: '부동산',
    trends: '추이',
    compare: '비교',
    deals: '거래내역',
    allDistricts: '전체 지역',
    allTypes: '전체 유형',
    sale: '매매',
    jeonse: '전세',
    monthly: '월세',
    months6: '6개월',
    months12: '12개월',
    months24: '24개월',
    avgPriceTrend: '평균가 추이',
    monthlyDealCount: '월별 거래건수',
    loadingTrends: '추이 로딩 중...',
    noTrendData: '추이 데이터가 없습니다',
    dataCollectedHourly: '데이터는 매시간 자동 수집됩니다',
    avgPriceByDistrict: '지역별 평균가',
    monthlyPriceCompare: '월별 가격 비교',
    loadingCompare: '비교 데이터 로딩 중...',
    noCompareData: '비교 데이터가 없습니다',
    selectDistrictsHint: '지역을 선택하고 데이터 수집을 기다리세요',
    selected: '선택됨',
    max: '최대',
    refresh: '새로고침',
    deals_count: '건',
    noRecentDeals: '최근 거래가 없습니다',
    date: '날짜',
    district: '지역',
    apt: '아파트',
    type: '유형',
    priceLabel: '가격',
    area: '면적',
    floor: '층',
    prev: '이전',
    next: '다음',
    searchApt: '아파트 검색',
    searchAptPlaceholder: '아파트명 검색...',
    priceRange: '가격대',
    priceMin: '최소 (만원)',
    priceMax: '최대 (만원)',
    month: '월',
    avg: '평균',
    min: '최소',
    maxPrice: '최대',
    avgArea: '평균 면적',
    perM2: '평당가',
  },

  sent: {
    title: '금융 감성분석',
    positive: '긍정',
    negative: '부정',
    neutral: '중립',
    score: '점수',
    headlines: '뉴스 헤드라인',
    noData: '감성분석 데이터가 없습니다',
    noDataHint: 'Worker-1이 LLM 감성분석을 완료하면 여기서 확인할 수 있습니다',
    loading: '감성분석 로딩 중...',
    source: '출처',
    date: '날짜',
    overall: '종합',
    bullish: '강세',
    bearish: '약세',
    mixed: '혼합',
    searchSymbol: '종목 검색',
    searchPlaceholder: '종목명 또는 코드...',
    sentimentScore: '감성 점수',
    newsCount: '뉴스 수',
  },

  challenge: {
    title: '챌린지 현황',
    progress: '진행률',
    dDay: 'D-day',
    milestones: '마일스톤',
    earnings: '수익',
    target: '목표',
    current: '현재',
    remaining: '잔여',
    completed: '완료',
    active: '진행중',
    noChallenges: '등록된 챌린지가 없습니다',
    noChallengesHint: '스케줄러에서 챌린지를 추가하세요',
    deadline: '마감일',
  },

  dr: {
    title: '일일 리포트',
    selectDate: '날짜를 선택하세요',
    noReports: '리포트가 없습니다',
    noReportsHint: '데일리 리포트 생성 후 여기서 확인할 수 있습니다',
    generatedAt: '생성일시',
    reportType: '리포트 유형',
    combined: '종합',
    stock: '주식',
    realestate: '부동산',
    loadingReport: '리포트 로딩 중...',
    back: '목록으로',
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
    signals: 'Signals',
    inputhistory: 'History',
    dailyreport: 'Daily Report',
    sentiment: 'Sentiment',
    divisions: 'Divisions',
    workers: 'Workers',
    tokenusage: 'Tokens',
    llmactivity: 'LLM',
    models: 'Models',
    logs: 'Logs',
    settings: 'Settings',
  },

  sig: {
    title: 'Trading Signals',
    scan: 'Scan',
    scanning: 'Scanning...',
    lastScan: 'Last Scan',
    noSignals: 'No signals detected',
    noSignalsHint: 'Press Scan to detect trading signals',
    goldenCross: 'Golden Cross',
    deathCross: 'Death Cross',
    rsiOversold: 'RSI Oversold',
    rsiOverbought: 'RSI Overbought',
    volumeBreakout: 'Volume Breakout',
    buy: 'Buy',
    sell: 'Sell',
    caution: 'Caution',
    strong: 'Strong',
    moderate: 'Moderate',
    detected: 'detected',
    signalCount: 'signals',
  },

  div: {
    title: 'Division Management',
    divisions: 'divisions',
    products: 'products',
    workers: 'workers',
    running: 'running',
    uptime: 'Uptime',
    cardView: 'Cards',
    orgChart: 'Org Chart',
    openLink: 'Open',
    techStack: 'Tech Stack',
    revenueModel: 'Revenue Model',
    devPhase: 'Dev Phase',
  },

  llm: {
    title: 'Local LLM Activity',
    active: 'active',
    available: 'available',
    swaps: 'swaps',
    polling: 'polling',
    currentModel: 'Current Active Model',
    noActive: 'No active model',
    noActiveHint: 'No models loaded in Ollama',
    vramUsage: 'VRAM Usage',
    freeVram: 'Free VRAM',
    vramChart: 'VRAM Usage Timeline',
    modelStats: 'Model Statistics',
    activeTime: 'Active Time',
    avgGpu: 'Avg GPU',
    avgVram: 'Avg VRAM',
    samples: 'Samples',
    swapHistory: 'Model Swap History',
    availableModels: 'Available Models',
    villageStatus: 'LLM Village Status',
    villageDay: 'Simulation Day',
    conversations: 'Conversations',
    tokensGenerated: 'Tokens Generated',
    noData: 'No data',
  },

  tok_panel: {
    title: 'Token Usage Analytics',
    lastUpdated: 'Last updated',
    planUsage: 'Plan Usage',
    usageSummary: 'Usage Summary',
    totalTokens: 'Total Tokens',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    apiCalls: 'API Calls',
    estimatedCost: 'Est. Cost',
    projections: 'Projections',
    dailyAvg: 'Daily Avg',
    weeklyEst: 'Weekly Est.',
    monthlyEst: 'Monthly Est.',
    hourlyUsage: 'Hourly Usage (Today)',
    dailyUsage: 'Daily Usage (Last 14 days)',
    apiCostComparison: 'API Cost Equivalent',
    apiCostDesc: 'What would the same usage cost if processed directly via Claude API.',
    equivalent: 'Equivalent',
    costOptTitle: 'Cost Optimization Analysis',
    singlePlan: 'Single Plan (Max)',
    dualPlan: 'Dual Plan (Max x2)',
    apiDirect: 'API Direct',
    dualBenefit: '2x capacity, parallel worker distribution',
    apiDirectNote: 'Opus pricing, pay-per-use only',
    currentUsage: 'Current usage',
    verdict: 'Verdict',
    noData: 'No data',
  },

  wj: {
    title: 'Worker Status',
    active: 'active',
    totalReports: 'reports',
    polling: 'polling',
    liveView: 'Live',
    timeline: 'Timeline',
    noWorkers: 'No active workers',
    noWorkersHint: 'Check if Command Center (localhost:9000) is running',
    reports: 'reports',
    recentReports: 'Recent Reports',
    needsDecision: 'Needs Decision',
    noReports: 'No reports yet',
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
    serviceStatus: 'Service Status',
    online: 'Online',
    offline: 'Offline',
    todayActivity: "Today's Activity",
    workerReports: 'Worker Reports',
    signalsDetected: 'Signals Detected',
    quickLinks: 'Quick Links',
  },

  stocks: {
    title: 'Stocks',
    back: 'Back',
    search: 'Search',
    searchPlaceholder: 'Search by name or symbol...',
    allMarkets: 'ALL',
    allSectors: 'All Sectors',
    name: 'Name',
    price: 'Price',
    change: 'Change',
    volume: 'Volume',
    marketCap: 'Market Cap',
    open: 'Open',
    high: 'High',
    low: 'Low',
    noData: 'No stock data available',
    sector: 'Sector',
  },

  re: {
    title: 'Real Estate',
    trends: 'Trends',
    compare: 'Compare',
    deals: 'Deals',
    allDistricts: 'All Districts',
    allTypes: 'All Types',
    sale: 'Sale',
    jeonse: 'Jeonse',
    monthly: 'Monthly',
    months6: '6 months',
    months12: '12 months',
    months24: '24 months',
    avgPriceTrend: 'Average Price Trend',
    monthlyDealCount: 'Monthly Deal Count',
    loadingTrends: 'Loading trends...',
    noTrendData: 'No trend data available',
    dataCollectedHourly: 'Data is collected automatically every hour',
    avgPriceByDistrict: 'Average Price by District',
    monthlyPriceCompare: 'Monthly Price Comparison',
    loadingCompare: 'Loading comparison...',
    noCompareData: 'No comparison data',
    selectDistrictsHint: 'Select districts and wait for data collection',
    selected: 'selected',
    max: 'max',
    refresh: 'Refresh',
    deals_count: 'deals',
    noRecentDeals: 'No recent deals',
    date: 'Date',
    district: 'District',
    apt: 'Apt',
    type: 'Type',
    priceLabel: 'Price',
    area: 'Area',
    floor: 'Floor',
    prev: 'Prev',
    next: 'Next',
    searchApt: 'Search Apt',
    searchAptPlaceholder: 'Search apartment name...',
    priceRange: 'Price Range',
    priceMin: 'Min (10K KRW)',
    priceMax: 'Max (10K KRW)',
    month: 'Month',
    avg: 'Avg',
    min: 'Min',
    maxPrice: 'Max',
    avgArea: 'Avg Area',
    perM2: 'Per m\u00B2',
  },

  sent: {
    title: 'Financial Sentiment',
    positive: 'Positive',
    negative: 'Negative',
    neutral: 'Neutral',
    score: 'Score',
    headlines: 'News Headlines',
    noData: 'No sentiment data available',
    noDataHint: 'Sentiment analysis will appear here once Worker-1 completes LLM processing',
    loading: 'Loading sentiment...',
    source: 'Source',
    date: 'Date',
    overall: 'Overall',
    bullish: 'Bullish',
    bearish: 'Bearish',
    mixed: 'Mixed',
    searchSymbol: 'Search Symbol',
    searchPlaceholder: 'Name or symbol...',
    sentimentScore: 'Sentiment Score',
    newsCount: 'News Count',
  },

  challenge: {
    title: 'Challenges',
    progress: 'Progress',
    dDay: 'D-day',
    milestones: 'Milestones',
    earnings: 'Earnings',
    target: 'Target',
    current: 'Current',
    remaining: 'Remaining',
    completed: 'Completed',
    active: 'Active',
    noChallenges: 'No challenges registered',
    noChallengesHint: 'Add challenges in the Scheduler',
    deadline: 'Deadline',
  },

  dr: {
    title: 'Daily Reports',
    selectDate: 'Select a date',
    noReports: 'No reports available',
    noReportsHint: 'Reports will appear here after generation',
    generatedAt: 'Generated at',
    reportType: 'Report Type',
    combined: 'Combined',
    stock: 'Stock',
    realestate: 'Real Estate',
    loadingReport: 'Loading report...',
    back: 'Back to list',
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
