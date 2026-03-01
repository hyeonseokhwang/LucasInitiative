from fastapi import APIRouter, Query
from services.log_service import log_service

router = APIRouter()


@router.get("")
async def get_logs(
    level: str | None = Query(default=None, description="Filter by level: INFO, WARN, ERROR, DEBUG"),
    lines: int = Query(default=100, ge=1, le=500),
    search: str | None = Query(default=None, description="Keyword search"),
):
    """Get server logs with optional filters."""
    logs = log_service.get_logs(lines=lines, level=level, search=search)
    return {"logs": logs, "count": len(logs)}


@router.get("/stats")
async def get_log_stats():
    """Get log level statistics."""
    return log_service.get_stats()
