from fastapi import APIRouter, Query
from pydantic import BaseModel
from services.stock_service import (
    fetch_stock_data, fetch_indices, generate_stock_report,
    fetch_stock_history, fetch_stock_history_by_range,
    fetch_stock_history_dataframe,
    get_all_stocks_with_sector, get_sectors_summary,
    get_portfolio, add_portfolio_item, update_portfolio_item,
    delete_portfolio_item, get_portfolio_summary,
)
from services.indicator_service import (
    calc_sma, calc_ema, calc_rsi, calc_macd, calc_bollinger_bands,
    calc_all_indicators,
)
from services.realestate_service import generate_realestate_report
from services.report_service import generate_daily_report, get_reports
from services.scheduler_service import scheduler
from services.collector_service import collector, get_daily_summary, get_recent_alerts, get_recent_news


class PortfolioAdd(BaseModel):
    symbol: str
    name: str
    quantity: float
    avg_price: float


class PortfolioUpdate(BaseModel):
    quantity: float | None = None
    avg_price: float | None = None

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


# --- Stock History & Charts ---

@router.get("/stocks/history/{symbol:path}")
async def stock_history(symbol: str, period: str = "1mo"):
    """Get historical OHLCV data for charting."""
    data = await fetch_stock_history(symbol, period)
    return {"symbol": symbol, "period": period, "data": data}


@router.get("/stocks/history-range/{symbol:path}")
async def stock_history_range(
    symbol: str,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    interval: str = Query("1d", description="Interval: 1m,5m,15m,30m,1h,1d,1wk,1mo"),
):
    """Get historical OHLCV data by date range."""
    data = await fetch_stock_history_by_range(symbol, start, end, interval)
    return {"symbol": symbol, "start": start, "end": end, "interval": interval, "data": data}


@router.get("/stocks/list")
async def stock_list():
    """Get all tracked stocks with sector info."""
    return {"stocks": get_all_stocks_with_sector()}


# --- Sector Analysis ---

@router.get("/sectors")
async def sectors():
    """Get sector-grouped stock data with performance."""
    all_data = await fetch_stock_data(market="all")
    return {"sectors": get_sectors_summary(all_data)}


# --- Portfolio ---

@router.get("/portfolio")
async def portfolio_list():
    """Get portfolio with current prices and P&L."""
    return await get_portfolio_summary()


@router.post("/portfolio")
async def portfolio_add(item: PortfolioAdd):
    """Add stock to portfolio."""
    result = await add_portfolio_item(item.symbol, item.name, item.quantity, item.avg_price)
    return result


@router.put("/portfolio/{item_id}")
async def portfolio_update(item_id: int, item: PortfolioUpdate):
    """Update portfolio holding."""
    return await update_portfolio_item(item_id, item.quantity, item.avg_price)


@router.delete("/portfolio/{item_id}")
async def portfolio_delete(item_id: int):
    """Remove from portfolio."""
    return await delete_portfolio_item(item_id)


# --- Technical Indicators ---

@router.get("/stocks/indicators/{symbol:path}")
async def stock_indicators(
    symbol: str,
    period: str = Query("6mo", description="Period: 1mo,3mo,6mo,1y,2y"),
    start: str | None = Query(None, description="Start date YYYY-MM-DD (overrides period)"),
    end: str | None = Query(None, description="End date YYYY-MM-DD (overrides period)"),
):
    """Get all technical indicators for a stock (SMA, EMA, RSI, MACD, Bollinger)."""
    df = await fetch_stock_history_dataframe(symbol, period=period, start_date=start, end_date=end)
    if df.empty:
        return {"symbol": symbol, "error": "No data available"}
    indicators = calc_all_indicators(df)
    return {"symbol": symbol, **indicators}


@router.get("/stocks/indicators/{symbol:path}/sma")
async def stock_sma(
    symbol: str,
    period: str = Query("6mo"),
    periods: str = Query("5,10,20,50,200", description="Comma-separated SMA periods"),
):
    """Get Simple Moving Average for a stock."""
    df = await fetch_stock_history_dataframe(symbol, period=period)
    if df.empty:
        return {"symbol": symbol, "error": "No data available"}
    sma_periods = [int(p.strip()) for p in periods.split(",") if p.strip().isdigit()]
    return {"symbol": symbol, "sma": calc_sma(df, sma_periods)}


@router.get("/stocks/indicators/{symbol:path}/ema")
async def stock_ema(
    symbol: str,
    period: str = Query("6mo"),
    periods: str = Query("12,26,50", description="Comma-separated EMA periods"),
):
    """Get Exponential Moving Average for a stock."""
    df = await fetch_stock_history_dataframe(symbol, period=period)
    if df.empty:
        return {"symbol": symbol, "error": "No data available"}
    ema_periods = [int(p.strip()) for p in periods.split(",") if p.strip().isdigit()]
    return {"symbol": symbol, "ema": calc_ema(df, ema_periods)}


@router.get("/stocks/indicators/{symbol:path}/rsi")
async def stock_rsi(
    symbol: str,
    period: str = Query("6mo"),
    rsi_period: int = Query(14, description="RSI calculation period"),
):
    """Get RSI (Relative Strength Index) for a stock."""
    df = await fetch_stock_history_dataframe(symbol, period=period)
    if df.empty:
        return {"symbol": symbol, "error": "No data available"}
    return {"symbol": symbol, "rsi_period": rsi_period, "rsi": calc_rsi(df, rsi_period)}


@router.get("/stocks/indicators/{symbol:path}/macd")
async def stock_macd(
    symbol: str,
    period: str = Query("6mo"),
    fast: int = Query(12),
    slow: int = Query(26),
    signal: int = Query(9),
):
    """Get MACD for a stock."""
    df = await fetch_stock_history_dataframe(symbol, period=period)
    if df.empty:
        return {"symbol": symbol, "error": "No data available"}
    return {"symbol": symbol, "params": {"fast": fast, "slow": slow, "signal": signal}, **calc_macd(df, fast, slow, signal)}


@router.get("/stocks/indicators/{symbol:path}/bollinger")
async def stock_bollinger(
    symbol: str,
    period: str = Query("6mo"),
    bb_period: int = Query(20, description="Bollinger band period"),
    std_dev: float = Query(2.0, description="Standard deviation multiplier"),
):
    """Get Bollinger Bands for a stock."""
    df = await fetch_stock_history_dataframe(symbol, period=period)
    if df.empty:
        return {"symbol": symbol, "error": "No data available"}
    return {"symbol": symbol, "params": {"period": bb_period, "std_dev": std_dev}, **calc_bollinger_bands(df, bb_period, std_dev)}
