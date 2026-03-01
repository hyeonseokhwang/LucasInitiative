"""
Sentiment Analysis Service — LLM-powered news sentiment scoring per stock.

Uses qwen2.5:14b via Ollama to analyze collected news articles
and produce sentiment scores (positive/negative/neutral) per stock.
"""
import json
import httpx
from datetime import datetime, timedelta
from config import OLLAMA_BASE_URL, DEFAULT_MODEL
from services.db_service import execute, fetch_all
from services.vram_manager import vram_manager
from services.stock_service import DEFAULT_KR_STOCKS, DEFAULT_US_STOCKS


# Combine all tracked stocks
ALL_STOCKS = {**DEFAULT_KR_STOCKS, **DEFAULT_US_STOCKS}

# Keywords to match news to stocks
STOCK_KEYWORDS = {
    "005930.KS": ["삼성전자", "삼성", "samsung", "galaxy"],
    "000660.KS": ["SK하이닉스", "하이닉스", "hynix"],
    "035420.KS": ["NAVER", "네이버"],
    "035720.KS": ["카카오", "kakao"],
    "006400.KS": ["삼성SDI", "삼성sdi"],
    "051910.KS": ["LG화학", "lg화학", "lgchem"],
    "005380.KS": ["현대차", "현대자동차", "hyundai"],
    "068270.KS": ["셀트리온", "celltrion"],
    "105560.KS": ["KB금융", "kb금융", "국민은행"],
    "055550.KS": ["신한지주", "신한은행", "shinhan"],
    "AAPL": ["apple", "아이폰", "iphone", "애플"],
    "MSFT": ["microsoft", "마이크로소프트"],
    "GOOGL": ["google", "구글", "alphabet"],
    "AMZN": ["amazon", "아마존"],
    "NVDA": ["nvidia", "엔비디아"],
    "TSLA": ["tesla", "테슬라"],
    "META": ["meta", "페이스북", "instagram", "메타"],
}


async def _fetch_recent_news(hours: int = 24) -> list[dict]:
    """Fetch news articles from the last N hours."""
    cutoff = (datetime.now() - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")
    return await fetch_all(
        """SELECT id, category, title, content, source, created_at
           FROM collected_items
           WHERE category IN ('news_stock', 'news_finance', 'stock_alert')
             AND created_at > ?
           ORDER BY created_at DESC""",
        (cutoff,),
    )


def _match_news_to_stocks(news_items: list[dict]) -> dict[str, list[dict]]:
    """Group news articles by stock symbol based on keyword matching."""
    stock_news: dict[str, list[dict]] = {symbol: [] for symbol in ALL_STOCKS}
    general_news = []

    for item in news_items:
        text = f"{item['title']} {item.get('content', '')}".lower()
        matched = False
        for symbol, keywords in STOCK_KEYWORDS.items():
            if any(kw.lower() in text for kw in keywords):
                stock_news[symbol].append(item)
                matched = True
        if not matched:
            general_news.append(item)

    return stock_news, general_news


async def _analyze_sentiment_llm(symbol: str, name: str, news_items: list[dict]) -> dict:
    """Use LLM to analyze sentiment for a stock based on its news."""
    if not news_items:
        return None

    # Build news digest for the LLM
    news_text = ""
    for i, item in enumerate(news_items[:10], 1):  # Max 10 articles
        title = item["title"]
        content = (item.get("content") or "")[:300]
        news_text += f"{i}. [{item['category']}] {title}\n   {content}\n\n"

    prompt = f"""다음은 {name}({symbol}) 관련 최근 뉴스입니다. 감성 분석을 수행하세요.

{news_text}

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
  "score": <-1.0에서 1.0 사이의 감성 점수. 매우 부정=-1.0, 중립=0.0, 매우 긍정=1.0>,
  "label": "<positive/negative/neutral 중 하나>",
  "summary": "<한국어로 2-3문장 요약. 주요 뉴스 동향과 투자 시사점>"
}}"""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": DEFAULT_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 500},
                },
            )
            text = resp.json().get("response", "")

            # Parse JSON from response (handle markdown code blocks)
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text
                text = text.rsplit("```", 1)[0] if "```" in text else text
                text = text.strip()

            data = json.loads(text)
            return {
                "symbol": symbol,
                "name": name,
                "score": max(-1.0, min(1.0, float(data["score"]))),
                "label": data.get("label", "neutral"),
                "summary": data.get("summary", ""),
                "news_count": len(news_items),
            }
    except Exception as e:
        print(f"[Sentiment] Error analyzing {name}: {e}")
        return None


