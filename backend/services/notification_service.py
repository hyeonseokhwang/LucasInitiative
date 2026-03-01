import json
from services.db_service import execute, fetch_all, fetch_one


# ─── CRUD ───

async def get_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    ntype: str | None = None,
) -> dict:
    """Get notifications with pagination."""
    conditions = []
    params: list = []

    if unread_only:
        conditions.append("read = 0")
    if ntype:
        conditions.append("type = ?")
        params.append(ntype)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Count total
    count_row = await fetch_one(f"SELECT COUNT(*) AS cnt FROM notifications {where}", tuple(params))
    total = count_row["cnt"] if count_row else 0

    # Fetch page
    params.extend([limit, offset])
    rows = await fetch_all(
        f"SELECT * FROM notifications {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        tuple(params),
    )

    return {"notifications": rows, "total": total, "limit": limit, "offset": offset}


async def get_unread_count() -> int:
    """Get count of unread notifications."""
    row = await fetch_one("SELECT COUNT(*) AS cnt FROM notifications WHERE read = 0")
    return row["cnt"] if row else 0


async def mark_read(notification_id: int) -> bool:
    """Mark a single notification as read."""
    existing = await fetch_one("SELECT id FROM notifications WHERE id = ?", (notification_id,))
    if not existing:
        return False
    await execute("UPDATE notifications SET read = 1 WHERE id = ?", (notification_id,))
    return True


async def mark_all_read() -> int:
    """Mark all unread notifications as read. Returns count affected."""
    count = await get_unread_count()
    if count > 0:
        await execute("UPDATE notifications SET read = 1 WHERE read = 0")
    return count


async def delete_notification(notification_id: int) -> bool:
    """Delete a notification."""
    existing = await fetch_one("SELECT id FROM notifications WHERE id = ?", (notification_id,))
    if not existing:
        return False
    await execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
    return True


# ─── Auto-create notifications ───

async def create_notification(
    title: str,
    message: str | None = None,
    ntype: str = "info",
    metadata: dict | None = None,
) -> int:
    """Create a notification. Returns the new ID."""
    meta_json = json.dumps(metadata, ensure_ascii=False) if metadata else None
    nid = await execute(
        "INSERT INTO notifications (type, title, message, metadata) VALUES (?, ?, ?, ?)",
        (ntype, title, message, meta_json),
    )
    return nid


async def notify_stock_alert(symbol: str, name: str, change_pct: float, price: float):
    """Create stock price alert notification when change exceeds threshold."""
    direction = "急騰" if change_pct > 0 else "急落"
    title = f"[Stock] {name} ({symbol}) {direction} {abs(change_pct):.2f}%"
    message = f"{name} price: {price:,.0f}, change: {change_pct:+.2f}%"
    await create_notification(
        title=title,
        message=message,
        ntype="stock",
        metadata={"symbol": symbol, "name": name, "change_pct": change_pct, "price": price},
    )


async def notify_research_complete(topic_id: int, title: str, confidence: float, evidence_count: int):
    """Create notification when research completes."""
    await create_notification(
        title=f"[Research] {title}",
        message=f"Confidence: {confidence*100:.0f}%, Evidence: {evidence_count} sources",
        ntype="research",
        metadata={"topic_id": topic_id, "confidence": confidence, "evidence_count": evidence_count},
    )


async def notify_system_error(source: str, error_msg: str):
    """Create system error notification."""
    await create_notification(
        title=f"[System Error] {source}",
        message=error_msg[:500],
        ntype="error",
        metadata={"source": source},
    )


async def notify_system_info(title: str, message: str | None = None):
    """Create general system info notification."""
    await create_notification(title=title, message=message, ntype="info")


async def check_stock_alerts(stocks: list[dict], threshold: float = 3.0):
    """Check stock data for significant price changes and create alerts.

    Args:
        stocks: List of stock data dicts with 'symbol', 'name', 'change_pct', 'price'
        threshold: Percentage threshold for alerts (default +-3%)
    """
    for stock in stocks:
        change = stock.get("change_pct", 0)
        if change is None:
            continue
        if abs(change) >= threshold:
            await notify_stock_alert(
                symbol=stock.get("symbol", "?"),
                name=stock.get("name", "?"),
                change_pct=change,
                price=stock.get("price", 0),
            )
