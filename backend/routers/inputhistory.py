"""
Input History Router — API endpoints for Lucas's input/request history.
"""

from fastapi import APIRouter, Query
from typing import Optional
from services.inputhistory_service import (
    get_input_history,
    get_input_detail,
    get_commander_log,
    get_stats,
)

router = APIRouter()


@router.get("")
async def list_history(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None, description="command|instruct|report|other"),
):
    """List all input history entries with filtering and pagination."""
    return await get_input_history(
        limit=limit,
        offset=offset,
        search=search,
        date_filter=date,
        status_filter=status,
        type_filter=type,
    )


@router.get("/stats")
async def history_stats():
    """Get summary statistics for the inbox."""
    return await get_stats()


@router.get("/commander-log")
async def commander_log():
    """Get parsed commander log entries."""
    return await get_commander_log()


@router.get("/{file_id}")
async def history_detail(file_id: str):
    """Get full detail of a single inbox entry."""
    detail = await get_input_detail(file_id)
    if detail is None:
        return {"error": "not_found"}
    return detail
