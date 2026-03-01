from fastapi import APIRouter, Query
from services.monitor_service import monitor
from services.db_service import fetch_all

router = APIRouter()


@router.get("/snapshot")
async def get_snapshot():
    if monitor.latest:
        return monitor.latest
    return monitor.get_snapshot()


@router.get("/history")
async def get_history(hours: int = Query(default=24, ge=1, le=168)):
    """Get metrics history for charts. Max 168 hours (7 days)."""
    rows = await fetch_all(
        """SELECT cpu_percent, ram_used_gb, ram_total_gb,
                  gpu_util, gpu_mem_used_mb, gpu_mem_total_mb,
                  gpu_temp_c, ollama_running, active_model, recorded_at
           FROM metrics
           WHERE recorded_at >= datetime('now', ? || ' hours')
           ORDER BY recorded_at ASC""",
        (f"-{hours}",),
    )
    return {"history": rows, "count": len(rows)}


@router.get("/gpu-detail")
async def get_gpu_detail():
    """GPU detail: current snapshot + Ollama model VRAM + GPU processes."""
    gpu = monitor._read_gpu()
    ollama_vram = await monitor.get_ollama_model_vram()
    gpu_procs = monitor.get_gpu_processes()
    return {
        "gpu": gpu,
        "ollama_models": ollama_vram,
        "gpu_processes": gpu_procs,
    }


@router.get("/processes")
async def get_processes(limit: int = Query(default=15, ge=5, le=50)):
    """Top processes by memory usage."""
    return {"processes": monitor.get_top_processes(limit)}


@router.get("/disk-detail")
async def get_disk_detail():
    """Disk usage for key paths and drives."""
    return {"disk": monitor.get_disk_detail()}
