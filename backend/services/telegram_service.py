"""
Telegram Bot — push notifications + command interface.
Gracefully skips if TELEGRAM_BOT_TOKEN not set.
"""
import asyncio
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_bot = None
_app = None
_enabled = False


async def start():
    """Start Telegram bot. No-op if token not configured."""
    global _bot, _app, _enabled

    if not _TOKEN:
        print("[Telegram] No TELEGRAM_BOT_TOKEN set — Telegram disabled")
        return

    try:
        from telegram import Update, Bot
        from telegram.ext import Application, CommandHandler, MessageHandler, filters

        _app = Application.builder().token(_TOKEN).build()
        _bot = _app.bot

        # Register command handlers
        _app.add_handler(CommandHandler("start", _cmd_start))
        _app.add_handler(CommandHandler("help", _cmd_help))
        _app.add_handler(CommandHandler("status", _cmd_status))
        _app.add_handler(CommandHandler("report", _cmd_report))
        _app.add_handler(CommandHandler("alerts", _cmd_alerts))
        _app.add_handler(CommandHandler("research", _cmd_research))
        _app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_text))

        _enabled = True
        print("[Telegram] Bot started successfully")

        # Start polling (non-blocking)
        await _app.initialize()
        await _app.start()
        await _app.updater.start_polling(drop_pending_updates=True)

        # Keep running until stopped
        while _enabled:
            await asyncio.sleep(1)

    except ImportError:
        print("[Telegram] python-telegram-bot not installed — Telegram disabled")
    except Exception as e:
        print(f"[Telegram] Failed to start: {e}")


async def stop():
    """Stop Telegram bot gracefully."""
    global _enabled
    _enabled = False
    if _app:
        try:
            await _app.updater.stop()
            await _app.stop()
            await _app.shutdown()
        except Exception:
            pass


async def _register_chat(chat_id: str, username: str = ""):
    """Register or update a Telegram subscriber."""
    from services.db_service import execute, fetch_one
    existing = await fetch_one(
        "SELECT id FROM telegram_config WHERE chat_id = ?", (chat_id,)
    )
    if not existing:
        await execute(
            "INSERT INTO telegram_config (chat_id, username) VALUES (?, ?)",
            (chat_id, username),
        )


async def _get_subscribers(alert_type: str = "all") -> list[str]:
    """Get list of chat IDs for subscribers."""
    from services.db_service import fetch_all
    col = {
        "alerts": "alerts_enabled",
        "research": "research_enabled",
        "daily": "daily_enabled",
    }.get(alert_type, None)

    if col:
        rows = await fetch_all(
            f"SELECT chat_id FROM telegram_config WHERE {col} = 1"
        )
    else:
        rows = await fetch_all("SELECT chat_id FROM telegram_config")
    return [r["chat_id"] for r in rows]


async def _send_to_all(text: str, alert_type: str = "all"):
    """Send message to all subscribers of a given type."""
    if not _enabled or not _bot:
        return
    chat_ids = await _get_subscribers(alert_type)
    for cid in chat_ids:
        try:
            # Telegram max message length is 4096
            if len(text) > 4000:
                text = text[:4000] + "\n...(truncated)"
            await _bot.send_message(chat_id=cid, text=text, parse_mode="Markdown")
        except Exception as e:
            print(f"[Telegram] Send error to {cid}: {e}")


# ─── Push Notification Functions (called by other services) ───

async def send_alert(alert_text: str):
    """Send stock alert notification."""
    msg = f"*[Alert]* {alert_text}"
    await _send_to_all(msg, "alerts")


async def send_research_complete(result: dict):
    """Send research completion notification."""
    conf = result.get("confidence", 0)
    conf_emoji = "🟢" if conf >= 0.7 else "🟡" if conf >= 0.4 else "🔴"
    msg = (
        f"*[Research Complete]* {conf_emoji}\n"
        f"*{result.get('title', 'N/A')}*\n"
        f"Confidence: {conf:.0%} | Evidence: {result.get('evidence_count', 0)}\n"
        f"Summary: {result.get('summary', '')[:500]}"
    )
    await _send_to_all(msg, "research")


