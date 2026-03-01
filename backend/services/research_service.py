"""
Autonomous Deep Research Engine — multi-angle evidence gathering, cross-validation, Ollama analysis.
Runs 2 async loops: periodic trend research + alert-triggered instant research.
Weekend: cycle 8h, alerts batched. Weekday: cycle 2h, alerts instant.
Smart escalation: Local Ollama first, Claude API for high-priority (within budget).
"""
import asyncio
import json
import os
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from services.db_service import execute, fetch_all, fetch_one
from services.crawl_service import search_web, search_multilingual
from ws.handler import manager as ws_manager

load_dotenv()

# Claude API pricing (per 1M tokens, USD)
_CLAUDE_PRICING = {
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.00},
    "claude-sonnet-4-6":        {"input": 3.00, "output": 15.00},
}
_BUDGET_KRW = int(os.getenv("API_MONTHLY_BUDGET_KRW", "200000"))
_USD_TO_KRW = 1450  # approximate, updated periodically

# Research queue
_research_queue: asyncio.Queue = asyncio.Queue()

# Direction keywords for cross-validation
_BULLISH = {"상승", "급등", "오름", "호재", "강세", "반등", "surge", "rise", "rally", "bullish", "gain", "up"}
_BEARISH = {"하락", "급락", "내림", "악재", "약세", "폭락", "drop", "fall", "decline", "bearish", "loss", "down"}


def _is_weekend() -> bool:
    return datetime.now().weekday() >= 5  # 5=Sat, 6=Sun


def _jaccard(text1: str, text2: str) -> float:
    w1 = set(text1.lower().split())
    w2 = set(text2.lower().split())
    if not w1 or not w2:
        return 0.0
    return len(w1 & w2) / len(w1 | w2)


def _detect_direction(text: str) -> str:
    t = text.lower()
    bull = sum(1 for k in _BULLISH if k in t)
    bear = sum(1 for k in _BEARISH if k in t)
    if bull > bear:
        return "bullish"
    elif bear > bull:
        return "bearish"
    return "neutral"


# Category keywords for auto-detection
_STOCK_KEYWORDS = {"주식", "종목", "kospi", "kosdaq", "시장", "매수", "매도", "주가", "상장", "배당",
                   "실적", "공시", "ETF", "etf", "반도체", "stock", "market", "s&p", "nasdaq", "nyse",
                   "dow", "코스피", "코스닥", "강세", "약세", "급등", "급락", "거래량", "시가총액"}
_REALESTATE_KEYWORDS = {"부동산", "아파트", "매매", "전세", "월세", "분양", "재건축", "재개발", "토지",
                        "주택", "오피스텔", "상가", "임대", "청약", "입주", "건설", "housing", "apartment",
                        "real estate", "property", "mortgage", "건축", "용적률"}


def _detect_category(text: str) -> str:
    """Auto-detect research category from title/query."""
    t = text.lower()
    stock_score = sum(1 for k in _STOCK_KEYWORDS if k in t)
    re_score = sum(1 for k in _REALESTATE_KEYWORDS if k in t)
    if re_score > stock_score and re_score >= 1:
        return "realestate"
    if stock_score >= 1:
        return "stock"
    return "general"


async def _is_duplicate_topic(title: str, query: str) -> bool:
    """Check if a similar topic was already researched recently (within 6h)."""
    recent = await fetch_all(
        """SELECT title, query FROM research_topics
           WHERE created_at > datetime('now', '-6 hours')
             AND status IN ('researching', 'validating', 'completed')""",
    )
    for r in recent:
        # Same query or very similar title
        if r["query"] == query:
            return True
        if _jaccard(r["title"], title) > 0.5:
            return True
    return False


async def queue_alert(title: str, query: str, source_data: dict = None):
    """Called by collector when ±3% alert detected. Queues for research."""
    # Skip duplicate
    if await _is_duplicate_topic(title, query):
        return
    await _research_queue.put({
        "title": title,
        "query": query,
        "priority": 1,
        "trigger_type": "alert",
        "source_data": json.dumps(source_data or {}, ensure_ascii=False),
    })


