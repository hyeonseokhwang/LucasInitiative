import asyncio
import json
from datetime import datetime, timedelta
from services.db_service import execute, fetch_all
from ws.handler import manager as ws_manager


class Scheduler:
    """Simple asyncio-based scheduler that runs jobs on intervals."""

    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._running = False

    def register(self, name: str, interval_hours: float, func, enabled: bool = True):
        """Register a recurring job."""
        self._jobs[name] = {
            "name": name,
            "interval": interval_hours * 3600,  # convert to seconds
            "func": func,
            "enabled": enabled,
            "last_run": None,
            "running": False,
        }

    async def run_job(self, name: str) -> str | None:
        """Manually trigger a job."""
        job = self._jobs.get(name)
        if not job:
            return None

        if job["running"]:
            return "Already running"

        job["running"] = True
        try:
            await ws_manager.broadcast({
                "type": "task_update",
                "data": {"id": 0, "status": "running", "task_type": "scheduler", "description": f"Running: {name}"},
            })

            result = await job["func"]()
            job["last_run"] = datetime.now()

            # Save run record
            await execute(
                """INSERT INTO scheduled_jobs (name, cron, job_type, last_run, next_run)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(name) DO UPDATE SET last_run=?, next_run=?""",
                (name, f"every {job['interval']/3600}h", name,
                 job["last_run"].isoformat(),
                 (job["last_run"] + timedelta(seconds=job["interval"])).isoformat(),
                 job["last_run"].isoformat(),
                 (job["last_run"] + timedelta(seconds=job["interval"])).isoformat()),
            )

            await ws_manager.broadcast({
                "type": "task_update",
                "data": {"id": 0, "status": "completed", "task_type": "scheduler", "description": f"Done: {name}"},
            })

            return result
        except Exception as e:
            await ws_manager.broadcast({
                "type": "task_update",
                "data": {"id": 0, "status": "failed", "task_type": "scheduler", "description": f"Failed: {name} - {e}"},
            })
            return f"Error: {e}"
        finally:
            job["running"] = False

    async def loop(self):
        """Main scheduler loop. Checks every 60 seconds."""
        self._running = True
        print("[Scheduler] Started")

        while self._running:
            now = datetime.now()

            for name, job in self._jobs.items():
                if not job["enabled"]:
                    continue

                should_run = False
                if job["last_run"] is None:
                    # First run: wait 30 seconds after startup
                    should_run = False
                else:
                    elapsed = (now - job["last_run"]).total_seconds()
                    if elapsed >= job["interval"]:
                        should_run = True

                if should_run:
                    asyncio.create_task(self.run_job(name))

            await asyncio.sleep(60)

    def get_status(self) -> list[dict]:
        """Get status of all registered jobs."""
        result = []
        for name, job in self._jobs.items():
            result.append({
                "name": name,
                "interval_hours": job["interval"] / 3600,
                "enabled": job["enabled"],
                "running": job["running"],
                "last_run": job["last_run"].isoformat() if job["last_run"] else None,
            })
        return result

    def stop(self):
        self._running = False


scheduler = Scheduler()