async def analyze_all_sentiment(hours: int = 24) -> list[dict]:
    """Run sentiment analysis on all tracked stocks.

    Returns list of sentiment scores and saves to DB.
    """
    print(f"[Sentiment] Starting sentiment analysis (last {hours}h news)...")

    # Ensure model is loaded
    await vram_manager.ensure_model(DEFAULT_MODEL)

    # Fetch and group news
    news_items = await _fetch_recent_news(hours)
    print(f"[Sentiment] Found {len(news_items)} news articles")

    if not news_items:
        print("[Sentiment] No news to analyze")
        return []

    stock_news, general_news = _match_news_to_stocks(news_items)

    results = []
    for symbol, name in ALL_STOCKS.items():
        items = stock_news.get(symbol, [])
        if not items:
            continue

        result = await _analyze_sentiment_llm(symbol, name, items)
        if result:
            results.append(result)
            # Save to DB
            await execute(
                """INSERT INTO sentiment_scores
                   (symbol, name, score, label, summary, news_count, model_used)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    result["symbol"],
                    result["name"],
                    result["score"],
                    result["label"],
                    result["summary"],
                    result["news_count"],
                    DEFAULT_MODEL,
                ),
            )
            print(f"[Sentiment] {name}: {result['label']} ({result['score']:+.2f})")

    # Also analyze general market sentiment if enough news
    if len(general_news) >= 3:
        general_result = await _analyze_general_sentiment(general_news)
        if general_result:
            results.append(general_result)
            await execute(
                """INSERT INTO sentiment_scores
                   (symbol, name, score, label, summary, news_count, model_used)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    "MARKET",
                    "시장 전체",
                    general_result["score"],
                    general_result["label"],
                    general_result["summary"],
                    general_result["news_count"],
                    DEFAULT_MODEL,
                ),
            )

    print(f"[Sentiment] Analysis complete: {len(results)} stocks scored")
    return results


async def _analyze_general_sentiment(news_items: list[dict]) -> dict:
    """Analyze overall market sentiment from unmatched news."""
    news_text = ""
    for i, item in enumerate(news_items[:15], 1):
        title = item["title"]
        content = (item.get("content") or "")[:200]
        news_text += f"{i}. {title}\n   {content}\n\n"

    prompt = f"""다음은 최근 일반 시장 뉴스입니다. 전체 시장 감성을 분석하세요.

{news_text}

아래 JSON 형식으로만 응답하세요:
{{
  "score": <-1.0에서 1.0 사이>,
  "label": "<positive/negative/neutral>",
  "summary": "<한국어 2-3문장. 전체 시장 동향과 분위기>"
}}"""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": DEFAULT_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 500},
                },
            )
            text = resp.json().get("response", "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text
                text = text.rsplit("```", 1)[0] if "```" in text else text
                text = text.strip()

            data = json.loads(text)
            return {
                "symbol": "MARKET",
                "name": "시장 전체",
                "score": max(-1.0, min(1.0, float(data["score"]))),
                "label": data.get("label", "neutral"),
                "summary": data.get("summary", ""),
                "news_count": len(news_items),
            }
    except Exception as e:
        print(f"[Sentiment] Error analyzing general market: {e}")
        return None


async def get_latest_sentiment(limit: int = 20) -> list[dict]:
    """Get most recent sentiment scores (latest per stock)."""
    return await fetch_all(
        """SELECT s1.*
           FROM sentiment_scores s1
           INNER JOIN (
               SELECT symbol, MAX(analyzed_at) as max_date
               FROM sentiment_scores
               GROUP BY symbol
           ) s2 ON s1.symbol = s2.symbol AND s1.analyzed_at = s2.max_date
           ORDER BY ABS(s1.score) DESC
           LIMIT ?""",
        (limit,),
    )


async def get_sentiment_history(symbol: str, days: int = 7) -> list[dict]:
    """Get sentiment history for a specific stock."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    return await fetch_all(
        """SELECT * FROM sentiment_scores
           WHERE symbol = ? AND analyzed_at > ?
           ORDER BY analyzed_at DESC""",
        (symbol, cutoff),
    )
