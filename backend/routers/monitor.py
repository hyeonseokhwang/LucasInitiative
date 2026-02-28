from fastapi import APIRouter
from services.monitor_service import monitor

router = APIRouter()


@router.get("/snapshot")
async def get_snapshot():
    if monitor.latest:
        return monitor.latest
    return monitor.get_snapshot()
