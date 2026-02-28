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
            """INSERT INTO market_data (symbol, name, market, price, change_pct, prev_close, market_cap)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (d["symbol"], d["name"], d.get("market", ""), d.get("price", 0),
             d.get("change_pct", 0), d.get("prev_close", 0), d.get("market_cap", 0)),
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
