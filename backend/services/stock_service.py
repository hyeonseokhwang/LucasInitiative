import json
import yfinance as yf
from pykrx import stock as krx
from datetime import datetime, timedelta
from services.db_service import execute, fetch_all

# 관심 종목 기본값
DEFAULT_KR_STOCKS = {
    "005930.KS": "삼성전자",
    "000660.KS": "SK하이닉스",
    "035420.KS": "NAVER",
    "035720.KS": "카카오",
    "006400.KS": "삼성SDI",
    "051910.KS": "LG화학",
    "005380.KS": "현대차",
    "068270.KS": "셀트리온",
    "105560.KS": "KB금융",
    "055550.KS": "신한지주",
}

DEFAULT_US_STOCKS = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "NVDA": "NVIDIA",
    "TSLA": "Tesla",
    "META": "Meta",
}

MARKET_INDICES = {
    "^KS11": ("KOSPI", "KR"),
    "^KQ11": ("KOSDAQ", "KR"),
    "^GSPC": ("S&P 500", "US"),
    "^IXIC": ("NASDAQ", "US"),
    "^DJI": ("Dow Jones", "US"),
}

# 섹터 분류
STOCK_SECTORS = {
    "005930.KS": "반도체",
    "000660.KS": "반도체",
    "035420.KS": "인터넷/플랫폼",
    "035720.KS": "인터넷/플랫폼",
    "006400.KS": "2차전지",
    "051910.KS": "2차전지",
    "005380.KS": "자동차",
    "068270.KS": "바이오",
    "105560.KS": "금융",
    "055550.KS": "금융",
    "AAPL": "Technology",
    "MSFT": "Technology",
    "GOOGL": "Technology",
    "AMZN": "E-Commerce",
    "NVDA": "Semiconductors",
    "TSLA": "EV/Automotive",
    "META": "Social Media",
}


async def fetch_stock_data(symbols: dict | None = None, market: str = "all") -> list[dict]:
    """Fetch current stock data for given symbols."""
    if symbols is None:
        symbols = {}
        if market in ("all", "kr"):
            symbols.update(DEFAULT_KR_STOCKS)
        if market in ("all", "us"):
            symbols.update(DEFAULT_US_STOCKS)

    results = []

    for symbol, name in symbols.items():
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info

            mkt = "KOSPI" if ".KS" in symbol else "KOSDAQ" if ".KQ" in symbol else "US"

            # Fetch today's OHLCV from history (1d period)
            hist = ticker.history(period="1d")
            open_price = round(float(hist["Open"].iloc[-1]), 2) if not hist.empty else 0
            high_price = round(float(hist["High"].iloc[-1]), 2) if not hist.empty else 0
            low_price = round(float(hist["Low"].iloc[-1]), 2) if not hist.empty else 0
            volume = int(hist["Volume"].iloc[-1]) if not hist.empty else 0

            data = {
                "symbol": symbol,
                "name": name,
                "market": mkt,
                "price": round(info.last_price, 2) if info.last_price else 0,
                "prev_close": round(info.previous_close, 2) if info.previous_close else 0,
                "change_pct": round(
                    ((info.last_price - info.previous_close) / info.previous_close * 100)
                    if info.previous_close and info.last_price else 0, 2
                ),
                "market_cap": info.market_cap if hasattr(info, "market_cap") else 0,
                "open_price": open_price,
                "high": high_price,
                "low": low_price,
                "volume": volume,
            }
            results.append(data)
        except Exception as e:
            results.append({"symbol": symbol, "name": name, "error": str(e)})

    return results


async def fetch_indices() -> list[dict]:
    """Fetch major market indices."""
    results = []
    for symbol, (name, region) in MARKET_INDICES.items():
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            results.append({
                "symbol": symbol,
                "name": name,
                "region": region,
                "price": round(info.last_price, 2) if info.last_price else 0,
                "prev_close": round(info.previous_close, 2) if info.previous_close else 0,
                "change_pct": round(
                    ((info.last_price - info.previous_close) / info.previous_close * 100)
                    if info.previous_close and info.last_price else 0, 2
                ),
            })
        except Exception as e:
            results.append({"symbol": symbol, "name": name, "error": str(e)})

    return results


