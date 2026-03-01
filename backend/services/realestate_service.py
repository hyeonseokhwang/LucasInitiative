import json
from datetime import datetime
from services.db_service import execute, fetch_all, fetch_one
from services.crawl_service import search_web


# 서울 주요 구
SEOUL_DISTRICTS = [
    "강남구", "서초구", "송파구", "강동구", "마포구",
    "용산구", "성동구", "광진구", "영등포구", "동작구",
]


# ─── Web Search (기존) ───

async def search_realestate_news(district: str = "서울") -> list[dict]:
    """Search recent real estate news/data via web."""
    results = await search_web(f"{district} 아파트 시세 2026", max_results=5)
    return results


async def search_jeonse_data(district: str = "서울") -> list[dict]:
    """Search jeonse/monthly rent data via web."""
    results = await search_web(f"{district} 전세 월세 시세 아파트 2026", max_results=5)
    return results


async def collect_realestate_data() -> dict:
    """Collect real estate data from web searches for major Seoul districts."""
    all_results = {
        "sale": [],
        "jeonse": [],
        "news": [],
        "collected_at": datetime.now().isoformat(),
    }

    sale_news = await search_web("서울 아파트 매매 시세 동향 2026", max_results=5)
    jeonse_news = await search_web("서울 아파트 전세 월세 시세 동향 2026", max_results=5)
    general_news = await search_web("서울 부동산 뉴스 최신", max_results=5)

    all_results["sale"] = sale_news
    all_results["jeonse"] = jeonse_news
    all_results["news"] = general_news

    return all_results


async def generate_realestate_report() -> str:
    """Generate a real estate market report from web data."""
    data = await collect_realestate_data()

    lines = [
        "# Daily Real Estate Report (Seoul)",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Sale Market (매매)",
    ]

    for i, item in enumerate(data.get("sale", [])[:5], 1):
        lines.append(f"{i}. **{item.get('title', '')}**")
        lines.append(f"   {item.get('body', '')}")
        lines.append(f"   {item.get('href', item.get('url', ''))}")
        lines.append("")

    lines.append("## Jeonse/Monthly Rent (전월세)")
    for i, item in enumerate(data.get("jeonse", [])[:5], 1):
        lines.append(f"{i}. **{item.get('title', '')}**")
        lines.append(f"   {item.get('body', '')}")
        lines.append(f"   {item.get('href', item.get('url', ''))}")
        lines.append("")

    lines.append("## Latest News")
    for i, item in enumerate(data.get("news", [])[:5], 1):
        lines.append(f"{i}. **{item.get('title', '')}**")
        lines.append(f"   {item.get('body', '')}")
        lines.append("")

    report = "\n".join(lines)

    await execute(
        "INSERT INTO daily_reports (report_type, title, content, data_json) VALUES ('realestate', ?, ?, ?)",
        (f"RE Report {datetime.now().strftime('%Y-%m-%d')}", report, json.dumps(data, ensure_ascii=False)),
    )

    return report


async def get_latest_report() -> dict | None:
    """Get the most recent real estate report."""
    return await fetch_all(
        "SELECT * FROM daily_reports WHERE report_type='realestate' ORDER BY created_at DESC LIMIT 1"
    )


# ─── 시세 트렌드 API ───

async def get_price_trends(
    district: str | None = None,
    dong: str | None = None,
    deal_type: str = "sale",
    months: int = 12,
) -> list[dict]:
    """Get monthly average price trends from realestate_data.

    Returns rows grouped by year-month with avg price, count, min, max.
    """
    conditions = ["deal_type = ?"]
    params: list = [deal_type]

    if district:
        conditions.append("district = ?")
        params.append(district)
    if dong:
        conditions.append("dong = ?")
        params.append(dong)

    where = " AND ".join(conditions)
    params.append(months)

    sql = f"""
        SELECT
            strftime('%Y-%m', deal_date) AS month,
            district,
            deal_type,
            COUNT(*) AS deal_count,
            ROUND(AVG(price)) AS avg_price,
            MIN(price) AS min_price,
            MAX(price) AS max_price,
            ROUND(AVG(area_m2), 1) AS avg_area
        FROM realestate_data
        WHERE {where}
          AND deal_date IS NOT NULL
          AND deal_date >= date('now', '-' || ? || ' months')
        GROUP BY month, district
        ORDER BY month ASC
    """
    return await fetch_all(sql, tuple(params))


async def get_price_trend_by_apt(
    apt_name: str,
    deal_type: str = "sale",
    months: int = 24,
) -> list[dict]:
    """Get price trend for a specific apartment."""
    sql = """
        SELECT
            strftime('%Y-%m', deal_date) AS month,
            district,
            dong,
            apt_name,
            deal_type,
            COUNT(*) AS deal_count,
            ROUND(AVG(price)) AS avg_price,
            MIN(price) AS min_price,
            MAX(price) AS max_price,
            ROUND(AVG(area_m2), 1) AS avg_area
        FROM realestate_data
        WHERE apt_name LIKE ?
          AND deal_type = ?
          AND deal_date IS NOT NULL
          AND deal_date >= date('now', '-' || ? || ' months')
        GROUP BY month
        ORDER BY month ASC
    """
    return await fetch_all(sql, (f"%{apt_name}%", deal_type, months))


# ─── 지역별 비교 API ───

