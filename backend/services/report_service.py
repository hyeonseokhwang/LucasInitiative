from datetime import datetime
from services.stock_service import generate_stock_report
from services.realestate_service import generate_realestate_report
from services.db_service import execute, fetch_all
from ws.handler import manager as ws_manager


async def generate_daily_report() -> str:
    """Generate combined daily report (stock + real estate)."""
    lines = [
        f"# Lucas Daily Report",
        f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
    ]

    # Stock report
    try:
        await ws_manager.broadcast({
            "type": "chat_token",
            "data": {"conversation_id": 0, "token": "[Collecting stock data...]\n", "done": False},
        })
        stock_report = await generate_stock_report()
        lines.append(stock_report)
    except Exception as e:
        lines.append(f"## Stock Report\nError: {e}\n")

    lines.append("\n---\n")

    # Real estate report
    try:
        await ws_manager.broadcast({
            "type": "chat_token",
            "data": {"conversation_id": 0, "token": "[Collecting real estate data...]\n", "done": False},
        })
        re_report = await generate_realestate_report()
        lines.append(re_report)
    except Exception as e:
        lines.append(f"## Real Estate Report\nError: {e}\n")

    report = "\n".join(lines)

    # Save combined report
    await execute(
        "INSERT INTO daily_reports (report_type, title, content) VALUES ('combined', ?, ?)",
        (f"Daily Report {datetime.now().strftime('%Y-%m-%d')}", report),
    )

    # Broadcast to connected clients
    await ws_manager.broadcast({
        "type": "daily_report",
        "data": {"title": f"Daily Report {datetime.now().strftime('%Y-%m-%d')}", "preview": report[:500]},
    })

    # Send to Telegram
    try:
        from services.telegram_service import send_daily_summary
        await send_daily_summary(report)
    except Exception:
        pass

    return report


async def get_reports(report_type: str = None, limit: int = 10) -> list[dict]:
    """Get recent reports."""
    if report_type:
        return await fetch_all(
            "SELECT * FROM daily_reports WHERE report_type=? ORDER BY created_at DESC LIMIT ?",
            (report_type, limit),
        )
    return await fetch_all(
        "SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