async def queue_manual(query: str):
    """Called by API for manual research trigger."""
    await _research_queue.put({
        "title": query,
        "query": query,
        "priority": 3,
        "trigger_type": "manual",
        "source_data": "{}",
    })


async def _drain_alert_queue() -> list[dict]:
    """Drain all pending alerts from queue into a list (non-blocking)."""
    items = []
    while not _research_queue.empty():
        try:
            items.append(_research_queue.get_nowait())
        except asyncio.QueueEmpty:
            break
    return items


async def _build_market_overview_topic() -> dict:
    """Build a comprehensive market overview topic from all recent data."""
    # Collect all significant movers
    movers = await fetch_all(
        """SELECT symbol, name, change_pct, price, market FROM market_data
           WHERE recorded_at > datetime('now', '-12 hours')
             AND abs(change_pct) >= 1.0
           ORDER BY abs(change_pct) DESC"""
    )

    # Deduplicate by symbol (keep latest)
    seen_symbols = set()
    unique_movers = []
    for m in movers:
        if m["symbol"] not in seen_symbols:
            seen_symbols.add(m["symbol"])
            unique_movers.append(m)

    # Separate KR vs US
    kr_movers = [m for m in unique_movers if m.get("market") in ("KOSPI", "KOSDAQ", "KR", "")]
    us_movers = [m for m in unique_movers if m.get("market") in ("NYSE", "NASDAQ", "US")]

    # Build summary text
    parts = []
    if kr_movers:
        kr_lines = [f"{m['name'] or m['symbol']}({m['change_pct']:+.1f}%)" for m in kr_movers[:10]]
        parts.append(f"국내: {', '.join(kr_lines)}")
    if us_movers:
        us_lines = [f"{m['name'] or m['symbol']}({m['change_pct']:+.1f}%)" for m in us_movers[:10]]
        parts.append(f"미국: {', '.join(us_lines)}")

    # Recent news count
    news_count = await fetch_one(
        "SELECT COUNT(*) as cnt FROM collected_items WHERE category LIKE 'news_%' AND created_at > datetime('now', '-12 hours')"
    )

    return {
        "title": f"시장 종합 분석 ({datetime.now().strftime('%m/%d')})",
        "query": "한국 미국 주식 시장 종합 동향 분석 전망",
        "priority": 3,
        "trigger_type": "auto",
        "source_data": json.dumps({
            "kr_movers": [dict(m) for m in kr_movers[:10]],
            "us_movers": [dict(m) for m in us_movers[:10]],
            "news_count": news_count["cnt"] if news_count else 0,
            "summary": " | ".join(parts),
        }, ensure_ascii=False),
    }


