from fastapi import APIRouter
from services.stock_service import fetch_stock_data, fetch_indices, generate_stock_report
from services.realestate_service import generate_realestate_report
from services.report_service import generate_daily_report, get_reports
from services.scheduler_service import scheduler
from services.collector_service import collector, get_daily_summary, get_recent_alerts, get_recent_news

router = APIRouter()


@router.get("/stocks")
async def get_stocks(market: str = "all"):
    """Get current stock prices."""
    data = await fetch_stock_data(market=market)
    return {"stocks": data}


@router.get("/indices")
async def get_indices():
    """Get market indices."""
    data = await fetch_indices()
    return {"indices": data}


@router.post("/stocks/report")
async def stock_report():
    """Generate stock report now."""
    report = await generate_stock_report()
    return {"report": report}


@router.post("/realestate/report")
async def realestate_report():
    """Generate real estate report now."""
    report = await generate_realestate_report()
    return {"report": report}


@router.post("/daily")
async def daily_report():
    """Generate full daily report now."""
    report = await generate_daily_report()
    return {"report": report}


@router.get("/history")
async def report_history(report_type: str = None, limit: int = 10):
    """Get past reports."""
    rows = await get_reports(report_type=report_type, limit=limit)
    return {"reports": rows}


@router.get("/scheduler")
async def scheduler_status():
    """Get scheduler status."""
    return {"jobs": scheduler.get_status()}


@router.post("/scheduler/{job_name}/run")
async def run_job(job_name: str):
    """Manually trigger a scheduled job."""
    result = await scheduler.run_job(job_name)
    if result is None:
        return {"error": f"Job '{job_name}' not found"}
    return {"result": result[:2000] if isinstance(result, str) else result}


@router.get("/collector/status")
async def collector_status():
    """Get background collector status."""
    stats = collector.get_stats()
    summary = await get_daily_summary()
    return {"collector": stats, "today": summary}


@router.get("/collector/alerts")
async def collector_alerts(limit: int = 20):
    """Get recent price alerts."""
    alerts = await get_recent_alerts(limit)
    return {"alerts": alerts}


@router.get("/collector/news")
async def collector_news(category: str = None, limit: int = 30):
    """Get collected news."""
    news = await get_recent_news(category, limit)
    return {"news": news}
