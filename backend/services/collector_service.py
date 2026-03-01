"""
Background data collector — runs continuously, deduplicates, detects opportunities.
CPU + network only (no GPU). Runs independently of chat/UI.
"""
import asyncio
import hashlib
import json
from datetime import datetime, timedelta
from services.db_service import execute, fetch_all, fetch_one
from services.stock_service import fetch_stock_data, fetch_indices
from services.crawl_service import search_web
from ws.handler import manager as ws_manager


# In-memory seen cache (persisted to DB too)
_seen_hashes: set[str] = set()


def _hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


async def _load_seen():
    """Load already-seen hashes from DB on startup."""
    global _seen_hashes
    rows = await fetch_all(
        "SELECT content_hash FROM collected_items WHERE created_at > datetime('now', '-7 days')"
    )
    _seen_hashes = {r["content_hash"] for r in rows}
    print(f"[Collector] Loaded {len(_seen_hashes)} seen hashes")


async def _is_new(content: str, source: str) -> bool:
    """Check if content is new (not seen before)."""
    h = _hash(content + source)
    if h in _seen_hashes:
        return False
    _seen_hashes.add(h)
    return True


async def _save_item(category: str, title: str, content: str, source: str, url: str = "", extra: dict = None):
    """Save a collected item to DB."""
    h = _hash(content + source)
    await execute(
        """INSERT INTO collected_items (category, title, content, source, url, content_hash, extra)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (category, title, content[:2000], source, url, h, json.dumps(extra or {}, ensure_ascii=False)),
    )


async def collect_stock_prices():
    """Collect current stock prices. Runs every 5 minutes during market hours."""
    try:
        indices = await fetch_indices()
        kr_stocks = await fetch_stock_data(market="kr")
        us_stocks = await fetch_stock_data(market="us")

        all_data = indices + kr_stocks + us_stocks
        alerts = []

        for item in all_data:
            if "error" in item:
                continue

            change = abs(item.get("change_pct", 0))
            symbol = item.get("symbol", "")
            name = item.get("name", symbol)

            # Save to market_data (including OHLCV)
            await execute(
                """INSERT INTO market_data (symbol, name, market, price, change_pct, prev_close, market_cap, open_price, high, low, volume)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (symbol, name, item.get("market", item.get("region", "")),
                 item.get("price", 0), item.get("change_pct", 0),
                 item.get("prev_close", 0), item.get("market_cap", 0),
                 item.get("open_price", 0), item.get("high", 0),
                 item.get("low", 0), item.get("volume", 0)),
            )

            # Opportunity detection: flag big movers (±3%)
            if change >= 3.0:
                direction = "SURGE" if item["change_pct"] > 0 else "DROP"
                alert = f"[{direction}] {name}: {item['change_pct']:+.1f}% (price: {item.get('price', 0):,.0f})"
                alerts.append(alert)

        if alerts:
            alert_text = "\n".join(alerts)
            await _save_item("stock_alert", "Price Alert", alert_text, "yfinance", extra={"alerts": alerts})
            await ws_manager.broadcast({
                "type": "collector_alert",
                "data": {"category": "stock", "message": alert_text, "count": len(alerts)},
            })
            # Save to notifications table
            try:
                from services.notification_service import check_stock_alerts
                await check_stock_alerts(all_data, threshold=3.0)
            except Exception as e:
                print(f"[Collector] Notification error: {e}")
            # Trigger ONE combined research for all alerts (not per-alert)
            try:
                from services.research_service import queue_alert
                summary = f"급등락 {len(alerts)}건 종합"
                await queue_alert(f"Stock Alert: {summary}", alert_text, {"alerts": alerts})
            except Exception as e:
                print(f"[Collector] Research queue error: {e}")
            # Telegram push
            try:
                from services.telegram_service import send_alert
                await send_alert(alert_text)
            except Exception:
                pass

        return len(all_data)

    except Exception as e:
        print(f"[Collector] Stock error: {e}")
        return 0


async def collect_news(queries: list[str] = None):
    """Collect financial/real estate news. Deduplicates by title hash."""
    if queries is None:
        queries = [
            "한국 주식 시장 오늘 속보",
            "서울 아파트 시세 동향",
            "부동산 정책 뉴스 2026",
            "미국 주식 시장 뉴스",
            "금리 환율 경제 뉴스",
        ]

    new_count = 0

    for query in queries:
        try:
            results = await search_web(query, max_results=5)
            for item in results:
                title = item.get("title", "")
                body = item.get("body", "")
                url = item.get("href", item.get("url", ""))

                if not title:
                    continue

                # Dedup check
                if not await _is_new(title, url):
                    continue

                # Determine category
                cat = "news_finance"
                if any(k in query for k in ["부동산", "아파트", "전세"]):
                    cat = "news_realestate"
                elif any(k in query for k in ["주식", "stock"]):
                    cat = "news_stock"

                await _save_item(cat, title, body, "duckduckgo", url)
                new_count += 1

        except Exception as e:
            print(f"[Collector] News search error ({query}): {e}")

    if new_count > 0:
        await ws_manager.broadcast({
            "type": "collector_update",
            "data": {"category": "news", "new_items": new_count},
        })

    return new_count


