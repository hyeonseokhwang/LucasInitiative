"""
Dashboard Summary Router — single API call returning all key metrics.
GET /api/dashboard/summary
"""
from fastapi import APIRouter
from services.db_service import fetch_one, fetch_all
from services.ollama_service import is_available as ollama_available
from services.cache_service import stats_cache
from services.notification_service import get_unread_count
from services.log_service import log_service

router = APIRouter()


@router.get("/summary")
async def dashboard_summary():
    """Return all key dashboard data in one call."""
    cached = stats_cache.get("dashboard_summary")
    if cached is not None:
        return cached

    # Run all queries
    research_stats = await fetch_one(
        """SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status='researching' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
           FROM research_topics"""
    )

    reports_stats = await fetch_one(
        """SELECT COUNT(*) AS total,
              ROUND(AVG(confidence_avg), 3) AS avg_confidence,
              SUM(evidence_count) AS total_evidence,
              SUM(CASE WHEN bookmarked=1 THEN 1 ELSE 0 END) AS bookmarked
           FROM research_reports"""
    )

    news_stats = await fetch_one(
        """SELECT COUNT(*) AS total,
              SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS last_24h
           FROM collected_items"""
    )

    recent_reports = await fetch_all(
        """SELECT r.id, r.title, r.summary, r.confidence_avg, r.evidence_count,
                  r.created_at, t.category
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           ORDER BY r.created_at DESC LIMIT 5"""
    )

    # Trend summary: top 5 keywords from last 7 days
    recent_items = await fetch_all(
        """SELECT title FROM collected_items
           WHERE created_at > datetime('now', '-7 days')
           ORDER BY created_at DESC LIMIT 100"""
    )
    from collections import Counter
    import re
    word_pattern = re.compile(r'[가-힣]{2,}|[a-zA-Z]{3,}')
    stop = {"the", "and", "for", "was", "are", "이", "가", "은", "는", "을", "를", "의", "에", "에서", "으로"}
    all_words = []
    for item in recent_items:
        words = word_pattern.findall((item.get("title") or "").lower())
        all_words.extend(w for w in words if w not in stop)
    top_keywords = [{"keyword": w, "count": c} for w, c in Counter(all_words).most_common(10)]

    # System status
    ollama_ok = await ollama_available()
    unread = await get_unread_count()
    log_stats = log_service.get_stats()

    # Category breakdown
    cat_breakdown = await fetch_all(
        """SELECT category, COUNT(*) AS cnt
           FROM collected_items
           WHERE created_at > datetime('now', '-7 days')
           GROUP BY category ORDER BY cnt DESC"""
    )

    result = {
        "research": {
            "topics_total": research_stats["total"] if research_stats else 0,
            "topics_completed": research_stats["completed"] if research_stats else 0,
            "topics_active": research_stats["active"] if research_stats else 0,
            "topics_pending": research_stats["pending"] if research_stats else 0,
        },
        "reports": {
            "total": reports_stats["total"] if reports_stats else 0,
            "avg_confidence": reports_stats["avg_confidence"] if reports_stats else 0,
            "total_evidence": reports_stats["total_evidence"] if reports_stats else 0,
            "bookmarked": reports_stats["bookmarked"] if reports_stats else 0,
            "recent": recent_reports,
        },
        "news": {
            "total": news_stats["total"] if news_stats else 0,
            "last_24h": news_stats["last_24h"] if news_stats else 0,
            "category_breakdown": cat_breakdown,
        },
        "trends": {
            "top_keywords": top_keywords,
        },
        "system": {
            "ollama_available": ollama_ok,
            "unread_notifications": unread,
            "log_stats": log_stats,
        },
    }

    stats_cache.set("dashboard_summary", result, ttl=60)
    return result
