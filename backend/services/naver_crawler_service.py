"""
Naver News & Real Estate Crawler - Basic Structure
Works without API keys using RSS feeds and public pages.
"""
import re
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime
from html import unescape
import httpx
from services.db_service import execute, fetch_one


_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

# ─── RSS Feed URLs (No API key needed) ───

NAVER_NEWS_RSS = {
    "economy": "https://news.google.com/rss/search?q=%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko",
    "stock": "https://news.google.com/rss/search?q=%EC%A3%BC%EC%8B%9D+%EC%8B%9C%EC%9E%A5&hl=ko&gl=KR&ceid=KR:ko",
    "realestate": "https://news.google.com/rss/search?q=%EB%B6%80%EB%8F%99%EC%82%B0+%EC%8B%9C%EC%84%B8&hl=ko&gl=KR&ceid=KR:ko",
    "finance": "https://news.google.com/rss/search?q=%EA%B8%88%EC%9C%B5+%EC%8B%9C%EC%9E%A5&hl=ko&gl=KR&ceid=KR:ko",
}

# Clean HTML tags from RSS content
_TAG_RE = re.compile(r'<[^>]+>')


def _clean_html(text: str) -> str:
    """Remove HTML tags and unescape entities."""
    return unescape(_TAG_RE.sub('', text or '')).strip()


def _content_hash(title: str, source: str) -> str:
    """Generate dedup hash."""
    return hashlib.md5(f"{title}:{source}".encode()).hexdigest()


async def fetch_rss_news(category: str = "economy", max_items: int = 20) -> list[dict]:
    """Fetch news from Google News RSS (Korean results, no API key needed)."""
    url = NAVER_NEWS_RSS.get(category, NAVER_NEWS_RSS["economy"])

    try:
        async with httpx.AsyncClient(timeout=15, headers=_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as e:
        print(f"[NaverCrawler] RSS fetch error ({category}): {e}")
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        print(f"[NaverCrawler] RSS parse error: {e}")
        return []

    items = []
    for item in root.findall('.//item')[:max_items]:
        title = _clean_html(item.findtext('title', ''))
        link = item.findtext('link', '')
        pub_date = item.findtext('pubDate', '')
        description = _clean_html(item.findtext('description', ''))
        source = item.findtext('source', '') or 'Google News'

        if not title:
            continue

        items.append({
            "title": title,
            "url": link,
            "description": description[:500],
            "source": source,
            "pub_date": pub_date,
            "category": f"news_{category}",
            "content_hash": _content_hash(title, source),
        })

    return items


async def crawl_and_store_news(category: str = "economy", max_items: int = 20) -> int:
    """Fetch news and store new items (deduplicated)."""
    items = await fetch_rss_news(category, max_items)
    new_count = 0

    for item in items:
        # Check dedup
        existing = await fetch_one(
            "SELECT id FROM collected_items WHERE content_hash = ?",
            (item["content_hash"],),
        )
        if existing:
            continue

        await execute(
            """INSERT INTO collected_items (category, title, content, source, url, content_hash, extra)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                item["category"],
                item["title"],
                item["description"],
                item["source"],
                item["url"],
                item["content_hash"],
                '{}',
            ),
        )
        new_count += 1

    return new_count


async def crawl_all_news_categories() -> dict:
    """Crawl all configured news categories."""
    results = {}
    for category in NAVER_NEWS_RSS:
        count = await crawl_and_store_news(category, max_items=15)
        results[category] = count
        print(f"[NaverCrawler] {category}: {count} new items")
    return results


async def search_naver_news(query: str, max_results: int = 10) -> list[dict]:
    """Search for news using Google News RSS with a specific query.
    No API key needed - uses RSS search endpoint."""
    import urllib.parse
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=ko&gl=KR&ceid=KR:ko"

    try:
        async with httpx.AsyncClient(timeout=15, headers=_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as e:
        print(f"[NaverCrawler] Search error: {e}")
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        return []

    items = []
    for item in root.findall('.//item')[:max_results]:
        title = _clean_html(item.findtext('title', ''))
        link = item.findtext('link', '')
        description = _clean_html(item.findtext('description', ''))
        source = item.findtext('source', '') or 'Google News'
        pub_date = item.findtext('pubDate', '')

        if title:
            items.append({
                "title": title,
                "url": link,
                "description": description[:500],
                "source": source,
                "pub_date": pub_date,
            })

    return items


# ─── Public Real Estate Data (공공데이터) ───

async def fetch_public_realestate_summary() -> dict:
    """Fetch basic real estate trends from recent collected data.
    Uses existing collected_items and realestate_data tables."""

    # Recent real estate news
    news = await fetch_one(
        """SELECT COUNT(*) AS cnt FROM collected_items
           WHERE category = 'news_realestate'
             AND created_at > datetime('now', '-24 hours')"""
    )

    # Recent transactions
    deals = await fetch_one(
        """SELECT COUNT(*) AS cnt,
                  AVG(price) AS avg_price,
                  MIN(price) AS min_price,
                  MAX(price) AS max_price
           FROM realestate_data
           WHERE recorded_at > datetime('now', '-7 days')
             AND deal_type = 'sale'"""
    )

    # District breakdown
    districts = []
    try:
        district_rows = await fetch_one(
            """SELECT COUNT(DISTINCT district) AS cnt FROM realestate_data
               WHERE recorded_at > datetime('now', '-7 days')"""
        )
        districts_count = district_rows["cnt"] if district_rows else 0
    except Exception:
        districts_count = 0

    return {
        "recent_news_24h": news["cnt"] if news else 0,
        "deals_7d": {
            "count": deals["cnt"] if deals else 0,
            "avg_price": round(deals["avg_price"] or 0, 0) if deals else 0,
            "min_price": deals["min_price"] if deals else 0,
            "max_price": deals["max_price"] if deals else 0,
        },
        "districts_tracked": districts_count,
        "last_updated": datetime.now().isoformat(),
    }


async def get_crawler_status() -> dict:
    """Get status of all crawler data sources."""
    # Count items per category
    categories = await fetch_one(
        """SELECT
              SUM(CASE WHEN category LIKE 'news_%' THEN 1 ELSE 0 END) AS news_total,
              SUM(CASE WHEN category = 'stock_alert' THEN 1 ELSE 0 END) AS stock_alerts,
              SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS last_24h,
              COUNT(*) AS total
           FROM collected_items"""
    )

    return {
        "sources": {
            "google_news_rss": {"status": "available", "categories": list(NAVER_NEWS_RSS.keys())},
            "naver_api": {"status": "needs_api_key", "note": "Set NAVER_CLIENT_ID and NAVER_CLIENT_SECRET env vars"},
        },
        "collected_items": {
            "total": categories["total"] if categories else 0,
            "news": categories["news_total"] if categories else 0,
            "stock_alerts": categories["stock_alerts"] if categories else 0,
            "last_24h": categories["last_24h"] if categories else 0,
        },
    }