async def _gather_evidence(topic_id: int, query: str, source_data: str = "{}") -> list[dict]:
    """Stage 2: Multi-source + multilingual evidence gathering with quality filter."""
    evidence = []
    _seen_claims: set[str] = set()

    def _claim_key(text: str) -> str:
        return re.sub(r'\s+', ' ', text.lower().strip())[:100]

    # Multi-angle Korean queries
    search_queries = [
        query,
        f"{query} 원인 분석",
        f"{query} 전문가 의견 전망",
    ]

    # Collect from multi-source (DuckDuckGo + Naver + Google)
    for sq in search_queries:
        try:
            results = await search_web(sq, max_results=5)
            for r in results:
                title = r.get("title", "")
                body = r.get("body", "")
                url = r.get("url", r.get("href", ""))
                engine = r.get("source_engine", "unknown")
                if not title:
                    continue

                claim = f"{title}: {body}"[:500] if body else title[:500]
                key = _claim_key(claim)
                if key in _seen_claims:
                    continue
                _seen_claims.add(key)

                eid = await execute(
                    """INSERT INTO research_evidence
                       (topic_id, claim, source, source_type, confidence, raw_data)
                       VALUES (?, ?, ?, ?, 0.5, ?)""",
                    (topic_id, claim, url or engine, f"web_{engine}", body[:1000] if body else ""),
                )
                evidence.append({
                    "id": eid, "claim": claim, "source": url or engine,
                    "source_type": f"web_{engine}", "confidence": 0.5,
                    "direction": _detect_direction(claim),
                })
        except Exception as e:
            print(f"[Research] Search error ({sq}): {e}")

    # Multilingual search (English + Japanese via Ollama translation)
    try:
        ml_results = await search_multilingual(query, max_per_lang=3)
        for r in ml_results:
            title = r.get("title", "")
            body = r.get("body", "")
            url = r.get("url", "")
            if not title:
                continue
            claim = f"[Global] {title}: {body}"[:500] if body else f"[Global] {title}"[:500]
            key = _claim_key(claim)
            if key in _seen_claims:
                continue
            _seen_claims.add(key)

            eid = await execute(
                """INSERT INTO research_evidence
                   (topic_id, claim, source, source_type, confidence, raw_data)
                   VALUES (?, ?, ?, 'web_global', 0.5, ?)""",
                (topic_id, claim, url or "global", body[:1000] if body else ""),
            )
            evidence.append({
                "id": eid, "claim": claim, "source": url or "global",
                "source_type": "web_global", "confidence": 0.5,
                "direction": _detect_direction(claim),
            })
    except Exception as e:
        print(f"[Research] Multilingual search error: {e}")

    # Internal DB: recent market data (deduplicated by symbol)
    recent_market = await fetch_all(
        """SELECT symbol, name, change_pct, price FROM market_data
           WHERE recorded_at > datetime('now', '-12 hours')
           GROUP BY symbol
           ORDER BY recorded_at DESC LIMIT 20"""
    )
    for m in recent_market:
        claim = f"[Market Data] {m['name'] or m['symbol']}: {m['change_pct']:+.1f}% (price: {m['price']:,.0f})"
        key = _claim_key(claim)
        if key in _seen_claims:
            continue
        _seen_claims.add(key)

        eid = await execute(
            """INSERT INTO research_evidence
               (topic_id, claim, source, source_type, confidence, raw_data)
               VALUES (?, ?, 'internal_db', 'db_market', 0.7, ?)""",
            (topic_id, claim, json.dumps(dict(m), ensure_ascii=False)),
        )
        evidence.append({
            "id": eid, "claim": claim, "source": "internal_db",
            "source_type": "db_market", "confidence": 0.7,
            "direction": _detect_direction(claim),
        })

    # Internal DB: recent alerts (max 3, deduplicated)
    recent_alerts = await fetch_all(
        """SELECT title, content FROM collected_items
           WHERE category = 'stock_alert'
             AND created_at > datetime('now', '-12 hours')
           ORDER BY created_at DESC LIMIT 3"""
    )
    for a in recent_alerts:
        claim = f"[Alert] {a['title']}: {(a['content'] or '')[:200]}"
        key = _claim_key(claim)
        if key in _seen_claims:
            continue
        _seen_claims.add(key)

        eid = await execute(
            """INSERT INTO research_evidence
               (topic_id, claim, source, source_type, confidence, raw_data)
               VALUES (?, ?, 'internal_alert', 'db_alert', 0.8, ?)""",
            (topic_id, claim, a.get("content", "")),
        )
        evidence.append({
            "id": eid, "claim": claim, "source": "internal_alert",
            "source_type": "db_alert", "confidence": 0.8,
            "direction": _detect_direction(claim),
        })

    return evidence


