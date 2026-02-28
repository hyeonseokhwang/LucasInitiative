from fastapi import APIRouter
from pydantic import BaseModel
from services.schedule_service import (
    create_schedule, list_schedules, update_schedule, delete_schedule, get_upcoming,
)

router = APIRouter()


class ScheduleCreate(BaseModel):
    title: str
    start_at: str
    end_at: str | None = None
    description: str | None = None
    all_day: bool = False
    category: str = "general"
    remind_at: str | None = None


class ScheduleUpdate(BaseModel):
    title: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    description: str | None = None
    all_day: bool | None = None
    category: str | None = None
    remind_at: str | None = None
    status: str | None = None


@router.get("")
async def get_schedules(from_date: str = None, to_date: str = None, status: str = "active"):
    rows = await list_schedules(from_date=from_date, to_date=to_date, status=status)
    return {"schedules": rows}


@router.post("")
async def add_schedule(req: ScheduleCreate):
    item = await create_schedule(**req.model_dump())
    return item


@router.put("/{schedule_id}")
async def edit_schedule(schedule_id: int, req: ScheduleUpdate):
    item = await update_schedule(schedule_id, **req.model_dump(exclude_none=True))
    return item


@router.delete("/{schedule_id}")
async def remove_schedule(schedule_id: int):
    await delete_schedule(schedule_id)
    return {"ok": True}


@router.get("/upcoming")
async def upcoming(hours: int = 24):
    rows = await get_upcoming(hours=hours)
    return {"schedules": rows}
