# Lucas AI Dashboard — API Documentation

> Auto-generated from codebase. 154 endpoints across 17 modules.
> Base URL: `http://localhost:7777`

## Core System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (service status, WebSocket clients) |
| GET | `/api/integrity` | DB integrity check (tables, indexes, migrations) |
| GET | `/api/error-log` | Structured error log stats and recent errors |
| WS | `/ws` | WebSocket: real-time events (metrics, notifications) |

## Dashboard `/api/dashboard`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/summary` | All key metrics in one call (research, news, trends, system) |

**Response example:**
```json
{
  "research": { "topics_total": 45, "topics_completed": 38, "topics_active": 2, "topics_pending": 5 },
  "reports": { "total": 38, "avg_confidence": 0.72, "total_evidence": 312, "bookmarked": 5, "recent": [...] },
  "news": { "total": 1200, "last_24h": 45, "category_breakdown": [...] },
  "trends": { "top_keywords": [{"keyword": "삼성전자", "count": 15}, ...] },
  "system": { "ollama_available": true, "unread_notifications": 3 }
}
```

## Chat `/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/conversations` | List conversations (last 50) |
| POST | `/api/chat/conversations` | Create new conversation |
| GET | `/api/chat/conversations/{id}/messages` | Get messages for conversation |
| POST | `/api/chat` | Send chat message (streaming SSE response) |

**POST /api/chat body:**
```json
{ "message": "string", "conversation_id": 1, "model": "qwen2.5:14b" }
```

## Models `/api/models`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models` | List available Ollama models with metadata |
| GET | `/api/models/running` | Currently loaded models |
| POST | `/api/models/warmup/{name}` | Load model into VRAM |
| GET | `/api/models/info/{name}` | Detailed model info (params, template) |

## Monitor `/api/monitor`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/monitor/snapshot` | Current system metrics (CPU, RAM, GPU) |
| GET | `/api/monitor/history` | Historical metrics for charts. Query: `hours` (1-168) |
| GET | `/api/monitor/gpu-detail` | GPU details + Ollama VRAM + processes |
| GET | `/api/monitor/processes` | Top N processes by memory. Query: `top_n` |
| GET | `/api/monitor/disk-detail` | Disk usage per drive |

## Tasks `/api/tasks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | Recent tasks. Query: `limit` (default 20) |

## Schedules `/api/schedules`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/schedules` | List schedules. Query: `date`, `status` |
| POST | `/api/schedules` | Create schedule |
| PUT | `/api/schedules/{id}` | Update schedule |
| DELETE | `/api/schedules/{id}` | Delete schedule |
| GET | `/api/schedules/upcoming` | Upcoming events. Query: `hours` (default 24) |

## Expenses `/api/expenses`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/expenses` | List expenses. Query: `date`, `category` |
| POST | `/api/expenses` | Create expense |
| GET | `/api/expenses/summary/{month}` | Monthly summary (YYYY-MM) |
| DELETE | `/api/expenses/{id}` | Delete expense |

## Usage `/api/usage`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/usage` | API usage summary (tokens, cost, budget) |
| GET | `/api/usage/daily` | Daily usage breakdown (last 30 days) |

## Reports `/api/reports`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/stocks` | Current stock prices |
| GET | `/api/reports/indices` | Market indices |
| POST | `/api/reports/stocks/report` | Generate stock report |
| POST | `/api/reports/realestate/report` | Generate real estate report |
| POST | `/api/reports/daily` | Generate full daily report |
| GET | `/api/reports/history` | Past reports. Query: `type` |
| GET | `/api/reports/scheduler` | Scheduler status |
| POST | `/api/reports/scheduler/{job}/run` | Trigger scheduled job |
| GET | `/api/reports/collector/status` | Background collector status |
| GET | `/api/reports/collector/alerts` | Recent price alerts |
| GET | `/api/reports/collector/news` | Collected news. Query: `category` |
| GET | `/api/reports/stocks/history/{symbol}` | Historical OHLCV. Query: `period` |
| GET | `/api/reports/stocks/history-range/{symbol}` | Data by date range |
| GET | `/api/reports/stocks/list` | All tracked stocks with sectors |
| GET | `/api/reports/sectors` | Sector-grouped performance |
| GET | `/api/reports/portfolio` | Portfolio with P&L |
| POST | `/api/reports/portfolio` | Add to portfolio |
| PUT | `/api/reports/portfolio/{id}` | Update holding |
| DELETE | `/api/reports/portfolio/{id}` | Remove from portfolio |
| GET | `/api/reports/stocks/indicators/{symbol}` | All technical indicators |
| GET | `/api/reports/stocks/indicators/{symbol}/sma` | Simple Moving Average |
| GET | `/api/reports/stocks/indicators/{symbol}/ema` | Exponential Moving Average |
| GET | `/api/reports/stocks/indicators/{symbol}/rsi` | RSI |
| GET | `/api/reports/stocks/indicators/{symbol}/macd` | MACD |
| GET | `/api/reports/stocks/indicators/{symbol}/bollinger` | Bollinger Bands |

## Agents `/api/agents`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/{id}` | Agent details |
| GET | `/api/agents/{id}/logs` | Agent logs |