async def _cross_validate(topic_id: int, evidence: list[dict]) -> dict:
    """Stage 3: Cross-validation using Jaccard similarity + direction detection."""
    agree_count = 0
    contradict_count = 0

    for i, e1 in enumerate(evidence):
        agrees = []
        contradicts = []
        for j, e2 in enumerate(evidence):
            if i == j:
                continue
            sim = _jaccard(e1["claim"], e2["claim"])
            if sim > 0.3:
                d1 = e1.get("direction", "neutral")
                d2 = e2.get("direction", "neutral")
                if d1 != "neutral" and d2 != "neutral":
                    if d1 == d2:
                        agrees.append(e2["id"])
                        e1["confidence"] = min(e1["confidence"] + 0.1, 0.95)
                    else:
                        contradicts.append(e2["id"])
                        e1["confidence"] = max(e1["confidence"] - 0.15, 0.1)
                elif sim > 0.4:
                    agrees.append(e2["id"])
                    e1["confidence"] = min(e1["confidence"] + 0.05, 0.9)

        verified = 1 if len(agrees) >= 2 else 0
        if verified:
            e1["confidence"] = min(e1["confidence"], 0.95)
            agree_count += 1
        if contradicts:
            contradict_count += 1

        await execute(
            """UPDATE research_evidence
               SET confidence = ?, agrees_with = ?, contradicts = ?, verified = ?
               WHERE id = ?""",
            (e1["confidence"], json.dumps(agrees), json.dumps(contradicts), verified, e1["id"]),
        )

        source_name = e1["source"][:100]
        existing = await fetch_one(
            "SELECT * FROM source_reliability WHERE source_name = ?", (source_name,)
        )
        if existing:
            new_total = existing["total_claims"] + 1
            new_verified = existing["verified_claims"] + (1 if verified else 0)
            await execute(
                """UPDATE source_reliability
                   SET total_claims = ?, verified_claims = ?, reliability = ?, last_updated = datetime('now')
                   WHERE source_name = ?""",
                (new_total, new_verified, new_verified / new_total if new_total > 0 else 0.5, source_name),
            )
        else:
            await execute(
                """INSERT INTO source_reliability (source_name, total_claims, verified_claims, reliability)
                   VALUES (?, 1, ?, ?)""",
                (source_name, 1 if verified else 0, 1.0 if verified else 0.5),
            )

    total = len(evidence)
    return {
        "agreement_rate": agree_count / total if total > 0 else 0,
        "contradictions": contradict_count,
        "avg_confidence": sum(e["confidence"] for e in evidence) / total if total > 0 else 0,
    }


async def _check_api_budget() -> dict:
    """Check current month's API spend vs budget."""
    now = datetime.now()
    month_start = now.strftime("%Y-%m-01")
    row = await fetch_one(
        "SELECT COALESCE(SUM(cost_usd), 0) as total_usd FROM api_usage WHERE created_at >= ?",
        (month_start,),
    )
    spent_usd = row["total_usd"] if row else 0.0
    spent_krw = spent_usd * _USD_TO_KRW
    remaining_krw = _BUDGET_KRW - spent_krw
    return {
        "spent_usd": spent_usd,
        "spent_krw": spent_krw,
        "remaining_krw": remaining_krw,
        "budget_krw": _BUDGET_KRW,
        "within_budget": remaining_krw > 5000,  # 5000 KRW safety margin
    }


async def _log_api_usage(model: str, input_tokens: int, output_tokens: int, purpose: str = "research"):
    """Log Claude API usage to api_usage table."""
    pricing = _CLAUDE_PRICING.get(model, {"input": 3.0, "output": 15.0})
    cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
    await execute(
        """INSERT INTO api_usage (provider, model, input_tokens, output_tokens, cost_usd, purpose)
           VALUES ('anthropic', ?, ?, ?, ?, ?)""",
        (model, input_tokens, output_tokens, cost, purpose),
    )
    return cost


