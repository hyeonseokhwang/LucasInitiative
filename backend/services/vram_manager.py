"""
VRAM Manager — automatic Ollama model load/unload for GPU resource management.

Prevents VRAM conflicts between Whisper and LLM models.
RTX 4090: 24GB VRAM total.
"""
import asyncio
import json
import httpx
from datetime import datetime
from config import OLLAMA_BASE_URL, DEFAULT_MODEL


# VRAM estimates (approximate, in GB)
VRAM_ESTIMATES = {
    "qwen2.5:14b": 10.0,
    "deepseek-r1:8b": 6.0,
    "gemma2:2b": 2.0,
    "llama3.2:3b": 2.5,
    "phi3:mini": 2.5,
    "whisper-large-v3": 3.0,
}

TOTAL_VRAM_GB = 24.0
VRAM_SAFETY_MARGIN_GB = 2.0  # Keep 2GB free


class VRAMManager:
    """Manages Ollama model loading/unloading for optimal VRAM usage."""

    def __init__(self):
        self._lock = asyncio.Lock()
        self._last_action = None
        self._stats = {
            "loads": 0,
            "unloads": 0,
            "conflicts_prevented": 0,
            "started_at": None,
        }

    async def get_loaded_models(self) -> list[dict]:
        """Get currently loaded Ollama models."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
                data = resp.json()
                models = []
                for m in data.get("models", []):
                    models.append({
                        "name": m["name"],
                        "size_gb": round(m.get("size_vram", m.get("size", 0)) / (1024**3), 1),
                        "expires_at": m.get("expires_at", ""),
                    })
                return models
        except Exception as e:
            print(f"[VRAMManager] Error getting loaded models: {e}")
            return []

    async def get_vram_usage(self) -> dict:
        """Get current VRAM usage summary."""
        models = await self.get_loaded_models()
        used = sum(m["size_gb"] for m in models)
        return {
            "total_gb": TOTAL_VRAM_GB,
            "used_gb": round(used, 1),
            "free_gb": round(TOTAL_VRAM_GB - used, 1),
            "models": models,
            "can_load_default": used + VRAM_ESTIMATES.get(DEFAULT_MODEL, 10) < TOTAL_VRAM_GB - VRAM_SAFETY_MARGIN_GB,
        }

    async def unload_model(self, model_name: str) -> bool:
        """Unload a specific model from VRAM."""
        async with self._lock:
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{OLLAMA_BASE_URL}/api/generate",
                        json={
                            "model": model_name,
                            "keep_alive": "0s",
                            "prompt": "hi",
                            "stream": False,
                        },
                    )
                    self._stats["unloads"] += 1
                    self._last_action = f"unload:{model_name}:{datetime.now().isoformat()}"
                    print(f"[VRAMManager] Unloaded {model_name}")
                    return True
            except Exception as e:
                print(f"[VRAMManager] Failed to unload {model_name}: {e}")
                return False

    async def unload_all(self) -> int:
        """Unload all loaded models. Returns count of unloaded models."""
        models = await self.get_loaded_models()
        count = 0
        for m in models:
            if await self.unload_model(m["name"]):
                count += 1
        return count

    async def load_model(self, model_name: str, keep_alive: str = "30m") -> bool:
        """Load a model into VRAM. Auto-unloads others if needed."""
        async with self._lock:
            # Check available VRAM
            needed = VRAM_ESTIMATES.get(model_name, 10.0)
            vram = await self.get_vram_usage()

            if vram["free_gb"] < needed + VRAM_SAFETY_MARGIN_GB:
                # Need to free VRAM
                print(f"[VRAMManager] Need {needed}GB, only {vram['free_gb']}GB free. Unloading models...")
                self._stats["conflicts_prevented"] += 1

                # Unload all except the requested model
                for m in vram["models"]:
                    if m["name"] != model_name:
                        await self.unload_model(m["name"])
                        await asyncio.sleep(1)

            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        f"{OLLAMA_BASE_URL}/api/generate",
                        json={
                            "model": model_name,
                            "keep_alive": keep_alive,
                            "prompt": "hi",
                            "stream": False,
                            "options": {"num_predict": 1},
                        },
                    )
                    self._stats["loads"] += 1
                    self._last_action = f"load:{model_name}:{datetime.now().isoformat()}"
                    print(f"[VRAMManager] Loaded {model_name} (keep_alive={keep_alive})")
                    return True
            except Exception as e:
                print(f"[VRAMManager] Failed to load {model_name}: {e}")
                return False

    async def ensure_model(self, model_name: str = None, keep_alive: str = "30m") -> bool:
        """Ensure a model is loaded, loading it if necessary."""
        if model_name is None:
            model_name = DEFAULT_MODEL

        models = await self.get_loaded_models()
        loaded_names = [m["name"] for m in models]

        if model_name in loaded_names:
            return True

        return await self.load_model(model_name, keep_alive)

    async def prepare_for_whisper(self) -> dict:
        """Prepare VRAM for Whisper by unloading all Ollama models.
        Returns info about what was unloaded for later restoration."""
        models = await self.get_loaded_models()
        unloaded = []

        for m in models:
            if await self.unload_model(m["name"]):
                unloaded.append(m["name"])

        self._stats["conflicts_prevented"] += 1
        return {
            "unloaded": unloaded,
            "timestamp": datetime.now().isoformat(),
        }

    async def restore_after_whisper(self, restore_info: dict = None) -> bool:
        """Restore default model after Whisper is done."""
        model = DEFAULT_MODEL
        if restore_info and restore_info.get("unloaded"):
            # Restore the first model that was unloaded (usually the main one)
            model = restore_info["unloaded"][0]

        return await self.load_model(model)

    def get_stats(self) -> dict:
        return {
            **self._stats,
            "last_action": self._last_action,
        }


# Singleton
vram_manager = VRAMManager()
