import asyncio
import httpx
import json
from typing import AsyncGenerator
from config import OLLAMA_BASE_URL, CHAT_TIMEOUT


_MAX_RETRIES = 3
_RETRY_DELAY = 2  # seconds


async def _retry_request(func, *args, retries: int = _MAX_RETRIES, **kwargs):
    """Generic retry wrapper for Ollama API calls."""
    last_error = None
    for attempt in range(retries):
        try:
            return await func(*args, **kwargs)
        except (httpx.ConnectError, httpx.TimeoutException, ConnectionError) as e:
            last_error = e
            if attempt < retries - 1:
                wait = _RETRY_DELAY * (attempt + 1)
                print(f"[Ollama] Connection failed (attempt {attempt + 1}/{retries}), retrying in {wait}s: {e}")
                await asyncio.sleep(wait)
    print(f"[Ollama] All {retries} attempts failed: {last_error}")
    raise last_error


async def is_available() -> bool:
    """Check if Ollama is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def list_models() -> list[dict]:
    async def _fetch():
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return resp.json().get("models", [])
    try:
        return await _retry_request(_fetch)
    except Exception as e:
        print(f"[Ollama] list_models failed: {e}")
        return []


async def get_running_models() -> list[dict]:
    async def _fetch():
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
            return resp.json().get("models", [])
    try:
        return await _retry_request(_fetch)
    except Exception as e:
        print(f"[Ollama] get_running_models failed: {e}")
        return []


async def warmup_model(model: str) -> dict:
    """Load a model into VRAM by sending a minimal generate request."""
    async def _fetch():
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model, "prompt": "", "stream": False},
            )
            return resp.json()
    try:
        return await _retry_request(_fetch)
    except Exception as e:
        print(f"[Ollama] warmup_model failed for {model}: {e}")
        return {"error": str(e)}


async def show_model(model: str) -> dict:
    """Get model info (parameters, template, etc.)."""
    async def _fetch():
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/show",
                json={"name": model},
            )
            return resp.json()
    try:
        return await _retry_request(_fetch)
    except Exception as e:
        print(f"[Ollama] show_model failed for {model}: {e}")
        return {"error": str(e)}


async def chat_stream(
    model: str, messages: list[dict]
) -> AsyncGenerator[dict, None]:
    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={"model": model, "messages": messages, "stream": True},
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                yield data
                            except json.JSONDecodeError:
                                continue
            return  # success
        except (httpx.ConnectError, httpx.TimeoutException, ConnectionError) as e:
            last_error = e
            if attempt < _MAX_RETRIES - 1:
                wait = _RETRY_DELAY * (attempt + 1)
                print(f"[Ollama] chat_stream failed (attempt {attempt + 1}/{_MAX_RETRIES}), retrying in {wait}s: {e}")
                await asyncio.sleep(wait)
    # All retries exhausted — yield an error chunk
    yield {"message": {"content": f"\n\n[Ollama connection failed after {_MAX_RETRIES} retries: {last_error}]"}, "done": True}