async def _filter_evidence_quality(evidence: list[dict]) -> list[dict]:
    """Use local Ollama to quickly filter noise from evidence. Keep only relevant items."""
    if len(evidence) <= 5:
        return evidence  # too few to filter

    from services.ollama_service import chat_stream

    # Build compact list for scoring
    items = []
    for i, e in enumerate(evidence):
        items.append(f"{i}: {e['claim'][:150]}")
    items_text = "\n".join(items)

    prompt = f"""아래 {len(evidence)}개의 금융 뉴스/데이터를 평가하세요.
각 항목의 번호만 출력하세요: 투자 판단에 유용한 항목만 선택.
광고, 중복, 관련 없는 항목은 제외.
번호만 쉼표로 구분해서 출력. 예: 0,2,5,7

{items_text}

유용한 항목 번호:"""

    result = ""
    try:
        async for chunk in chat_stream(
            "gemma2:2b",  # fastest model for filtering
            [{"role": "user", "content": prompt}]
        ):
            if chunk.get("message", {}).get("content"):
                result += chunk["message"]["content"]
            if chunk.get("done"):
                break

        # Parse indices
        indices = set()
        for part in re.split(r'[,\s]+', result.strip()):
            part = part.strip()
            if part.isdigit():
                idx = int(part)
                if 0 <= idx < len(evidence):
                    indices.add(idx)

        if len(indices) >= 3:
            filtered = [evidence[i] for i in sorted(indices)]
            print(f"[Research] Quality filter: {len(evidence)} → {len(filtered)} items")
            return filtered
    except Exception as e:
        print(f"[Research] Quality filter error: {e}")

    return evidence  # fallback: return all


async def _claude_analysis(topic_title: str, prompt: str, priority: int) -> tuple[str, str]:
    """Use Claude API for high-priority analysis. Returns (response, model_used)."""
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "", ""

    # Choose model based on priority
    if priority <= 1:
        model = "claude-sonnet-4-6"  # best quality for urgent alerts
    else:
        model = "claude-haiku-4-5-20251001"  # cost-effective for regular analysis

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text if response.content else ""
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        await _log_api_usage(model, input_tokens, output_tokens, "research")
        print(f"[Research] Claude API used: {model} ({input_tokens}+{output_tokens} tokens)")
        return text, model
    except Exception as e:
        print(f"[Research] Claude API error: {e}")
        return "", ""


