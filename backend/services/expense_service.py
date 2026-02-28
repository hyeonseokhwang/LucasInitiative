from services.db_service import execute, fetch_all, fetch_one


async def add_expense(
    amount: int,
    category: str = "etc",
    description: str | None = None,
    is_income: bool = False,
    paid_at: str | None = None,
    source: str = "manual",
) -> dict:
    row_id = await execute(
        """INSERT INTO expenses (amount, category, description, is_income, paid_at, source)
           VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)""",
        (amount, category, description, int(is_income), paid_at, source),
    )
    return await fetch_one("SELECT * FROM expenses WHERE id=?", (row_id,))


async def list_expenses(
    from_date: str | None = None,
    to_date: str | None = None,
    category: str | None = None,
    limit: int = 50,
) -> list[dict]:
    query = "SELECT * FROM expenses WHERE 1=1"
    params: list = []

    if from_date:
        query += " AND paid_at >= ?"
        params.append(from_date)
    if to_date:
        query += " AND paid_at <= ?"
        params.append(to_date)
    if category:
        query += " AND category=?"
        params.append(category)

    query += " ORDER BY paid_at DESC LIMIT ?"
    params.append(limit)

    return await fetch_all(query, tuple(params))


async def get_summary(month: str) -> dict:
    """Get monthly summary. month format: '2026-02'"""
    rows = await fetch_all(
        """SELECT category, is_income,
                  SUM(amount) as total,
                  COUNT(*) as count
           FROM expenses
           WHERE strftime('%%Y-%%m', paid_at) = ?
           GROUP BY category, is_income
           ORDER BY total DESC""",
        (month,),
    )

    income = sum(r["total"] for r in rows if r["is_income"])
    expense = sum(r["total"] for r in rows if not r["is_income"])

    return {
        "month": month,
        "total_income": income,
        "total_expense": expense,
        "balance": income - expense,
        "breakdown": rows,
    }


async def delete_expense(expense_id: int) -> bool:
    await execute("DELETE FROM expenses WHERE id=?", (expense_id,))
    return True