async def compare_districts(
    districts: list[str] | None = None,
    deal_type: str = "sale",
    months: int = 6,
) -> list[dict]:
    """Compare average prices across districts.

    If districts is None, compares all districts that have data.
    """
    conditions = ["deal_type = ?", "deal_date >= date('now', '-' || ? || ' months')"]
    params: list = [deal_type, months]

    if districts:
        placeholders = ",".join("?" for _ in districts)
        conditions.append(f"district IN ({placeholders})")
        params.extend(districts)

    where = " AND ".join(conditions)

    sql = f"""
        SELECT
            district,
            deal_type,
            COUNT(*) AS deal_count,
            ROUND(AVG(price)) AS avg_price,
            MIN(price) AS min_price,
            MAX(price) AS max_price,
            ROUND(AVG(area_m2), 1) AS avg_area,
            ROUND(AVG(price / NULLIF(area_m2, 0))) AS avg_price_per_m2
        FROM realestate_data
        WHERE {where}
          AND deal_date IS NOT NULL
          AND price IS NOT NULL
        GROUP BY district
        ORDER BY avg_price DESC
    """
    return await fetch_all(sql, tuple(params))


async def get_district_monthly_comparison(
    districts: list[str],
    deal_type: str = "sale",
    months: int = 6,
) -> list[dict]:
    """Compare monthly price trends across multiple districts."""
    placeholders = ",".join("?" for _ in districts)
    params: list = [deal_type, months]
    params.extend(districts)

    sql = f"""
        SELECT
            strftime('%Y-%m', deal_date) AS month,
            district,
            COUNT(*) AS deal_count,
            ROUND(AVG(price)) AS avg_price,
            ROUND(AVG(price / NULLIF(area_m2, 0))) AS avg_price_per_m2
        FROM realestate_data
        WHERE deal_type = ?
          AND deal_date >= date('now', '-' || ? || ' months')
          AND district IN ({placeholders})
          AND deal_date IS NOT NULL
          AND price IS NOT NULL
        GROUP BY month, district
        ORDER BY month ASC, district
    """
    return await fetch_all(sql, tuple(params))


async def get_available_districts() -> list[dict]:
    """Get list of districts that have data, with counts."""
    sql = """
        SELECT
            district,
            COUNT(*) AS total_records,
            COUNT(DISTINCT apt_name) AS apt_count,
            MIN(deal_date) AS earliest,
            MAX(deal_date) AS latest
        FROM realestate_data
        WHERE district IS NOT NULL
        GROUP BY district
        ORDER BY total_records DESC
    """
    return await fetch_all(sql)


# ─── 관심 매물 Watchlist API ───

async def get_watchlist() -> list[dict]:
    """Get all watchlist items with latest price info."""
    sql = """
        SELECT
            w.*,
            (
                SELECT ROUND(AVG(r.price))
                FROM realestate_data r
                WHERE r.district = w.district
                  AND (w.dong IS NULL OR r.dong = w.dong)
                  AND (w.apt_name IS NULL OR r.apt_name = w.apt_name)
                  AND r.deal_type = w.deal_type
                  AND r.deal_date >= date('now', '-3 months')
            ) AS recent_avg_price,
            (
                SELECT COUNT(*)
                FROM realestate_data r
                WHERE r.district = w.district
                  AND (w.dong IS NULL OR r.dong = w.dong)
                  AND (w.apt_name IS NULL OR r.apt_name = w.apt_name)
                  AND r.deal_type = w.deal_type
                  AND r.deal_date >= date('now', '-3 months')
            ) AS recent_deal_count
        FROM realestate_watchlist w
        ORDER BY w.created_at DESC
    """
    return await fetch_all(sql)


async def add_watchlist_item(
    district: str,
    dong: str | None,
    apt_name: str | None,
    deal_type: str = "sale",
    memo: str | None = None,
    target_price: int | None = None,
) -> dict:
    """Add item to watchlist. Returns the created item."""
    item_id = await execute(
        """INSERT INTO realestate_watchlist (district, dong, apt_name, deal_type, memo, target_price)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (district, dong, apt_name, deal_type, memo, target_price),
    )
    return {"id": item_id, "district": district, "dong": dong, "apt_name": apt_name,
            "deal_type": deal_type, "memo": memo, "target_price": target_price}


async def delete_watchlist_item(item_id: int) -> bool:
    """Delete watchlist item by ID."""
    existing = await fetch_one("SELECT id FROM realestate_watchlist WHERE id = ?", (item_id,))
    if not existing:
        return False
    await execute("DELETE FROM realestate_watchlist WHERE id = ?", (item_id,))
    return True


async def get_watchlist_item(item_id: int) -> dict | None:
    """Get a single watchlist item."""
    return await fetch_one("SELECT * FROM realestate_watchlist WHERE id = ?", (item_id,))


# ─── 데이터 조회 ───

async def get_recent_deals(
    district: str | None = None,
    deal_type: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Get recent deal records from realestate_data."""
    conditions = []
    params: list = []

    if district:
        conditions.append("district = ?")
        params.append(district)
    if deal_type:
        conditions.append("deal_type = ?")
        params.append(deal_type)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    sql = f"""
        SELECT * FROM realestate_data
        {where}
        ORDER BY deal_date DESC, recorded_at DESC
        LIMIT ?
    """
    return await fetch_all(sql, tuple(params))
