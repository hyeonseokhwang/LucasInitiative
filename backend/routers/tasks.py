from fastapi import APIRouter
from services.task_service import task_manager

router = APIRouter()


@router.get("")
async def get_tasks(limit: int = 20):
    tasks = await task_manager.get_recent(limit)
    return {"tasks": tasks}