## Real Estate `/api/realestate`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/realestate/trends` | Monthly price trends. Query: `district`, `dong` |
| GET | `/api/realestate/trends/apt` | Apartment price trend |
| GET | `/api/realestate/compare` | Compare district averages |
| POST | `/api/realestate/compare/monthly` | Compare monthly trends |
| GET | `/api/realestate/districts` | Districts with data |
| GET | `/api/realestate/watchlist` | Watchlist with prices |
| POST | `/api/realestate/watchlist` | Add to watchlist |
| GET | `/api/realestate/watchlist/{id}` | Single watchlist item |
| DELETE | `/api/realestate/watchlist/{id}` | Remove from watchlist |
| GET | `/api/realestate/deals` | Recent deals. Query: `district`, `type` |

## Research `/api/research`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/research/topics` | List topics. Query: `status`, `category` |
| GET | `/api/research/reports` | List reports. Query: `category`, `bookmarked` |
| PUT | `/api/research/reports/{id}/bookmark` | Toggle bookmark |
| GET | `/api/research/reports/{id}` | Full report + evidence chain |
| GET | `/api/research/evidence/{topic_id}` | Evidence for topic |
| POST | `/api/research/trigger` | Trigger research. Body: `query`, `category`, `priority` |
| GET | `/api/research/status` | Engine status |
| GET | `/api/research/signals` | Detected trading signals |
| POST | `/api/research/signals/scan` | Trigger signal scan |
| GET | `/api/research/vram` | VRAM usage + loaded models |
| POST | `/api/research/vram/load` | Load model |
| POST | `/api/research/vram/unload` | Unload models |
| POST | `/api/research/vram/prepare-whisper` | Free VRAM for Whisper |
| POST | `/api/research/vram/restore` | Restore default model |
| GET | `/api/research/sentiment` | Latest sentiment scores |
| GET | `/api/research/sentiment/{symbol}` | Sentiment history |
| POST | `/api/research/sentiment/analyze` | Trigger sentiment analysis |
| GET | `/api/research/daily-reports` | List daily reports |
| GET | `/api/research/daily-reports/{date}` | Daily report for date |
| GET | `/api/research/schedule` | Scheduled research keywords |
| POST | `/api/research/schedule` | Add scheduled keyword |
| PUT | `/api/research/schedule/{id}` | Update keyword |
| DELETE | `/api/research/schedule/{id}` | Delete keyword |
| POST | `/api/research/schedule/run` | Trigger scheduled research |
| GET | `/api/research/compare` | Compare past vs current |
| GET | `/api/research/compare/{a}/{b}` | Compare two reports |
| GET | `/api/research/reports/{id}/export` | Export as MD or PDF. Query: `format` |
| GET | `/api/research/alerts` | Keyword alert subscriptions |
| POST | `/api/research/alerts` | Subscribe to keyword |
| PUT | `/api/research/alerts/{id}` | Update alert |
| DELETE | `/api/research/alerts/{id}` | Delete alert |
| GET | `/api/research/quality` | Aggregate quality metrics |
| GET | `/api/research/quality/{id}` | Quality for specific report |

## Notifications `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications. Query: `unread_only`, `type`, `limit`, `offset` |
| GET | `/api/notifications/unread-count` | Unread count |
| PUT | `/api/notifications/{id}/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/{id}` | Delete notification |

## Logs `/api/logs`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs` | Server logs. Query: `level`, `lines`, `search` |
| GET | `/api/logs/stats` | Log level statistics |

## Export `/api/export`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export/stocks` | Stock data as CSV |
| GET | `/api/export/realestate` | Real estate data as CSV |
| GET | `/api/export/research` | Research reports as Markdown |
| GET | `/api/export/expenses` | Expense data as CSV |

## Input History `/api/inputhistory`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inputhistory` | Inbox history with filtering |
| GET | `/api/inputhistory/stats` | Inbox summary statistics |
| GET | `/api/inputhistory/commander-log` | Parsed commander log entries |
| GET | `/api/inputhistory/{id}` | Full detail of inbox entry |

## Trends `/api/trends`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trends/keywords` | Keyword frequency trends. Query: `days`, `top_n` |
| GET | `/api/trends/categories` | Category distribution. Query: `days` |
| GET | `/api/trends/insights/weekly` | Past weekly insights |
| POST | `/api/trends/insights/weekly` | Generate weekly insight. Query: `force` |
| GET | `/api/trends/pipeline/stats` | Pipeline monitoring stats |
| GET | `/api/trends/queue` | Research queue status |
| POST | `/api/trends/queue` | Add to research queue |
| DELETE | `/api/trends/queue/{id}` | Remove from queue |
| GET | `/api/trends/sources/status` | External data source status |
| GET | `/api/trends/sources/news` | Fetch RSS news. Query: `category` |
| POST | `/api/trends/sources/news/crawl` | Crawl all news categories |
| GET | `/api/trends/sources/news/search` | Search news. Query: `q` |
| GET | `/api/trends/sources/realestate` | Real estate data summary |

## Authentication

Set `DASHBOARD_API_KEY` environment variable to enable API key auth.
- Pass key via `X-API-Key` header or `api_key` query parameter
- `/api/health` is always accessible without auth
- If env var is not set, auth is disabled (dev mode)
