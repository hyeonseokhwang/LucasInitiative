import httpx
import json
from typing import AsyncGenerator
from config import OLLAMA_BASE_URL, CHAT_TIMEOUT


async def list_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        return resp.json().get("models", [])


async def get_running_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
        return resp.json().get("models", [])


async def chat_stream(
    model: str, messages: list[dict]
) -> AsyncGenerator[dict, None]:
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
