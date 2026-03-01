"""
API Router for Trends, Insights, Pipeline, Queue, and External Data.
"""
from fastapi import APIRouter, Query
from fastapi.responses import Response
from services.research_analytics_service import (
    get_keyword_trends, get_category_trends,
    generate_weekly_insight, get_weekly_insights,
    get_pipeline_stats,
    queue_manager,
)
from services.naver_crawler_service import (
    fetch_rss_news, crawl_all_news_categories, search_naver_news,
    fetch_public_realestate_summary, get_crawler_status,
)
from services.research_service import queue_manual

router = APIRouter()


# ─── TRENDS ───

@router.get("/keywords")
async def keyword_trends(days: int = Query(30, le=90), top_n: int = Query(20, le=50)):
    """Get keyword frequency trends from research data."""
    return await get_keyword_trends(days, top_n)


@router.get("/categories")
async def category_trends(days: int = Query(30, le=90)):
    """Get category distribution trends over time."""
    return await get_category_trends(days)


# ─── INSIGHTS ───

@router.get("/insights/weekly")
async def list_weekly_insights(limit: int = Query(10, le=50)):
    """List past weekly insight reports."""
    insights = await get_weekly_insights(limit)
    return {"insights": insights, "count": len(insights)}


@router.post("/insights/weekly")
async def generate_insight(force: bool = False):
    """Generate a new weekly insight report using AI."""
    result = await generate_weekly_insight(force=force)
    return result


# ─── PIPELINE ───

@router.get("/pipeline/stats")
async def pipeline_stats():
    """Get data pipeline monitoring statistics."""
    return await get_pipeline_stats()


# ─── QUEUE ───

@router.get("/queue")
async def queue_status():
    """Get research queue status."""
    return await queue_manager.get_status()


@router.post("/queue")
async def queue_add(query: str = Query(..., min_length=2), priority: int = Query(5, ge=1, le=10), category: str = "general"):
    """Add a research request to the queue."""
    item = await queue_manager.enqueue(query, priority, category)
    # Also queue it for actual research
    await queue_manual(query)
    return {"status": "queued", "item": item}


@router.delete("/queue/{queue_id}")
async def queue_remove(queue_id: str):
    """Remove an item from the queue."""
    ok = await queue_manager.remove(queue_id)
    return {"status": "removed" if ok else "not_found", "id": queue_id}


# ─── EXTERNAL DATA SOURCES ───

@router.get("/sources/status")
async def sources_status():
    """Get status of all external data sources."""
    return await get_crawler_status()


@router.get("/sources/news")
async def sources_news(category: str = Query("economy"), limit: int = Query(15, le=30)):
    """Fetch news from RSS feed."""
    items = await fetch_rss_news(category, limit)
    return {"items": items, "count": len(items), "category": category}


@router.post("/sources/news/crawl")
async def sources_crawl():
    """Trigger crawling all news categories."""
    results = await crawl_all_news_categories()
    return {"status": "completed", "results": results}


@router.get("/sources/news/search")
async def sources_search(q: str = Query(..., min_length=2), limit: int = Query(10, le=20)):
    """Search news by query."""
    items = await search_naver_news(q, limit)
    return {"items": items, "count": len(items), "query": q}


@router.get("/sources/realestate")
async def sources_realestate():
    """Get real estate data summary."""
    return await fetch_public_realestate_summary()
