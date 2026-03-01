import csv
import io
from services.db_service import fetch_all


async def export_stocks_csv(market: str = "all", start: str = None, end: str = None) -> str:
    """Export stock market data as CSV."""
    query = "SELECT symbol, name, market, price, change_pct, prev_close, market_cap, volume, recorded_at FROM market_data WHERE 1=1"
    params: list = []

    if market and market != "all":
        query += " AND market = ?"
        params.append(market.upper())
    if start:
        query += " AND recorded_at >= ?"
        params.append(start)
    if end:
        query += " AND recorded_at <= ?"
        params.append(end)

    query += " ORDER BY recorded_at DESC, symbol"
    rows = await fetch_all(query, tuple(params))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["symbol", "name", "market", "price", "change_pct", "prev_close", "market_cap", "volume", "recorded_at"])
    for r in rows:
        writer.writerow([r.get("symbol"), r.get("name"), r.get("market"), r.get("price"),
                         r.get("change_pct"), r.get("prev_close"), r.get("market_cap"),
                         r.get("volume"), r.get("recorded_at")])
    return buf.getvalue()


async def export_realestate_csv(district: str = None, deal_type: str = None) -> str:
    """Export real estate data as CSV."""
    query = "SELECT district, dong, apt_name, deal_type, price, deposit, monthly, area_m2, floor, deal_date, source, recorded_at FROM realestate_data WHERE 1=1"
    params: list = []

    if district:
        query += " AND district = ?"
        params.append(district)
    if deal_type:
        query += " AND deal_type = ?"
        params.append(deal_type)

    query += " ORDER BY recorded_at DESC"
    rows = await fetch_all(query, tuple(params))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["district", "dong", "apt_name", "deal_type", "price", "deposit", "monthly", "area_m2", "floor", "deal_date", "source", "recorded_at"])
    for r in rows:
        writer.writerow([r.get("district"), r.get("dong"), r.get("apt_name"), r.get("deal_type"),
                         r.get("price"), r.get("deposit"), r.get("monthly"), r.get("area_m2"),
                         r.get("floor"), r.get("deal_date"), r.get("source"), r.get("recorded_at")])
    return buf.getvalue()


async def export_research_md() -> str:
    """Export research reports as Markdown."""
    rows = await fetch_all(
        """SELECT r.id, r.title, r.summary, r.full_analysis, r.confidence_avg, r.created_at,
                  t.query, t.trigger_type, t.priority
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           ORDER BY r.created_at DESC"""
    )

    lines = ["# Research Reports\n"]
    for r in rows:
        lines.append(f"## [{r.get('id')}] {r.get('title') or r.get('query', 'N/A')}")
        lines.append(f"- **Date**: {r.get('created_at', 'N/A')}")
        lines.append(f"- **Trigger**: {r.get('trigger_type', 'N/A')} | **Priority**: {r.get('priority', 'N/A')}")
        lines.append(f"- **Confidence**: {r.get('confidence_avg', 'N/A')}")
        lines.append("")
        if r.get("summary"):
            lines.append(f"### Summary\n{r['summary']}\n")
        if r.get("full_analysis"):
            lines.append(f"### Analysis\n{r['full_analysis']}\n")
        lines.append("---\n")

    return "\n".join(lines)


async def export_expenses_csv(from_date: str = None, to_date: str = None, category: str = None) -> str:
    """Export expenses as CSV."""
    query = "SELECT id, amount, category, description, is_income, paid_at, source, created_at FROM expenses WHERE 1=1"
    params: list = []

    if from_date:
        query += " AND paid_at >= ?"
        params.append(from_date)
    if to_date:
        query += " AND paid_at <= ?"
        params.append(to_date)
    if category:
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY paid_at DESC"
    rows = await fetch_all(query, tuple(params))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "amount", "category", "description", "is_income", "paid_at", "source", "created_at"])
    for r in rows:
        writer.writerow([r.get("id"), r.get("amount"), r.get("category"), r.get("description"),
                         r.get("is_income"), r.get("paid_at"), r.get("source"), r.get("created_at")])
    return buf.getvalue()