async def save_stock_data(data_list: list[dict]):
    """Persist stock data to DB."""
    for d in data_list:
        if "error" in d:
            continue
        await execute(
            """INSERT INTO market_data (symbol, name, market, price, change_pct, prev_close, market_cap, open_price, high, low, volume)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (d["symbol"], d["name"], d.get("market", ""), d.get("price", 0),
             d.get("change_pct", 0), d.get("prev_close", 0), d.get("market_cap", 0),
             d.get("open_price", 0), d.get("high", 0), d.get("low", 0), d.get("volume", 0)),
        )


async def generate_stock_report() -> str:
    """Generate a text report of current market status."""
    indices = await fetch_indices()
    kr_stocks = await fetch_stock_data(market="kr")
    us_stocks = await fetch_stock_data(market="us")

    await save_stock_data(kr_stocks + us_stocks)

    lines = ["# Daily Stock Report", f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", ""]

    # Indices
    lines.append("## Market Indices")
    for idx in indices:
        if "error" not in idx:
            arrow = "+" if idx["change_pct"] >= 0 else ""
            lines.append(f"- **{idx['name']}**: {idx['price']:,.2f} ({arrow}{idx['change_pct']}%)")
    lines.append("")

    # Korean stocks
    lines.append("## Korean Stocks (KR)")
    for s in sorted(kr_stocks, key=lambda x: x.get("change_pct", 0), reverse=True):
        if "error" not in s:
            arrow = "+" if s["change_pct"] >= 0 else ""
            lines.append(f"- {s['name']} ({s['symbol'].replace('.KS','')}): {s['price']:,.0f}원 ({arrow}{s['change_pct']}%)")
    lines.append("")

    # US stocks
    lines.append("## US Stocks")
    for s in sorted(us_stocks, key=lambda x: x.get("change_pct", 0), reverse=True):
        if "error" not in s:
            arrow = "+" if s["change_pct"] >= 0 else ""
            lines.append(f"- {s['name']} ({s['symbol']}): ${s['price']:,.2f} ({arrow}{s['change_pct']}%)")

    report = "\n".join(lines)

    # Save report
    await execute(
        "INSERT INTO daily_reports (report_type, title, content) VALUES ('stock', ?, ?)",
        (f"Stock Report {datetime.now().strftime('%Y-%m-%d')}", report),
    )

    return report


async def fetch_stock_history(symbol: str, period: str = "1mo") -> list[dict]:
    """Fetch historical OHLCV data for charting. period: 1d,5d,1mo,3mo,6mo,1y,2y,5y"""
    valid_periods = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"}
    if period not in valid_periods:
        period = "1mo"

    interval_map = {"1d": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d", "6mo": "1d", "1y": "1wk", "2y": "1wk", "5y": "1mo"}
    interval = interval_map.get(period, "1d")

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            return []

        result = []
        for idx, row in hist.iterrows():
            ts = int(idx.timestamp()) if hasattr(idx, 'timestamp') else 0
            result.append({
                "time": ts,
                "date": idx.strftime("%Y-%m-%d") if hasattr(idx, 'strftime') else str(idx),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        return result
    except Exception as e:
        return [{"error": str(e)}]


async def fetch_stock_history_by_range(
    symbol: str,
    start_date: str,
    end_date: str,
    interval: str = "1d",
) -> list[dict]:
    """Fetch historical OHLCV data by date range.

    Args:
        symbol: Stock symbol (e.g. '005930.KS', 'AAPL')
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        interval: Data interval (1m,5m,15m,30m,1h,1d,1wk,1mo)
    """
    valid_intervals = {"1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"}
    if interval not in valid_intervals:
        interval = "1d"

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(start=start_date, end=end_date, interval=interval)
        if hist.empty:
            return []

        result = []
        for idx, row in hist.iterrows():
            ts = int(idx.timestamp()) if hasattr(idx, 'timestamp') else 0
            result.append({
                "time": ts,
                "date": idx.strftime("%Y-%m-%d") if hasattr(idx, 'strftime') else str(idx),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        return result
    except Exception as e:
        return [{"error": str(e)}]


async def fetch_stock_history_dataframe(
    symbol: str,
    period: str = "6mo",
    start_date: str | None = None,
    end_date: str | None = None,
):
    """Fetch historical data as a pandas DataFrame (for indicator calculations).

    Returns a DataFrame with columns: Open, High, Low, Close, Volume
    """
    import pandas as pd
    try:
        ticker = yf.Ticker(symbol)
        if start_date and end_date:
            hist = ticker.history(start=start_date, end=end_date, interval="1d")
        else:
            hist = ticker.history(period=period, interval="1d")
        if hist.empty:
            return pd.DataFrame()
        return hist
    except Exception:
        return pd.DataFrame()


def get_all_stocks_with_sector() -> list[dict]:
    """Return all tracked stocks with sector info."""
    result = []
    for symbol, name in {**DEFAULT_KR_STOCKS, **DEFAULT_US_STOCKS}.items():
        mkt = "KOSPI" if ".KS" in symbol else "KOSDAQ" if ".KQ" in symbol else "US"
        result.append({
            "symbol": symbol,
            "name": name,
            "market": mkt,
            "sector": STOCK_SECTORS.get(symbol, "기타"),
        })
    return result


def get_sectors_summary(stocks_data: list[dict]) -> list[dict]:
    """Group stocks by sector and calc aggregate performance."""
    sector_map: dict[str, list] = {}
    for s in stocks_data:
        if "error" in s:
            continue
        sector = STOCK_SECTORS.get(s["symbol"], "기타")
        sector_map.setdefault(sector, []).append(s)

    result = []
    for sector, items in sector_map.items():
        avg_change = sum(i.get("change_pct", 0) for i in items) / len(items) if items else 0
        total_cap = sum(i.get("market_cap", 0) for i in items)
        result.append({
            "sector": sector,
            "avg_change_pct": round(avg_change, 2),
            "total_market_cap": total_cap,
            "stock_count": len(items),
            "stocks": [{"symbol": i["symbol"], "name": i["name"], "price": i.get("price", 0), "change_pct": i.get("change_pct", 0)} for i in items],
        })
    result.sort(key=lambda x: x["avg_change_pct"], reverse=True)
    return result


# --- Portfolio ---

async def get_portfolio() -> list[dict]:
    """Get all portfolio holdings."""
    rows = await fetch_all(
        "SELECT id, symbol, name, quantity, avg_price, sector, market, added_at FROM portfolio ORDER BY added_at DESC"
    )
    return [dict(r) for r in rows] if rows else []


async def add_portfolio_item(symbol: str, name: str, quantity: float, avg_price: float) -> dict:
    """Add stock to portfolio."""
    sector = STOCK_SECTORS.get(symbol, "기타")
    mkt = "KOSPI" if ".KS" in symbol else "KOSDAQ" if ".KQ" in symbol else "US"
    await execute(
        "INSERT INTO portfolio (symbol, name, quantity, avg_price, sector, market) VALUES (?, ?, ?, ?, ?, ?)",
        (symbol, name, quantity, avg_price, sector, mkt),
    )
    return {"status": "added", "symbol": symbol}


async def update_portfolio_item(item_id: int, quantity: float | None = None, avg_price: float | None = None) -> dict:
    """Update portfolio holding."""
    updates = []
    params = []
    if quantity is not None:
        updates.append("quantity = ?")
        params.append(quantity)
    if avg_price is not None:
        updates.append("avg_price = ?")
        params.append(avg_price)
    if not updates:
        return {"status": "no_change"}
    params.append(item_id)
    await execute(f"UPDATE portfolio SET {', '.join(updates)} WHERE id = ?", tuple(params))
    return {"status": "updated", "id": item_id}


async def delete_portfolio_item(item_id: int) -> dict:
    """Remove stock from portfolio."""
    await execute("DELETE FROM portfolio WHERE id = ?", (item_id,))
    return {"status": "deleted", "id": item_id}


async def get_portfolio_summary() -> dict:
    """Get portfolio with current prices and P&L."""
    holdings = await get_portfolio()
    if not holdings:
        return {"holdings": [], "total_invested": 0, "total_value": 0, "total_pnl": 0, "total_pnl_pct": 0, "sectors": []}

    # Fetch current prices for all held symbols
    symbols_map = {h["symbol"]: h["name"] for h in holdings}
    current_data = await fetch_stock_data(symbols=symbols_map)
    price_map = {d["symbol"]: d for d in current_data if "error" not in d}

    enriched = []
    total_invested = 0
    total_value = 0

    for h in holdings:
        cur = price_map.get(h["symbol"], {})
        current_price = cur.get("price", 0)
        qty = h["quantity"]
        avg = h["avg_price"]
        invested = qty * avg
        value = qty * current_price
        pnl = value - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0

        total_invested += invested
        total_value += value

        enriched.append({
            **h,
            "current_price": current_price,
            "change_pct": cur.get("change_pct", 0),
            "invested": round(invested, 2),
            "value": round(value, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
        })

    # Sector allocation
    sector_alloc: dict[str, float] = {}
    for h in enriched:
        sector = h.get("sector", "기타")
        sector_alloc[sector] = sector_alloc.get(sector, 0) + h["value"]

    sectors = [{"sector": s, "value": round(v, 2), "pct": round(v / total_value * 100, 2) if total_value > 0 else 0} for s, v in sector_alloc.items()]
    sectors.sort(key=lambda x: x["value"], reverse=True)

    total_pnl = total_value - total_invested
    return {
        "holdings": enriched,
        "total_invested": round(total_invested, 2),
        "total_value": round(total_value, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl / total_invested * 100, 2) if total_invested > 0 else 0,
        "sectors": sectors,
    }
