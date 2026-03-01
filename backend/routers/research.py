from fastapi import APIRouter, Query
from services.db_service import execute, fetch_all, fetch_one
from services.research_service import research_engine, queue_manual
from services.signal_detector import scan_all_signals, get_recent_signals
from services.vram_manager import vram_manager
from services.sentiment_service import analyze_all_sentiment, get_latest_sentiment, get_sentiment_history
from services.report_service import list_daily_reports, get_daily_report_by_date

router = APIRouter()


@router.get("/topics")
async def list_topics(
    status: str = None,
    category: str = None,
    limit: int = Query(20, le=100),
):
    """List research topics with optional status/category filter."""
    conditions = []
    params = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if category and category != "all":
        conditions.append("category = ?")
        params.append(category)

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    params.append(limit)
    rows = await fetch_all(
        f"SELECT * FROM research_topics {where} ORDER BY created_at DESC LIMIT ?",
        tuple(params),
    )
    return {"topics": rows}


@router.get("/reports")
async def list_reports(
    limit: int = Query(20, le=100),
    category: str = None,
    bookmarked: bool = None,
):
    """List research reports with optional category/bookmark filter."""
    conditions = []
    params = []
    if category and category != "all":
        conditions.append("t.category = ?")
        params.append(category)
    if bookmarked:
        conditions.append("r.bookmarked = 1")

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    params.append(limit)
    rows = await fetch_all(
        f"""SELECT r.*, t.query, t.trigger_type, t.priority, t.category
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           {where}
           ORDER BY r.created_at DESC LIMIT ?""",
        tuple(params),
    )
    return {"reports": rows}


@router.put("/reports/{report_id}/bookmark")
async def toggle_bookmark(report_id: int):
    """Toggle bookmark status on a report."""
    report = await fetch_one("SELECT bookmarked FROM research_reports WHERE id = ?", (report_id,))
    if not report:
        return {"error": "Report not found"}
    new_val = 0 if report["bookmarked"] else 1
    await execute("UPDATE research_reports SET bookmarked = ? WHERE id = ?", (new_val, report_id))
    return {"id": report_id, "bookmarked": bool(new_val)}


@router.get("/reports/{report_id}")
async def get_report(report_id: int):
    """Get full report with evidence chain."""
    report = await fetch_one(
        """SELECT r.*, t.query, t.trigger_type, t.priority, t.category, t.source_data
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.id = ?""",
        (report_id,),
    )
    if not report:
        return {"error": "Report not found"}

    evidence = await fetch_all(
        """SELECT * FROM research_evidence
           WHERE topic_id = ?
           ORDER BY confidence DESC""",
        (report["topic_id"],),
    )
    return {"report": report, "evidence": evidence}


@router.get("/evidence/{topic_id}")
async def get_evidence(topic_id: int):
    """Get all evidence for a topic."""
    rows = await fetch_all(
        "SELECT * FROM research_evidence WHERE topic_id = ? ORDER BY confidence DESC",
        (topic_id,),
    )
    return {"evidence": rows}


@router.post("/trigger")
async def trigger_research(query: str = Query(..., min_length=2)):
    """Manually trigger a research investigation."""
    await queue_manual(query)
    return {"status": "queued", "query": query}


@router.get("/status")
async def engine_status():
    """Get research engine status."""
    return {"engine": await research_engine.get_status()}


@router.get("/signals")
async def list_signals(limit: int = Query(50, le=200)):
    """Get recently detected trading signals."""
    signals = await get_recent_signals(limit)
    return {"signals": signals, "count": len(signals)}


@router.post("/signals/scan")
async def trigger_signal_scan():
    """Manually trigger a signal scan across all tracked stocks."""
    signals = await scan_all_signals()
    return {"status": "completed", "signals": signals, "count": len(signals)}


@router.get("/vram")
async def vram_status():
    """Get current VRAM usage and loaded models."""
    return await vram_manager.get_vram_usage()


@router.post("/vram/load")
async def vram_load(model: str = Query(...), keep_alive: str = "30m"):
    """Load a model into VRAM (auto-unloads others if needed)."""
    ok = await vram_manager.load_model(model, keep_alive)
    return {"status": "loaded" if ok else "failed", "model": model}


@router.post("/vram/unload")
async def vram_unload(model: str = Query(None)):
    """Unload a model (or all if no model specified)."""
    if model:
        ok = await vram_manager.unload_model(model)
        return {"status": "unloaded" if ok else "failed", "model": model}
    else:
        count = await vram_manager.unload_all()
        return {"status": "unloaded_all", "count": count}


@router.post("/vram/prepare-whisper")
async def vram_prepare_whisper():
    """Unload all Ollama models to free VRAM for Whisper."""
    info = await vram_manager.prepare_for_whisper()
    return {"status": "ready_for_whisper", **info}


@router.post("/vram/restore")
async def vram_restore():
    """Restore default model after Whisper is done."""
    ok = await vram_manager.restore_after_whisper()
    return {"status": "restored" if ok else "failed"}


# --- Sentiment Analysis ---

@router.get("/sentiment")
async def sentiment_scores(limit: int = Query(20, le=50)):
    """Get latest sentiment scores per stock."""
    scores = await get_latest_sentiment(limit)
    return {"sentiment": scores, "count": len(scores)}


@router.get("/sentiment/{symbol}")
async def sentiment_history(symbol: str, days: int = Query(7, le=30)):
    """Get sentiment history for a specific stock."""
    history = await get_sentiment_history(symbol, days)
    return {"symbol": symbol, "history": history, "count": len(history)}


@router.post("/sentiment/analyze")
async def trigger_sentiment_analysis(hours: int = Query(24, le=72)):
    """Manually trigger sentiment analysis on recent news."""
    results = await analyze_all_sentiment(hours)
    return {"status": "completed", "results": results, "count": len(results)}


# --- Daily Reports ---

@router.get("/daily-reports")
async def get_daily_reports(limit: int = Query(30, le=100)):
    """List available daily reports."""
    reports = await list_daily_reports(limit)
    return {"reports": reports, "count": len(reports)}


@router.get("/daily-reports/{date}")
async def get_daily_report(date: str):
    """Get daily report for a specific date (YYYY-MM-DD)."""
    report = await get_daily_report_by_date(date)
    if not report:
        return {"error": "Report not found", "date": date}
    return {"report": report}
