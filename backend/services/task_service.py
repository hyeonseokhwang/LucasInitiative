import asyncio
from datetime import datetime
from services.db_service import execute, fetch_all, fetch_one


class TaskManager:
    def __init__(self):
        self._running_tasks: dict[int, asyncio.Task] = {}
        self._broadcast_fn = None

    def set_broadcast(self, fn):
        self._broadcast_fn = fn

    async def create(self, task_type: str, description: str, model: str = None) -> int:
        now = datetime.now().isoformat()
        task_id = await execute(
            """INSERT INTO tasks (type, status, description, model, started_at)
               VALUES (?, 'running', ?, ?, ?)""",
            (task_type, description, model, now),
        )
        await self._broadcast_update(task_id, "running", task_type, description)
        return task_id

    async def complete(self, task_id: int, output_summary: str = None):
        now = datetime.now().isoformat()
        await execute(
            "UPDATE tasks SET status='completed', output_summary=?, completed_at=? WHERE id=?",
            (output_summary[:500] if output_summary else None, now, task_id),
        )
        await self._broadcast_update(task_id, "completed")

    async def fail(self, task_id: int, error: str):
        now = datetime.now().isoformat()
        await execute(
            "UPDATE tasks SET status='failed', error=?, completed_at=? WHERE id=?",
            (error[:500], now, task_id),
        )
        await self._broadcast_update(task_id, "failed")

    async def get_recent(self, limit: int = 20) -> list[dict]:
        return await fetch_all(
            "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
        )

    async def _broadcast_update(
        self, task_id: int, status: str, task_type: str = None, description: str = None
    ):
        if self._broadcast_fn:
            await self._broadcast_fn(
                {
                    "type": "task_update",
                    "data": {
                        "id": task_id,
                        "status": status,
                        "task_type": task_type,
                        "description": description,
                    },
                }
            )


task_manager = TaskManager()
