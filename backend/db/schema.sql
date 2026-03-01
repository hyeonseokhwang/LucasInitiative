-- Lucas AI Dashboard Schema

CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    model           TEXT,
    tokens_used     INTEGER DEFAULT 0,
    duration_ms     INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    description     TEXT,
    model           TEXT,
    input_summary   TEXT,
    output_summary  TEXT,
    error           TEXT,
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_percent     REAL,
    ram_used_gb     REAL,
    ram_total_gb    REAL,
    gpu_util        INTEGER,
    gpu_mem_used_mb INTEGER,
    gpu_mem_total_mb INTEGER,
    gpu_temp_c      INTEGER,
    ollama_running  INTEGER DEFAULT 0,
    active_model    TEXT,
    recorded_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schedule / Calendar
CREATE TABLE IF NOT EXISTS schedules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    start_at    TEXT NOT NULL,              -- ISO datetime
    end_at      TEXT,                        -- nullable for point events
    all_day     INTEGER DEFAULT 0,
    category    TEXT DEFAULT 'general',      -- general, work, personal, meeting
    remind_at   TEXT,                        -- reminder datetime
    status      TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Expense tracker (가계부)
CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    amount      INTEGER NOT NULL,            -- KRW, no decimals
    category    TEXT NOT NULL DEFAULT 'etc',  -- food, transport, shopping, bills, income, etc
    description TEXT,
    is_income   INTEGER DEFAULT 0,           -- 0=expense, 1=income
    paid_at     TEXT NOT NULL DEFAULT (datetime('now')),
    source      TEXT DEFAULT 'manual',       -- manual, kakao_pay, chat
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    provider        TEXT NOT NULL DEFAULT 'anthropic',  -- anthropic, openai, etc
    model           TEXT NOT NULL,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    cost_usd        REAL NOT NULL DEFAULT 0,            -- calculated cost
    purpose         TEXT,                                -- chat, schedule, expense, search
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Market data (stocks)
CREATE TABLE IF NOT EXISTS market_data (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    name        TEXT,
    market      TEXT NOT NULL,              -- KOSPI, KOSDAQ, NYSE, NASDAQ
    price       REAL,
    change_pct  REAL,
    volume      INTEGER,
    high        REAL,
    low         REAL,
    open_price  REAL,
    prev_close  REAL,
    market_cap  REAL,
    extra       TEXT,                        -- JSON for additional data
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Real estate data
CREATE TABLE IF NOT EXISTS realestate_data (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    district    TEXT NOT NULL,               -- 구 (강남구, 서초구, etc)
    dong        TEXT,                        -- 동
    apt_name    TEXT,
    deal_type   TEXT NOT NULL,               -- sale, jeonse, monthly
    price       INTEGER,                     -- 만원 단위
    deposit     INTEGER,                     -- 보증금 (월세일때)
    monthly     INTEGER,                     -- 월세
    area_m2     REAL,
    floor       INTEGER,
    deal_date   TEXT,
    source      TEXT DEFAULT 'crawl',
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Real estate watchlist
CREATE TABLE IF NOT EXISTS realestate_watchlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    district    TEXT NOT NULL,               -- 구
    dong        TEXT,                        -- 동
    apt_name    TEXT,                        -- 아파트명
    deal_type   TEXT DEFAULT 'sale',         -- sale, jeonse, monthly
    memo        TEXT,
    target_price INTEGER,                   -- 관심 가격 (만원)
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_watchlist_district ON realestate_watchlist(district);

-- Scheduled jobs
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    cron        TEXT NOT NULL,               -- cron expression: "0 9 * * *"
    job_type    TEXT NOT NULL,               -- stock_report, realestate_report, custom
    config      TEXT,                        -- JSON config
    enabled     INTEGER DEFAULT 1,
    last_run    TEXT,
    next_run    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT NOT NULL,               -- stock, realestate, combined
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    data_json   TEXT,                        -- raw data backup
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collected items (deduplicated)
CREATE TABLE IF NOT EXISTS collected_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category     TEXT NOT NULL,               -- news_stock, news_realestate, news_finance, stock_alert
    title        TEXT NOT NULL,
    content      TEXT,
    source       TEXT,
    url          TEXT,
    content_hash TEXT NOT NULL,               -- MD5 for dedup
    extra        TEXT,                        -- JSON
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Research topics (investigation subjects)
CREATE TABLE IF NOT EXISTS research_topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    query       TEXT NOT NULL,
    priority    INTEGER DEFAULT 5,              -- 1=urgent alert, 5=trending, 7=routine
    status      TEXT DEFAULT 'pending'
                CHECK(status IN ('pending', 'researching', 'validating', 'completed', 'failed')),
    trigger_type TEXT DEFAULT 'auto',           -- auto, alert, manual
    category    TEXT DEFAULT 'general',          -- stock, realestate, general
    source_data TEXT,                           -- JSON: triggering context
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Research evidence (individual claims from sources)
CREATE TABLE IF NOT EXISTS research_evidence (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id    INTEGER NOT NULL REFERENCES research_topics(id) ON DELETE CASCADE,
    claim       TEXT NOT NULL,
    source      TEXT NOT NULL,                  -- source name/url
    source_type TEXT DEFAULT 'web',             -- web, db_market, db_news, db_alert
    confidence  REAL DEFAULT 0.5,               -- 0.0 ~ 1.0
    agrees_with TEXT,                           -- JSON array of evidence IDs
    contradicts TEXT,                           -- JSON array of evidence IDs
    verified    INTEGER DEFAULT 0,              -- 0=unverified, 1=cross-verified
    raw_data    TEXT,                           -- original snippet
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Research reports (final analysis output)
CREATE TABLE IF NOT EXISTS research_reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id        INTEGER NOT NULL REFERENCES research_topics(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL,
    full_analysis   TEXT NOT NULL,
    confidence_avg  REAL DEFAULT 0.5,
    agreement_rate  REAL DEFAULT 0.0,           -- % of evidence that agrees
    contradictions  INTEGER DEFAULT 0,          -- count of contradicting pairs
    evidence_count  INTEGER DEFAULT 0,
    model_used      TEXT,
    bookmarked      INTEGER DEFAULT 0,          -- 0=normal, 1=bookmarked
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Source reliability tracking
CREATE TABLE IF NOT EXISTS source_reliability (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name     TEXT NOT NULL UNIQUE,
    verified_claims INTEGER DEFAULT 0,
    total_claims    INTEGER DEFAULT 0,
    reliability     REAL DEFAULT 0.5,           -- verified/total ratio
    last_updated    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    name        TEXT NOT NULL,
    quantity    REAL NOT NULL DEFAULT 0,
    avg_price   REAL NOT NULL DEFAULT 0,
    sector      TEXT DEFAULT '기타',
    market      TEXT DEFAULT 'US',
    added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolio_symbol ON portfolio(symbol);

-- Telegram subscribers
CREATE TABLE IF NOT EXISTS telegram_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id         TEXT NOT NULL UNIQUE,
    username        TEXT,
    alerts_enabled  INTEGER DEFAULT 1,
    research_enabled INTEGER DEFAULT 1,
    daily_enabled   INTEGER DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL DEFAULT 'info',       -- info, alert, warning, error, research, stock
    title       TEXT NOT NULL,
    message     TEXT,
    read        INTEGER DEFAULT 0,                  -- 0=unread, 1=read
    metadata    TEXT,                                -- JSON for extra data
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_collected_hash ON collected_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_collected_cat ON collected_items(category, created_at);
CREATE INDEX IF NOT EXISTS idx_market_symbol ON market_data(symbol, recorded_at);
CREATE INDEX IF NOT EXISTS idx_realestate_district ON realestate_data(district, recorded_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_metrics_time ON metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_schedules_start ON schedules(start_at);
CREATE INDEX IF NOT EXISTS idx_expenses_paid ON expenses(paid_at);
CREATE INDEX IF NOT EXISTS idx_research_topics_status ON research_topics(status, priority);
CREATE INDEX IF NOT EXISTS idx_research_evidence_topic ON research_evidence(topic_id);
CREATE INDEX IF NOT EXISTS idx_research_reports_topic ON research_reports(topic_id);

-- Sentiment analysis scores
CREATE TABLE IF NOT EXISTS sentiment_scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    name        TEXT NOT NULL,
    score       REAL NOT NULL,                  -- -1.0 (very negative) to +1.0 (very positive)
    label       TEXT NOT NULL,                  -- positive, negative, neutral
    summary     TEXT,                           -- LLM-generated summary
    news_count  INTEGER DEFAULT 0,             -- number of news articles analyzed
    model_used  TEXT,
    analyzed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sentiment_symbol ON sentiment_scores(symbol, analyzed_at);
CREATE INDEX IF NOT EXISTS idx_sentiment_date ON sentiment_scores(analyzed_at);
