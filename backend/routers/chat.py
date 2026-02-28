import time
from fastapi import APIRouter
from pydantic import BaseModel
from services.db_service import execute, fetch_all, fetch_one
from services.ollama_service import chat_stream
from services.task_service import task_manager
from services.supervisor_service import classify_intent, execute_plan
from ws.handler import manager as ws_manager
from config import DEFAULT_MODEL, MAX_CONTEXT_MESSAGES

router = APIRouter()

SUPERVISOR_MODEL = "supervisor"


class ChatRequest(BaseModel):
    conversation_id: int | None = None
    message: str
    model: str = DEFAULT_MODEL


@router.get("/conversations")
async def get_conversations():
    rows = await fetch_all(
        "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50"
    )
    return {"conversations": rows}


@router.post("/conversations")
async def create_conversation(title: str = "New Chat"):
    conv_id = await execute(
        "INSERT INTO conversations (title) VALUES (?)", (title,)
    )
    return {"id": conv_id, "title": title}


@router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: int):
    rows = await fetch_all(
        "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
        (conv_id,),
    )
    return {"messages": rows}


@router.post("")
async def chat(req: ChatRequest):
    # Create conversation if needed
    conv_id = req.conversation_id
    if conv_id is None:
        preview = req.message[:30] + ("..." if len(req.message) > 30 else "")
        conv_id = await execute(
            "INSERT INTO conversations (title) VALUES (?)", (preview,)
        )

    # Save user message
    await execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)",
        (conv_id, req.message),
    )

    # Get context messages
    context_rows = await fetch_all(
        """SELECT role, content FROM messages
           WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?""",
        (conv_id, MAX_CONTEXT_MESSAGES),
    )
    messages = [{"role": r["role"], "content": r["content"]} for r in reversed(context_rows)]

    # Supervisor mode
    if req.model == SUPERVISOR_MODEL:
        return await _handle_supervisor(conv_id, req.message)

    # Direct Ollama mode
    return await _handle_ollama(conv_id, req.message, req.model, messages)


async def _handle_supervisor(conv_id: int, message: str) -> dict:
    """PM mode: Claude API classifies intent, delegates to Ollama or responds directly."""
    from services.agent_service import agent_manager

    start = time.time()

    # Step 1: Supervisor classifies intent
    task_id = await task_manager.create("supervisor", f"PM: {message[:50]}", model="haiku")
    await agent_manager.update_status("hq", "working", f"Analyzing: {message[:40]}...")

    await ws_manager.broadcast({
        "type": "chat_token",
        "data": {"conversation_id": conv_id, "token": "[PM thinking...]\n", "done": False},
    })

    plan = await classify_intent(message)

    # Step 2: Execute the plan
    async def ollama_chat_fn(model: str, prompt: str) -> str:
        """Helper to call Ollama for the supervisor."""
        full = ""
        msgs = [{"role": "user", "content": prompt}]
        async for data in chat_stream(model, msgs):
            content = data.get("message", {}).get("content", "")
            if content:
                full += content
                await ws_manager.broadcast({
                    "type": "chat_token",
                    "data": {"conversation_id": conv_id, "token": content, "done": False},
                })
            if data.get("done"):
                break
        return full

    # Broadcast the plan reasoning
    reasoning = plan.get("reasoning", "")
    if reasoning:
        await ws_manager.broadcast({
            "type": "chat_token",
            "data": {"conversation_id": conv_id, "token": f"[Plan: {reasoning}]\n\n", "done": False},
        })

    async def broadcast_token(text: str):
        await ws_manager.broadcast({
            "type": "chat_token",
            "data": {"conversation_id": conv_id, "token": text, "done": False},
        })

    result = await execute_plan(plan, ollama_chat_fn, broadcast_fn=broadcast_token)
    duration_ms = int((time.time() - start) * 1000)

    # Save response
    tokens_info = plan.get("_tokens", {})
    api_model = plan.get("_model", "haiku")
    full_response = result

    input_tokens = tokens_info.get("input", 0)
    output_tokens = tokens_info.get("output", 0)

    msg_id = await execute(
        """INSERT INTO messages
           (conversation_id, role, content, model, tokens_used, duration_ms)
           VALUES (?, 'assistant', ?, ?, ?, ?)""",
        (conv_id, full_response, f"supervisor({api_model})", output_tokens, duration_ms),
    )

    # Track API usage with cost
    cost_usd = (input_tokens / 1_000_000 * 1.0) + (output_tokens / 1_000_000 * 5.0)
    await execute(
        """INSERT INTO api_usage (provider, model, input_tokens, output_tokens, cost_usd, purpose)
           VALUES ('anthropic', ?, ?, ?, ?, 'chat')""",
        (api_model, input_tokens, output_tokens, cost_usd),
    )

    await execute("UPDATE conversations SET updated_at=datetime('now') WHERE id=?", (conv_id,))
    await task_manager.complete(task_id, full_response[:200])
    await agent_manager.update_status("hq", "idle", "", f"Completed: {plan.get('intent', '')} ({duration_ms}ms)")

    await ws_manager.broadcast({
        "type": "chat_complete",
        "data": {"conversation_id": conv_id, "message_id": msg_id, "model": f"supervisor({api_model})", "duration_ms": duration_ms, "tokens": tokens_info.get("output", 0)},
    })

    return {
        "conversation_id": conv_id,
        "message_id": msg_id,
        "content": full_response,
        "model": f"supervisor({api_model})",
        "duration_ms": duration_ms,
        "plan": plan,
    }


async def _handle_ollama(conv_id: int, message: str, model: str, messages: list) -> dict:
    """Direct Ollama chat mode."""
    task_id = await task_manager.create("chat", f"Chat: {message[:50]}", model=model)

    full_response = ""
    start = time.time()
    token_count = 0

    try:
        async for data in chat_stream(model, messages):
            content = data.get("message", {}).get("content", "")
            if content:
                full_response += content
                token_count += 1
                await ws_manager.broadcast({
                    "type": "chat_token",
                    "data": {"conversation_id": conv_id, "token": content, "done": False},
                })
            if data.get("done"):
                break

        duration_ms = int((time.time() - start) * 1000)

        msg_id = await execute(
            """INSERT INTO messages
               (conversation_id, role, content, model, tokens_used, duration_ms)
               VALUES (?, 'assistant', ?, ?, ?, ?)""",
            (conv_id, full_response, model, token_count, duration_ms),
        )

        await execute("UPDATE conversations SET updated_at=datetime('now') WHERE id=?", (conv_id,))
        await task_manager.complete(task_id, full_response[:200])

        await ws_manager.broadcast({
            "type": "chat_complete",
            "data": {"conversation_id": conv_id, "message_id": msg_id, "model": model, "duration_ms": duration_ms, "tokens": token_count},
        })

        return {
            "conversation_id": conv_id,
            "message_id": msg_id,
            "content": full_response,
            "model": model,
            "duration_ms": duration_ms,
            "tokens": token_count,
        }

    except Exception as e:
        await task_manager.fail(task_id, str(e))
        return {"error": str(e), "conversation_id": conv_id}
