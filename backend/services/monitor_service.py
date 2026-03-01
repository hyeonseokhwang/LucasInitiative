import psutil
import subprocess
import asyncio
import json
import os
import httpx
from datetime import datetime
from pathlib import Path
from config import OLLAMA_BASE_URL, METRICS_POLL_INTERVAL, METRICS_SAVE_INTERVAL, BASE_DIR


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

    def get_gpu_processes(self) -> list[dict]:
        """Get per-process GPU memory usage via nvidia-smi."""
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-compute-apps=pid,used_memory,name",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=5,
            )
            procs = []
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = [x.strip() for x in line.split(",")]
                if len(parts) >= 3:
                    procs.append({
                        "pid": int(parts[0]),
                        "gpu_mem_mb": int(parts[1]),
                        "name": parts[2].split("\\")[-1].split("/")[-1],
                    })
            return procs
        except Exception:
            return []

    def get_top_processes(self, limit: int = 15) -> list[dict]:
        """Get top processes by memory usage, with CPU percent."""
        target_names = {"ollama", "python", "python3", "pythonw", "node", "uvicorn", "gunicorn"}
        procs: list[dict] = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info", "memory_percent"]):
            try:
                info = p.info
                name_lower = (info["name"] or "").lower().replace(".exe", "")
                mem_info = info.get("memory_info")
                mem_mb = round(mem_info.rss / (1024 ** 2), 1) if mem_info else 0
                procs.append({
                    "pid": info["pid"],
                    "name": info["name"] or "unknown",
                    "cpu_percent": round(info.get("cpu_percent") or 0, 1),
                    "mem_mb": mem_mb,
                    "mem_percent": round(info.get("memory_percent") or 0, 1),
                    "is_key": name_lower in target_names,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        # Sort: key processes first, then by mem descending
        procs.sort(key=lambda x: (not x["is_key"], -x["mem_mb"]))
        return procs[:limit]

    def get_disk_detail(self) -> dict:
        """Get disk usage for key paths."""
        paths_to_check = {
            "ollama_models": os.environ.get("OLLAMA_MODELS", os.path.expanduser("~/.ollama/models")),
            "database": str(BASE_DIR / "db"),
            "frontend_dist": str(BASE_DIR.parent / "frontend" / "dist"),
        }
        result = {}
        for key, path in paths_to_check.items():
            try:
                total_size = 0
                p = Path(path)
                if p.exists():
                    if p.is_file():
                        total_size = p.stat().st_size
                    else:
                        for f in p.rglob("*"):
                            if f.is_file():
                                total_size += f.stat().st_size
                result[key] = {
                    "path": path,
                    "size_mb": round(total_size / (1024 ** 2), 1),
                    "size_gb": round(total_size / (1024 ** 3), 2),
                    "exists": p.exists(),
                }
            except Exception:
                result[key] = {"path": path, "size_mb": 0, "size_gb": 0, "exists": False}

        # Drive-level info
        for drive in ["C:\\", "E:\\", "G:\\"]:
            try:
                usage = psutil.disk_usage(drive)
                result[f"drive_{drive[0].lower()}"] = {
                    "path": drive,
                    "used_gb": round(usage.used / (1024 ** 3), 1),
                    "total_gb": round(usage.total / (1024 ** 3), 1),
                    "free_gb": round(usage.free / (1024 ** 3), 1),
                    "percent": round(usage.percent, 1),
                }
            except Exception:
                pass
        return result

    async def get_ollama_model_vram(self) -> list[dict]:
        """Get VRAM usage per loaded Ollama model via /api/ps."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
                models = resp.json().get("models", [])
                result = []
                for m in models:
                    size_vram = m.get("size_vram", 0)
                    size = m.get("size", 0)
                    result.append({
                        "name": m.get("name", "unknown"),
                        "size_vram_mb": round(size_vram / (1024 ** 2), 1) if size_vram else 0,
                        "size_total_mb": round(size / (1024 ** 2), 1) if size else 0,
                        "digest": m.get("digest", "")[:12],
                        "expires_at": m.get("expires_at", ""),
                    })
                return result
        except Exception:
            return []

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