async def _deep_analysis(topic_title: str, evidence: list[dict], source_data: str = "{}", priority: int = 5) -> tuple[str, str]:
    """Stage 4: Smart analysis — Ollama first, Claude API for high-priority when within budget.
    Returns (analysis_text, model_used)."""
    from services.ollama_service import chat_stream
    from config import DEFAULT_MODEL

    # Parse source_data for extra context
    try:
        ctx = json.loads(source_data) if source_data else {}
    except Exception:
        ctx = {}

    # Build market data section
    market_section = ""
    if ctx.get("kr_movers"):
        kr_lines = [f"  - {m.get('name', m.get('symbol', '?'))}: {m.get('change_pct', 0):+.1f}% (가격: {m.get('price', 0):,.0f})" for m in ctx["kr_movers"]]
        market_section += "국내 주요 변동:\n" + "\n".join(kr_lines) + "\n\n"
    if ctx.get("us_movers"):
        us_lines = [f"  - {m.get('name', m.get('symbol', '?'))}: {m.get('change_pct', 0):+.1f}% (가격: ${m.get('price', 0):,.2f})" for m in ctx["us_movers"]]
        market_section += "미국 주요 변동:\n" + "\n".join(us_lines) + "\n\n"

    # Build evidence summary (deduped, top 15)
    evidence_text = ""
    for i, e in enumerate(evidence[:15], 1):
        conf = e.get("confidence", 0.5)
        verified = " [VERIFIED]" if e.get("verified") else ""
        evidence_text += f"{i}. [{conf:.0%}]{verified} {e['claim'][:300]}\n"

    prompt = f"""당신은 Lucas Initiative의 수석 금융 리서치 애널리스트입니다.
CEO인 Lucas에게 보고하는 심층 리서치 보고서를 작성하세요.

## 분석 주제
{topic_title}

## 시장 데이터
{market_section if market_section else "(별도 시장 데이터 없음)"}

## 수집된 증거 ({len(evidence)}건)
{evidence_text}

## 보고서 작성 지침

다음 구조로 **한국어**로 작성하세요. 숫자와 구체적 사실에 기반해 작성합니다.

### 1. 핵심 요약 (Executive Summary)
- 3~4문장으로 현재 시장 상황을 요약
- "그래서 뭐가 중요한데?"에 답하는 수준

### 2. 시장 흐름 (Market Flow)
- 국내 시장과 미국 시장의 방향성
- 어떤 섹터/종목이 주도하고 있는지
- 자금이 어디로 흘러가고 있는지 (반도체→방산, 성장주→가치주 등)

### 3. 유효한 움직임 vs 노이즈
- 실제로 의미 있는 변동은 무엇인지 (근거 포함)
- 단순 노이즈나 일시적 변동은 무엇인지
- 왜 유효한지 / 왜 노이즈인지 근거 제시

### 4. 원인 분석 (Why)
- 오늘의 주요 변동이 발생한 이유
- 매크로 요인 (금리, 환율, 정책, 지정학)
- 섹터/종목 특수 요인

### 5. 컨센서스 vs 이견
- 대부분의 소스가 동의하는 방향
- 반대 의견이나 모순되는 시그널

### 6. 리스크 & 주의사항
- 현재 가장 주의해야 할 리스크
- 향후 1~2주 주요 이벤트/변수

### 7. 투자 시사점 (Action Items)
- CEO가 지금 알아야 할 것
- 관심을 둘 종목/섹터
- 진입/관망/회피 판단 근거

### 8. 신뢰도 평가
- HIGH / MEDIUM / LOW (근거 포함)
- 정보가 부족하거나 모순되면 솔직하게 기술

중요: 뻔한 말("시장은 변동성이 있습니다") 금지. 구체적 숫자, 종목명, 이유를 제시하세요."""

    # Decision: use Claude API or local Ollama?
    use_claude = False
    model_used = DEFAULT_MODEL

    if priority <= 2:
        budget = await _check_api_budget()
        if budget["within_budget"]:
            use_claude = True
            print(f"[Research] High-priority ({priority}) + budget OK (remaining: {budget['remaining_krw']:,.0f}원) → Claude API")
        else:
            print(f"[Research] High-priority but budget exceeded ({budget['spent_krw']:,.0f}/{budget['budget_krw']:,.0f}원) → Ollama fallback")

    if use_claude:
        text, claude_model = await _claude_analysis(topic_title, prompt, priority)
        if text:
            return text, claude_model
        print("[Research] Claude API failed, falling back to Ollama")

    # Default: local Ollama analysis
    full_response = ""
    try:
        async for chunk in chat_stream(
            DEFAULT_MODEL,
            [{"role": "user", "content": prompt}]
        ):
            if chunk.get("message", {}).get("content"):
                full_response += chunk["message"]["content"]
            if chunk.get("done"):
                break
    except Exception as e:
        full_response = f"Ollama 분석 실패: {e}\n\n기본 데이터:\n{evidence_text}"

    return full_response, DEFAULT_MODEL


