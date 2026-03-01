from fastapi import APIRouter, Query
from pydantic import BaseModel
from services.realestate_service import (
    get_price_trends, get_price_trend_by_apt,
    compare_districts, get_district_monthly_comparison, get_available_districts,
    get_watchlist, add_watchlist_item, delete_watchlist_item, get_watchlist_item,
    get_recent_deals,
    SEOUL_DISTRICTS,
)

router = APIRouter()


# ─── Pydantic Models ───

class WatchlistAdd(BaseModel):
    district: str
    dong: str | None = None
    apt_name: str | None = None
    deal_type: str = "sale"
    memo: str | None = None
    target_price: int | None = None


class DistrictCompareRequest(BaseModel):
    districts: list[str]
    deal_type: str = "sale"
    months: int = 6


# ─── 시세 트렌드 ───

@router.get("/trends")
async def price_trends(
    district: str | None = None,
    dong: str | None = None,
    deal_type: str = "sale",
    months: int = 12,
):
    """Get monthly price trends, optionally filtered by district/dong."""
    data = await get_price_trends(district, dong, deal_type, months)
    return {"trends": data, "filters": {"district": district, "dong": dong, "deal_type": deal_type, "months": months}}


@router.get("/trends/apt")
async def apt_price_trend(
    apt_name: str = Query(..., description="Apartment name (partial match)"),
    deal_type: str = "sale",
    months: int = 24,
):
    """Get price trend for a specific apartment."""
    data = await get_price_trend_by_apt(apt_name, deal_type, months)
    return {"trends": data, "apt_name": apt_name}


# ─── 지역별 비교 ───

@router.get("/compare")
async def district_comparison(
    districts: str | None = Query(None, description="Comma-separated districts (e.g. 강남구,서초구)"),
    deal_type: str = "sale",
    months: int = 6,
):
    """Compare average prices across districts."""
    district_list = [d.strip() for d in districts.split(",")] if districts else None
    data = await compare_districts(district_list, deal_type, months)
    return {"comparison": data, "deal_type": deal_type, "months": months}


@router.post("/compare/monthly")
async def monthly_comparison(req: DistrictCompareRequest):
    """Compare monthly price trends across selected districts."""
    data = await get_district_monthly_comparison(req.districts, req.deal_type, req.months)
    return {"comparison": data, "districts": req.districts}


@router.get("/districts")
async def list_districts():
    """List all districts that have data."""
    data = await get_available_districts()
    return {"districts": data, "seoul_major": SEOUL_DISTRICTS}


# ─── 관심 매물 Watchlist ───

@router.get("/watchlist")
async def watchlist_list():
    """Get all watchlist items with recent price info."""
    items = await get_watchlist()
    return {"watchlist": items}


@router.post("/watchlist")
async def watchlist_add(item: WatchlistAdd):
    """Add item to watchlist."""
    result = await add_watchlist_item(
        item.district, item.dong, item.apt_name,
        item.deal_type, item.memo, item.target_price,
    )
    return result


@router.get("/watchlist/{item_id}")
async def watchlist_get(item_id: int):
    """Get a single watchlist item."""
    item = await get_watchlist_item(item_id)
    if not item:
        return {"error": "Watchlist item not found"}
    return item


@router.delete("/watchlist/{item_id}")
async def watchlist_delete(item_id: int):
    """Remove item from watchlist."""
    success = await delete_watchlist_item(item_id)
    if not success:
        return {"error": "Watchlist item not found"}
    return {"deleted": True, "id": item_id}


# ─── 최근 거래 데이터 ───

@router.get("/deals")
async def recent_deals(
    district: str | None = None,
    deal_type: str | None = None,
    limit: int = 50,
):
    """Get recent deal records."""
    data = await get_recent_deals(district, deal_type, limit)
    return {"deals": data, "count": len(data)}