async def send_daily_summary(report_text: str):
    """Send daily report summary."""
    # Truncate for Telegram
    preview = report_text[:3000] if len(report_text) > 3000 else report_text
    msg = f"*[Daily Report]*\n{preview}"
    await _send_to_all(msg, "daily")


# ─── Command Handlers ───

async def _cmd_start(update, context):
    """Handle /start command — register subscriber."""
    chat_id = str(update.effective_chat.id)
    username = update.effective_user.username or ""
    await _register_chat(chat_id, username)
    await update.message.reply_text(
        "Lucas AI Dashboard connected!\n\n"
        "Commands:\n"
        "/status — System status\n"
        "/report — Latest daily report\n"
        "/alerts — Recent stock alerts\n"
        "/research <topic> — Trigger research\n"
        "/help — Show help"
    )


async def _cmd_help(update, context):
    await update.message.reply_text(
        "*Lucas AI Telegram Bot*\n\n"
        "/status — System & engine status\n"
        "/report — Latest daily report\n"
        "/alerts — Recent stock alerts (last 10)\n"
        "/research <topic> — Start deep research\n"
        "/help — This help message\n\n"
        "You can also type freely to chat with the AI PM.",
        parse_mode="Markdown",
    )


async def _cmd_status(update, context):
    from services.research_service import research_engine
    from services.collector_service import collector

    engine = research_engine.get_status()
    coll = collector.get_stats()

    msg = (
        f"*System Status*\n"
        f"Collector: {'Running' if coll.get('running') else 'Stopped'}\n"
        f"  Stock runs: {coll.get('stock_runs', 0)}\n"
        f"  News runs: {coll.get('news_runs', 0)}\n"
        f"Research Engine: {'Running' if engine.get('running') else 'Stopped'}\n"
        f"  Cycles: {engine.get('cycles', 0)}\n"
        f"  Reports: {engine.get('reports_generated', 0)}\n"
        f"  Current: {engine.get('current_topic') or 'idle'}\n"
        f"  Queue: {engine.get('queue_size', 0)}"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def _cmd_report(update, context):
    from services.db_service import fetch_one
    report = await fetch_one(
        "SELECT title, content FROM daily_reports ORDER BY created_at DESC LIMIT 1"
    )
    if report:
        content = report["content"][:3500]
        await update.message.reply_text(f"*{report['title']}*\n\n{content}", parse_mode="Markdown")
    else:
        await update.message.reply_text("No reports available yet.")


async def _cmd_alerts(update, context):
    from services.collector_service import get_recent_alerts
    alerts = await get_recent_alerts(limit=10)
    if alerts:
        lines = ["*Recent Alerts*\n"]
        for a in alerts:
            lines.append(f"- {a['title']}: {(a.get('content', '') or '')[:100]}")
            lines.append(f"  _{a['created_at']}_\n")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    else:
        await update.message.reply_text("No recent alerts.")


async def _cmd_research(update, context):
    query = " ".join(context.args) if context.args else ""
    if not query:
        await update.message.reply_text("Usage: /research <topic>\nExample: /research Samsung stock analysis")
        return

    from services.research_service import queue_manual
    await queue_manual(query)
    await update.message.reply_text(f"Research queued: *{query}*\nI'll notify you when done.", parse_mode="Markdown")


async def _handle_text(update, context):
    """Forward free text to Supervisor PM for processing."""
    text = update.message.text
    chat_id = str(update.effective_chat.id)

    try:
        from services.supervisor_service import classify_intent, execute_plan
        from services.ollama_service import chat_stream

        plan = await classify_intent(text)

        async def ollama_fn(model, prompt):
            full = ""
            async for chunk in chat_stream(model, [{"role": "user", "content": prompt}]):
                if chunk.get("message", {}).get("content"):
                    full += chunk["message"]["content"]
                if chunk.get("done"):
                    break
            return full

        result = await execute_plan(plan, ollama_fn)
        # Truncate for Telegram
        if len(result) > 4000:
            result = result[:4000] + "\n...(truncated)"
        await update.message.reply_text(result)
    except Exception as e:
        await update.message.reply_text(f"Error: {e}")