async def _run_research(topic_data: dict) -> dict | None:
    """Execute full 5-stage research pipeline for one topic."""
    import time as _time
    from services.agent_service import agent_manager

    _pipeline_start = _time.time()
    title = topic_data["title"]
    query = topic_data["query"]
    priority = topic_data.get("priority", 5)
    trigger_type = topic_data.get("trigger_type", "auto")
    source_data = topic_data.get("source_data", "{}")

    # Skip if duplicate
    if trigger_type != "manual" and await _is_duplicate_topic(title, query):
        print(f"[Research] Skipping duplicate: {title}")
        return None

    try:
        category = topic_data.get("category") or _detect_category(f"{title} {query}")
        topic_id = await execute(
            """INSERT INTO research_topics (title, query, priority, status, trigger_type, category, source_data)
               VALUES (?, ?, ?, 'researching', ?, ?, ?)""",
            (title, query, priority, trigger_type, category, source_data),
        )

        await agent_manager.update_status("research", "working", f"Researching: {title}")
        await ws_manager.broadcast({
            "type": "research_update",
            "data": {"topic_id": topic_id, "title": title, "stage": "gathering", "status": "researching"},
        })

        # Stage 2: Gather evidence (with dedup)
        evidence = await _gather_evidence(topic_id, query, source_data)
        if not evidence:
            await execute(
                "UPDATE research_topics SET status = 'failed', completed_at = datetime('now') WHERE id = ?",
                (topic_id,),
            )
            await agent_manager.update_status("research", "idle", "", f"No evidence found for: {title}")
            return None

        # Stage 2.5: Quality filter (remove noise before validation)
        evidence = await _filter_evidence_quality(evidence)

        # Stage 3: Cross-validate
        await ws_manager.broadcast({
            "type": "research_update",
            "data": {"topic_id": topic_id, "title": title, "stage": "validating", "status": "validating"},
        })
        await execute("UPDATE research_topics SET status = 'validating' WHERE id = ?", (topic_id,))
        validation = await _cross_validate(topic_id, evidence)

        # Stage 4: Deep analysis (smart: Ollama default, Claude for high-priority)
        await ws_manager.broadcast({
            "type": "research_update",
            "data": {"topic_id": topic_id, "title": title, "stage": "analyzing", "status": "analyzing"},
        })
        analysis, model_used = await _deep_analysis(title, evidence, source_data, priority)

        # Extract summary
        summary_lines = analysis.split("\n")
        summary = ""
        capture = False
        for line in summary_lines:
            if any(h in line for h in ["핵심 요약", "Executive Summary", "## Summary", "## 요약"]):
                capture = True
                continue
            if capture:
                if line.startswith("##") or line.startswith("### "):
                    break
                summary += line + " "
        summary = summary.strip() or analysis[:300]

        # Stage 5: Save report
        report_id = await execute(
            """INSERT INTO research_reports
               (topic_id, title, summary, full_analysis, confidence_avg,
                agreement_rate, contradictions, evidence_count, model_used)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (topic_id, title, summary, analysis, validation["avg_confidence"],
             validation["agreement_rate"], validation["contradictions"],
             len(evidence), model_used),
        )

        # Also save to daily_reports for ReportsPanel compatibility
        await execute(
            """INSERT INTO daily_reports (report_type, title, content, data_json)
               VALUES ('research', ?, ?, ?)""",
            (f"[Research] {title}", analysis,
             json.dumps({"topic_id": topic_id, "report_id": report_id,
                         "confidence": validation["avg_confidence"],
                         "evidence_count": len(evidence)}, ensure_ascii=False)),
        )

        await execute(
            "UPDATE research_topics SET status = 'completed', completed_at = datetime('now') WHERE id = ?",
            (topic_id,),
        )

        await agent_manager.update_status(
            "research", "idle", "",
            f"Completed: {title} (confidence: {validation['avg_confidence']:.0%})"
        )

        await ws_manager.broadcast({
            "type": "research_complete",
            "data": {
                "topic_id": topic_id,
                "report_id": report_id,
                "title": title,
                "summary": summary[:200],
                "confidence": validation["avg_confidence"],
                "evidence_count": len(evidence),
            },
        })

        # Save to notifications table
        try:
            from services.notification_service import notify_research_complete
            await notify_research_complete(topic_id, title, validation["avg_confidence"], len(evidence))
        except Exception as e:
            print(f"[Research] Notification error: {e}")

        # Calculate quality metrics
        try:
            from services.research_enhanced_service import calculate_quality_metrics
            await calculate_quality_metrics(report_id, topic_id)
        except Exception as e:
            print(f"[Research] Quality metrics error: {e}")

        # Check keyword alerts
        try:
            from services.research_enhanced_service import check_keyword_alerts
            await check_keyword_alerts(title, summary, report_id)
        except Exception as e:
            print(f"[Research] Keyword alert error: {e}")

        # Record pipeline success
        try:
            from services.research_analytics_service import record_pipeline_run
            record_pipeline_run(True, _time.time() - _pipeline_start, title)
        except Exception:
            pass

        return {
            "topic_id": topic_id,
            "report_id": report_id,
            "title": title,
            "confidence": validation["avg_confidence"],
            "evidence_count": len(evidence),
        }

    except Exception as e:
        print(f"[Research] Pipeline error for '{title}': {e}")
        await agent_manager.update_status("research", "idle", "", f"Error: {e}")
        # Record pipeline failure
        try:
            from services.research_analytics_service import record_pipeline_run
            record_pipeline_run(False, _time.time() - _pipeline_start, title, str(e))
        except Exception:
            pass
        return None


class ResearchEngine:
    """Autonomous research engine with weekend-aware scheduling."""

    def __init__(self):
        self._running = False
        self._stats = {
            "cycles": 0,
            "reports_generated": 0,
            "current_topic": None,
            "started_at": None,
            "last_cycle": None,
            "mode": "weekday",
        }
        self._weekday_interval = 7200   # 2 hours
        self._weekend_interval = 28800  # 8 hours

    def _get_interval(self) -> int:
        if _is_weekend():
            self._stats["mode"] = "weekend"
            return self._weekend_interval
        self._stats["mode"] = "weekday"
        return self._weekday_interval

    async def start(self):
        from config import RESEARCH_CYCLE_INTERVAL
        self._running = True
        self._stats["started_at"] = datetime.now().isoformat()
        self._weekday_interval = RESEARCH_CYCLE_INTERVAL

        mode = "weekend (8h)" if _is_weekend() else "weekday (2h)"
        print(f"[Research Engine] Starting autonomous research... mode={mode}")
        print("[Research Engine]   Alert listener: real-time (batched on weekends)")

        await asyncio.gather(
            self._main_loop(),
            self._alert_listener(),
        )

    async def _main_loop(self):
        """Periodic research — market overview instead of individual stock analysis."""
        await asyncio.sleep(120)
        while self._running:
            try:
                interval = self._get_interval()
                print(f"[Research Engine] Cycle start (mode={self._stats['mode']}, next in {interval//60}min)")

                # Build comprehensive market overview topic
                overview = await _build_market_overview_topic()
                self._stats["current_topic"] = overview["title"]
                result = await _run_research(overview)
                if result:
                    self._stats["reports_generated"] += 1
                    try:
                        from services.telegram_service import send_research_complete
                        await send_research_complete(result)
                    except Exception:
                        pass

                self._stats["cycles"] += 1
                self._stats["current_topic"] = None
                self._stats["last_cycle"] = datetime.now().isoformat()
            except Exception as e:
                print(f"[Research Engine] Main loop error: {e}")

            await asyncio.sleep(self._get_interval())

    async def _alert_listener(self):
        """Listen for alerts. On weekends: batch into single combined analysis."""
        while self._running:
            try:
                topic = await asyncio.wait_for(_research_queue.get(), timeout=60)

                if _is_weekend():
                    # Weekend: wait a bit and batch all queued alerts
                    await asyncio.sleep(10)
                    batch = [topic] + await _drain_alert_queue()
                    if len(batch) > 1:
                        # Merge into one combined topic
                        titles = [t["title"] for t in batch]
                        combined = {
                            "title": f"주말 알림 종합 분석 ({len(batch)}건)",
                            "query": "주식 시장 주요 변동 종합 분석",
                            "priority": 2,
                            "trigger_type": "alert",
                            "source_data": json.dumps({"alerts": titles}, ensure_ascii=False),
                        }
                        topic = combined
                    # Skip if duplicate
                    if await _is_duplicate_topic(topic["title"], topic["query"]):
                        continue

                self._stats["current_topic"] = topic["title"]
                result = await _run_research(topic)
                if result:
                    self._stats["reports_generated"] += 1
                    try:
                        from services.telegram_service import send_research_complete
                        await send_research_complete(result)
                    except Exception:
                        pass
                self._stats["current_topic"] = None
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"[Research Engine] Alert listener error: {e}")

    async def get_status(self) -> dict:
        budget = await _check_api_budget()
        interval = self._get_interval()  # also updates self._stats["mode"]
        return {
            **self._stats,
            "running": self._running,
            "queue_size": _research_queue.qsize(),
            "interval_minutes": interval // 60,
            "api_budget": budget,
        }

    def stop(self):
        self._running = False


research_engine = ResearchEngine()
