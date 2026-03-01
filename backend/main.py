import sys
from pathlib import Path

# Add backend dir to path so imports work
sys.path.insert(0, str(Path(__file__).parent))

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from fastapi.responses import JSONResponse
from config import HOST, PORT, STATIC_DIR
from routers import chat, models, monitor, tasks, schedule, expense, usage, reports, agents, realestate, notifications, logs, export, inputhistory
from routers import research as research_router
from routers import trends as trends_router
from routers import dashboard as dashboard_router
from ws.handler import router as ws_router, manager as ws_manager
from services.db_service import init_db, close_db
from services.monitor_service import monitor as monitor_svc
from services.log_service import log_service
from services.task_service import task_manager
from services.scheduler_service import scheduler
from services.report_service import generate_daily_report
from services.collector_service import collector
from services.research_service import research_engine
from services.research_enhanced_service import run_scheduled_research
from services import telegram_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — set up log capture first
    log_service.setup()
    print("[Lucas AI] Initializing database...")
    await init_db()

    # Wire broadcast functions
    monitor_svc.set_broadcast(ws_manager.broadcast)
    task_manager.set_broadcast(ws_manager.broadcast)

    # Start monitoring loop
    print("[Lucas AI] Starting monitor loop...")
    monitor_task = asyncio.create_task(monitor_svc.poll_loop())

    # Register and start scheduler
    scheduler.register("daily_report", interval_hours=24, func=generate_daily_report)
    scheduler.register("research_schedule", interval_hours=12, func=run_scheduled_research)
    print("[Lucas AI] Starting scheduler (daily report 24h, research schedule 12h)...")
    scheduler_task = asyncio.create_task(scheduler.loop())

    # Start background collector
    print("[Lucas AI] Starting background collector...")
    collector_task = asyncio.create_task(collector.start())

    # Start research engine
    print("[Lucas AI] Starting research engine...")
    research_task = asyncio.create_task(research_engine.start())

    # Start Telegram bot (graceful skip if no token)
    print("[Lucas AI] Starting Telegram bot...")
    telegram_task = asyncio.create_task(telegram_service.start())

    print(f"[Lucas AI] Dashboard ready at http://localhost:{PORT}")
    print(f"[Lucas AI] WebSocket at ws://localhost:{PORT}/ws")

    yield

    # Shutdown
    monitor_task.cancel()
    scheduler.stop()
    scheduler_task.cancel()
    collector.stop()
    collector_task.cancel()
    research_engine.stop()
    research_task.cancel()
    await telegram_service.stop()
    telegram_task.cancel()
    await close_db()
    print("[Lucas AI] Shutdown complete.")


app = FastAPI(title="Lucas AI Dashboard", lifespan=lifespan)

# Global exception handler — catch unhandled errors gracefully
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    error_msg = str(exc)
    print(f"[Lucas AI] Unhandled error on {request.url.path}: {error_msg}")
    traceback.print_exc()
    # Log to notifications (best-effort)
    try:
        from services.notification_service import notify_system_error
        await notify_system_error(request.url.path, error_msg[:500])
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": error_msg[:200], "path": request.url.path},
    )

# Middleware — API key auth (pass-through if DASHBOARD_API_KEY not set)
from middleware.auth import APIKeyMiddleware
app.add_middleware(APIKeyMiddleware)

# API routes
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(monitor.router, prefix="/api/monitor", tags=["monitor"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(schedule.router, prefix="/api/schedules", tags=["schedules"])
app.include_router(expense.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(usage.router, prefix="/api/usage", tags=["usage"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(realestate.router, prefix="/api/realestate", tags=["realestate"])
app.include_router(research_router.router, prefix="/api/research", tags=["research"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(inputhistory.router, prefix="/api/inputhistory", tags=["inputhistory"])
app.include_router(trends_router.router, prefix="/api/trends", tags=["trends"])
app.include_router(dashboard_router.router, prefix="/api/dashboard", tags=["dashboard"])

# WebSocket
app.include_router(ws_router)


# Health check
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "Lucas AI Dashboard",
        "ws_clients": ws_manager.count,
    }


# Data integrity check
@app.get("/api/integrity")
async def integrity_check():
    from services.integrity_checker import check_integrity
    return await check_integrity()


# Structured log stats
@app.get("/api/error-log")
async def error_log():
    from services.structured_logger import structured_logger
    return structured_logger.get_stats()


# Serve React frontend (only if built)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
