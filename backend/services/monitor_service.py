import psutil
import subprocess
import asyncio
import json
import httpx
from datetime import datetime
from config import OLLAMA_BASE_URL, METRICS_POLL_INTERVAL, METRICS_SAVE_INTERVAL


class MonitorService:
    def __init__(self):
        self.latest: dict = {}
        self._broadcast_fn = None

    def set_broadcast(self, fn):
        self._broadcast_fn = fn

    def get_snapshot(self) -> dict:
        gpu = self._read_gpu()
        mem = psutil.virtual_memory()
        freq = psutil.cpu_freq()
        try:
            disk = psutil.disk_usage("G:\\")
            disk_info = {
                "used_gb": round(disk.used / (1024**3), 1),
                "total_gb": round(disk.total / (1024**3), 1),
            }
        except Exception:
            disk_info = {"used_gb": 0, "total_gb": 0}

        return {
            "cpu": {
                "percent": psutil.cpu_percent(),
                "freq_mhz": int(freq.current) if freq else 0,
                "cores": psutil.cpu_count(logical=False),
                "threads": psutil.cpu_count(logical=True),
            },
            "ram": {
                "used_gb": round(mem.used / (1024**3), 1),
                "total_gb": round(mem.total / (1024**3), 1),
                "percent": mem.percent,
            },
            "gpu": gpu,
            "disk": disk_info,
            "uptime_seconds": int(psutil.boot_time()),
            "timestamp": datetime.now().isoformat(),
        }

    def _read_gpu(self) -> dict:
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )
            parts = [x.strip() for x in result.stdout.strip().split(",")]
            return {
                "name": parts[0],
                "util_percent": int(parts[1]),
                "mem_used_mb": int(parts[2]),
                "mem_total_mb": int(parts[3]),
                "temp_c": int(parts[4]),
                "power_w": float(parts[5]),
            }
        except Exception:
            return {
                "name": "Unknown",
                "util_percent": 0,
                "mem_used_mb": 0,
                "mem_total_mb": 0,
                "temp_c": 0,
                "power_w": 0,
            }

    async def check_ollama(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                models = resp.json().get("models", [])
                ps_resp = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
                running = ps_resp.json().get("models", [])
                return {
                    "running": True,
                    "models_count": len(models),
                    "loaded_models": [m.get("name", "") for m in running],
                }
        except Exception:
            return {"running": False, "models_count": 0, "loaded_models": []}

    async def poll_loop(self):
        save_counter = 0
        while True:
            try:
                snapshot = self.get_snapshot()
                ollama = await self.check_ollama()
                snapshot["ollama"] = ollama
                self.latest = snapshot

                if self._broadcast_fn:
                    await self._broadcast_fn({"type": "metrics", "data": snapshot})

                save_counter += 1
                if save_counter >= (METRICS_SAVE_INTERVAL // METRICS_POLL_INTERVAL):
                    await self._save_to_db(snapshot)
                    save_counter = 0

            except Exception as e:
                print(f"[Monitor] Error: {e}")

            await asyncio.sleep(METRICS_POLL_INTERVAL)

    async def _save_to_db(self, snapshot: dict):
        from services.db_service import execute

        gpu = snapshot.get("gpu", {})
        ram = snapshot.get("ram", {})
        ollama = snapshot.get("ollama", {})
        await execute(
            """INSERT INTO metrics
               (cpu_percent, ram_used_gb, ram_total_gb, gpu_util, gpu_mem_used_mb,
                gpu_mem_total_mb, gpu_temp_c, ollama_running, active_model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                snapshot.get("cpu", {}).get("percent", 0),
                ram.get("used_gb", 0),
                ram.get("total_gb", 0),
                gpu.get("util_percent", 0),
                gpu.get("mem_used_mb", 0),
                gpu.get("mem_total_mb", 0),
                gpu.get("temp_c", 0),
                1 if ollama.get("running") else 0,
                ",".join(ollama.get("loaded_models", [])) or None,
            ),
        )


monitor = MonitorService()