async def collect_realestate_trends():
    """Collect real estate market trends for Seoul."""
    queries = [
        "서울 강남 아파트 매매 실거래가 최신",
        "서울 전세 시세 변동 2026",
        "서울 월세 시세 동향",
        "서울 아파트 급매 급등 지역",
        "부동산 투자 유망 지역 2026",
    ]
    return await collect_news(queries)


async def get_daily_summary() -> dict:
    """Get summary of today's collected data."""
    today = datetime.now().strftime("%Y-%m-%d")

    stock_count = await fetch_one(
        "SELECT COUNT(*) as cnt FROM market_data WHERE date(recorded_at) = ?", (today,)
    )
    news_count = await fetch_one(
        "SELECT COUNT(*) as cnt FROM collected_items WHERE date(created_at) = ? AND category LIKE 'news_%'", (today,)
    )
    alert_count = await fetch_one(
        "SELECT COUNT(*) as cnt FROM collected_items WHERE date(created_at) = ? AND category = 'stock_alert'", (today,)
    )

    return {
        "date": today,
        "stock_snapshots": stock_count["cnt"] if stock_count else 0,
        "news_collected": news_count["cnt"] if news_count else 0,
        "alerts": alert_count["cnt"] if alert_count else 0,
    }


async def get_recent_alerts(limit: int = 20) -> list[dict]:
    """Get recent alerts/opportunities."""
    return await fetch_all(
        "SELECT * FROM collected_items WHERE category = 'stock_alert' ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )


async def get_recent_news(category: str = None, limit: int = 30) -> list[dict]:
    """Get recent collected news."""
    if category:
        return await fetch_all(
            "SELECT * FROM collected_items WHERE category = ? ORDER BY created_at DESC LIMIT ?",
            (category, limit),
        )
    return await fetch_all(
        "SELECT * FROM collected_items WHERE category LIKE 'news_%' ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )


class Collector:
    """Background collector that runs multiple collection jobs at different intervals."""

    def __init__(self):
        self._running = False
        self._stats = {"stock_runs": 0, "news_runs": 0, "realestate_runs": 0, "started_at": None}

    async def start(self):
        """Start all collection loops."""
        self._running = True
        self._stats["started_at"] = datetime.now().isoformat()

        await _load_seen()

        print("[Collector] Starting background collection...")
        print("[Collector]   Stock prices: every 5 minutes")
        print("[Collector]   Financial news: every 30 minutes")
        print("[Collector]   Real estate: every 60 minutes")

        await asyncio.gather(
            self._stock_loop(),
            self._news_loop(),
            self._realestate_loop(),
        )

    async def _stock_loop(self):
        """Collect stock prices every 5 minutes."""
        from services.agent_service import agent_manager
        await asyncio.sleep(10)
        while self._running:
            await agent_manager.update_status("stock", "working", "Scanning KR+US markets...")
            count = await collect_stock_prices()
            self._stats["stock_runs"] += 1
            await agent_manager.update_status("stock", "idle", "", f"Collected {count} prices (run #{self._stats['stock_runs']})")
            await asyncio.sleep(300)

    async def _news_loop(self):
        """Collect news every 30 minutes."""
        from services.agent_service import agent_manager
        await asyncio.sleep(30)
        while self._running:
            await agent_manager.update_status("stock", "working", "Searching financial news...")
            count = await collect_news()
            self._stats["news_runs"] += 1
            await agent_manager.update_status("stock", "idle", "", f"Found {count} new articles (run #{self._stats['news_runs']})")
            await asyncio.sleep(1800)

    async def _realestate_loop(self):
        """Collect real estate data every 60 minutes."""
        from services.agent_service import agent_manager
        await asyncio.sleep(60)
        while self._running:
            await agent_manager.update_status("realestate", "working", "Scanning Seoul apartment market...")
            count = await collect_realestate_trends()
            self._stats["realestate_runs"] += 1
            await agent_manager.update_status("realestate", "idle", "", f"Found {count} new items (run #{self._stats['realestate_runs']})")
            await asyncio.sleep(3600)

    def get_stats(self) -> dict:
        return {**self._stats, "running": self._running}

    def stop(self):
        self._running = False


collector = Collector()
