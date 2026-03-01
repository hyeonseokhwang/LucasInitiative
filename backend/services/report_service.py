"""
Report Service — generates daily comprehensive reports using LLM.

Combines: stock data, trading signals, sentiment analysis, real estate changes.
Saves to both DB and markdown file.
"""
import json
import os
import httpx
from datetime import datetime, timedelta
from pathlib import Path
from config import OLLAMA_BASE_URL, DEFAULT_MODEL
from services.stock_service import generate_stock_report
from services.realestate_service import generate_realestate_report
from services.db_service import execute, fetch_all
from services.vram_manager import vram_manager
from ws.handler import manager as ws_manager

# Report output directory
REPORTS_DIR = Path("G:/LucasDashboard/data/reports")


async def _get_signal_summary() -> str:
    """Get recent trading signals for the report."""
    cutoff = (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    signals = await fetch_all(
        """SELECT title, content, extra, created_at
           FROM collected_items
           WHERE category = 'stock_signal'
             AND created_at > ?
           ORDER BY created_at DESC
           LIMIT 30""",
        (cutoff,),
    )
    if not signals:
        return "최근 24시간 감지된 시그널 없음."

    lines = []
    for s in signals:
        lines.append(f"- {s['title']}")
        if s.get("content"):
            lines.append(f"  {s['content'][:100]}")
    return "\n".join(lines)


async def _get_sentiment_summary() -> str:
    """Get latest sentiment scores for the report."""
    rows = await fetch_all(
        """SELECT s1.symbol, s1.name, s1.score, s1.label, s1.summary, s1.news_count
           FROM sentiment_scores s1
           INNER JOIN (
               SELECT symbol, MAX(analyzed_at) as max_date
               FROM sentiment_scores
               GROUP BY symbol
           ) s2 ON s1.symbol = s2.symbol AND s1.analyzed_at = s2.max_date
           ORDER BY s1.score DESC""",
    )
    if not rows:
        return "감성 분석 데이터 없음."

    lines = []
    for r in rows:
        emoji = "🟢" if r["score"] > 0.2 else "🔴" if r["score"] < -0.2 else "⚪"
        lines.append(f"- {emoji} {r['name']}({r['symbol']}): {r['score']:+.2f} ({r['label']}) — {r.get('summary', '')[:80]}")
    return "\n".join(lines)


async def _get_realestate_changes() -> str:
    """Get real estate price changes summary."""
    cutoff = (datetime.now() - timedelta(hours=48)).strftime("%Y-%m-%d %H:%M:%S")
    rows = await fetch_all(
        """SELECT district, deal_type, COUNT(*) as cnt,
                  AVG(price) as avg_price,
                  MIN(price) as min_price,
                  MAX(price) as max_price
           FROM realestate_data
           WHERE recorded_at > ?
           GROUP BY district, deal_type
           ORDER BY cnt DESC
           LIMIT 20""",
        (cutoff,),
    )
    if not rows:
        return "최근 부동산 거래 데이터 없음."

    lines = []
    for r in rows:
        deal_label = {"sale": "매매", "jeonse": "전세", "monthly": "월세"}.get(r["deal_type"], r["deal_type"])
        avg = int(r["avg_price"]) if r["avg_price"] else 0
        lines.append(f"- {r['district']} {deal_label}: {r['cnt']}건, 평균 {avg:,}만원")
    return "\n".join(lines)


async def _get_notable_stocks() -> str:
    """Get stocks with notable price movements."""
    cutoff = (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    rows = await fetch_all(
        """SELECT symbol, name, price, change_pct, volume
           FROM market_data
           WHERE recorded_at > ?
           ORDER BY recorded_at DESC""",
        (cutoff,),
    )
    if not rows:
        return "최근 주가 데이터 없음."

    # Get latest per symbol, filter notable
    seen = {}
    for r in rows:
        if r["symbol"] not in seen:
            seen[r["symbol"]] = r

    notable = sorted(seen.values(), key=lambda x: abs(x.get("change_pct") or 0), reverse=True)[:10]
    lines = []
    for s in notable:
        pct = s.get("change_pct") or 0
        arrow = "↑" if pct > 0 else "↓" if pct < 0 else "→"
        lines.append(f"- {s['name']}({s['symbol']}): {s.get('price', 0):,.0f} ({arrow}{abs(pct):.1f}%)")
    return "\n".join(lines)


async def _generate_llm_report(
    stock_report: str,
    signal_summary: str,
    sentiment_summary: str,
    realestate_summary: str,
    notable_stocks: str,
) -> str:
    """Use LLM to generate a comprehensive Korean daily report."""
    today = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""당신은 Lucas AI의 금융 리서치 어시스턴트입니다. 아래 데이터를 종합하여 {today} 일일 리포트를 작성하세요.

## 주식 시장 데이터
{stock_report[:3000]}

## 주목할 종목 (변동폭 기준)
{notable_stocks}

## 트레이딩 시그널
{signal_summary}

## 감성 분석 (뉴스 기반)
{sentiment_summary}

## 부동산 동향
{realestate_summary}

---

아래 형식으로 한국어 일일 리포트를 작성하세요:

# Lucas 일일 금융 리포트 — {today}

## 1. 핵심 요약 (3-5줄)
오늘의 시장을 한눈에

## 2. 주식 시장 동향
- 주요 지수 변동
- 업종별 특징
- 주목할 종목과 이유

## 3. 트레이딩 시그널 분석
- 감지된 시그널 해석
- 주의가 필요한 종목

## 4. 뉴스 감성 분석 결과
- 긍정적/부정적 종목
- 시장 전반 분위기

## 5. 부동산 시장 동향
- 주요 지역 변동
- 주목할 포인트

## 6. 내일 주목 포인트
- 예상 이슈
- 관심 종목 & 전략

---
*이 리포트는 Lucas AI 금융분석 시스템이 자동 생성했습니다.*"""

    try:
        await vram_manager.ensure_model(DEFAULT_MODEL)

        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": DEFAULT_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.5, "num_predict": 3000},
                },
            )
            return resp.json().get("response", "LLM 리포트 생성 실패")
    except Exception as e:
        print(f"[Report] LLM report generation error: {e}")
        return f"LLM 리포트 생성 중 오류: {e}"


async def generate_daily_report() -> str:
    """Generate combined daily report with LLM analysis.

    Collects all data sources, generates LLM report, saves to DB and file.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"[Report] Generating daily report for {today}...")

    await ws_manager.broadcast({
        "type": "chat_token",
        "data": {"conversation_id": 0, "token": "[일일 리포트 생성 중...]\n", "done": False},
    })

    # 1. Collect stock data
    stock_report = ""
    try:
        stock_report = await generate_stock_report()
    except Exception as e:
        stock_report = f"주식 데이터 수집 오류: {e}"

    # 2. Collect signals
    signal_summary = await _get_signal_summary()

    # 3. Collect sentiment
    sentiment_summary = await _get_sentiment_summary()

    # 4. Run sentiment analysis if none exists today
    today_sentiment = await fetch_all(
        "SELECT * FROM sentiment_scores WHERE analyzed_at > date('now', '-12 hours') LIMIT 1",
    )
    if not today_sentiment:
        try:
            from services.sentiment_service import analyze_all_sentiment
            await analyze_all_sentiment(hours=24)
            sentiment_summary = await _get_sentiment_summary()
        except Exception as e:
            print(f"[Report] Sentiment analysis failed: {e}")

    # 5. Collect real estate
    realestate_summary = await _get_realestate_changes()

    # 6. Get notable stock movements
    notable_stocks = await _get_notable_stocks()

    # 7. Also get basic real estate report
    re_report = ""
    try:
        re_report = await generate_realestate_report()
    except Exception as e:
        re_report = f"부동산 리포트 오류: {e}"

    # 8. Generate LLM comprehensive report
    llm_report = await _generate_llm_report(
        stock_report, signal_summary, sentiment_summary,
        realestate_summary, notable_stocks,
    )

    # Combine into final report
    full_report = llm_report

    # Save to DB
    await execute(
        "INSERT INTO daily_reports (report_type, title, content, data_json) VALUES ('combined', ?, ?, ?)",
        (
            f"Lucas 일일 금융 리포트 — {today}",
            full_report,
            json.dumps({
                "signal_count": signal_summary.count("\n") + 1 if signal_summary else 0,
                "sentiment_count": sentiment_summary.count("\n") + 1 if sentiment_summary else 0,
                "generated_at": datetime.now().isoformat(),
                "model": DEFAULT_MODEL,
            }, ensure_ascii=False),
        ),
    )

    # Save to file
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"daily-{today}.md"
    report_path.write_text(full_report, encoding="utf-8")
    print(f"[Report] Saved to {report_path}")

    # Broadcast
    await ws_manager.broadcast({
        "type": "daily_report",
        "data": {"title": f"Lucas 일일 금융 리포트 — {today}", "preview": full_report[:500]},
    })

    # Telegram
    try:
        from services.telegram_service import send_daily_summary
        await send_daily_summary(full_report[:4000])
    except Exception:
        pass

    print(f"[Report] Daily report complete ({len(full_report)} chars)")
    return full_report


async def get_reports(report_type: str = None, limit: int = 10) -> list[dict]:
    """Get recent reports from DB."""
    if report_type:
        return await fetch_all(
            "SELECT * FROM daily_reports WHERE report_type=? ORDER BY created_at DESC LIMIT ?",
            (report_type, limit),
        )
    return await fetch_all(
        "SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )


async def get_daily_report_by_date(date_str: str) -> dict | None:
    """Get daily report for a specific date (YYYY-MM-DD)."""
    # Try file first
    report_path = REPORTS_DIR / f"daily-{date_str}.md"
    if report_path.exists():
        content = report_path.read_text(encoding="utf-8")
        return {"date": date_str, "content": content, "source": "file"}

    # Fallback to DB
    row = await fetch_all(
        """SELECT * FROM daily_reports
           WHERE report_type = 'combined'
             AND created_at LIKE ?
           ORDER BY created_at DESC LIMIT 1""",
        (f"{date_str}%",),
    )
    if row:
        return {"date": date_str, "content": row[0]["content"], "source": "db", **row[0]}
    return None


async def list_daily_reports(limit: int = 30) -> list[dict]:
    """List available daily reports (from both DB and files)."""
    reports = []

    # From files
    if REPORTS_DIR.exists():
        for f in sorted(REPORTS_DIR.glob("daily-*.md"), reverse=True)[:limit]:
            date_str = f.stem.replace("daily-", "")
            reports.append({
                "date": date_str,
                "title": f"Lucas 일일 금융 리포트 — {date_str}",
                "source": "file",
                "size": f.stat().st_size,
            })

    # From DB (add any not in files)
    file_dates = {r["date"] for r in reports}
    db_reports = await fetch_all(
        """SELECT id, title, report_type, created_at,
                  LENGTH(content) as size
           FROM daily_reports
           WHERE report_type = 'combined'
           ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )
    for r in db_reports:
        date_str = r["created_at"][:10]
        if date_str not in file_dates:
            reports.append({
                "date": date_str,
                "title": r["title"],
                "source": "db",
                "size": r["size"],
                "id": r["id"],
            })

    return sorted(reports, key=lambda x: x["date"], reverse=True)[:limit]
