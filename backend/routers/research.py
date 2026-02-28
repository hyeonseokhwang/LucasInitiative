from fastapi import APIRouter, Query
from services.db_service import fetch_all, fetch_one
from services.research_service import research_engine, queue_manual

router = APIRouter()


@router.get("/topics")
async def list_topics(
    status: str = None,
    limit: int = Query(20, le=100),
):
    """List research topics."""
    if status:
        rows = await fetch_all(
            "SELECT * FROM research_topics WHERE status = ? ORDER BY created_at DESC LIMIT ?",
            (status, limit),
        )
    else:
        rows = await fetch_all(
            "SELECT * FROM research_topics ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
    return {"topics": rows}


@router.get("/reports")
async def list_reports(limit: int = Query(20, le=100)):
    """List research reports."""
    rows = await fetch_all(
        """SELECT r.*, t.query, t.trigger_type, t.priority
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           ORDER BY r.created_at DESC LIMIT ?""",
        (limit,),
    )
    return {"reports": rows}


@router.get("/reports/{report_id}")
async def get_report(report_id: int):
    """Get full report with evidence chain."""
    report = await fetch_one(
        """SELECT r.*, t.query, t.trigger_type, t.priority, t.source_data
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
