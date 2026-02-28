from services.db_service import execute, fetch_all, fetch_one


async def create_schedule(
    title: str,
    start_at: str,
    end_at: str | None = None,
    description: str | None = None,
    all_day: bool = False,
    category: str = "general",
    remind_at: str | None = None,
) -> dict:
    row_id = await execute(
        """INSERT INTO schedules (title, description, start_at, end_at, all_day, category, remind_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (title, description, start_at, end_at, int(all_day), category, remind_at),
    )
    return await get_schedule(row_id)


async def get_schedule(schedule_id: int) -> dict | None:
    return await fetch_one("SELECT * FROM schedules WHERE id=?", (schedule_id,))


async def list_schedules(
    from_date: str | None = None,
    to_date: str | None = None,
    status: str = "active",
    limit: int = 50,
) -> list[dict]:
    query = "SELECT * FROM schedules WHERE status=?"
    params: list = [status]

    if from_date:
        query += " AND start_at >= ?"
        params.append(from_date)
    if to_date:
        query += " AND start_at <= ?"
        params.append(to_date)

    query += " ORDER BY start_at ASC LIMIT ?"
    params.append(limit)

    return await fetch_all(query, tuple(params))


async def update_schedule(schedule_id: int, **kwargs) -> dict | None:
    allowed = {"title", "description", "start_at", "end_at", "all_day", "category", "remind_at", "status"}
    updates = {k: v for k, v in kwargs.items() if k in allowed and v is not None}

    if not updates:
        return await get_schedule(schedule_id)

    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [schedule_id]

    await execute(f"UPDATE schedules SET {set_clause} WHERE id=?", tuple(values))
    return await get_schedule(schedule_id)


async def delete_schedule(schedule_id: int) -> bool:
    await execute("UPDATE schedules SET status='cancelled' WHERE id=?", (schedule_id,))
    return True


async def get_upcoming(hours: int = 24) -> list[dict]:
    """Get schedules starting within the next N hours."""
    return await fetch_all(
        """SELECT * FROM schedules
           WHERE status='active'
             AND start_at >= datetime('now')
             AND start_at <= datetime('now', ? || ' hours')
           ORDER BY start_at ASC""",
        (str(hours),),
    )
