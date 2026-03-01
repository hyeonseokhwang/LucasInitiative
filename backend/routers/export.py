from fastapi import APIRouter
from fastapi.responses import Response
from services.export_service import (
    export_stocks_csv,
    export_realestate_csv,
    export_research_md,
    export_expenses_csv,
)

router = APIRouter()


@router.get("/stocks")
async def export_stocks(format: str = "csv", market: str = "all", start: str = None, end: str = None):
    """Export stock data as CSV."""
    data = await export_stocks_csv(market=market, start=start, end=end)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stocks.csv"},
    )


@router.get("/realestate")
async def export_realestate(format: str = "csv", district: str = None, deal_type: str = None):
    """Export real estate data as CSV."""
    data = await export_realestate_csv(district=district, deal_type=deal_type)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=realestate.csv"},
    )


@router.get("/research")
async def export_research(format: str = "md"):
    """Export research reports as Markdown."""
    data = await export_research_md()
    return Response(
        content=data,
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=research.md"},
    )


@router.get("/expenses")
async def export_expenses(format: str = "csv", start: str = None, end: str = None, category: str = None):
    """Export expense data as CSV."""
    data = await export_expenses_csv(from_date=start, to_date=end, category=category)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expenses.csv"},
    )
