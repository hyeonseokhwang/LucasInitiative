import json
from datetime import datetime
from services.db_service import execute, fetch_all
from services.crawl_service import search_web


# 서울 주요 구
SEOUL_DISTRICTS = [
    "강남구", "서초구", "송파구", "강동구", "마포구",
    "용산구", "성동구", "광진구", "영등포구", "동작구",
]


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

    # Search for overall Seoul market
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

    # Save report and raw data
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
