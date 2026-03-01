"""
Structured Logger — JSON-formatted logs with automatic error alerting.
Wraps Python logging with structured output and auto-notification on errors.
"""
import json
import logging
import traceback
from datetime import datetime
from pathlib import Path
from config import BASE_DIR

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

_LOG_FILE = LOG_DIR / f"dashboard-{datetime.now().strftime('%Y-%m-%d')}.jsonl"


class StructuredLogger:
    """Structured JSON logger with file output and auto-alerts."""

    def __init__(self, name: str = "lucas-dashboard"):
        self.name = name
        self._error_count = 0
        self._warn_count = 0
        self._recent_errors: list[dict] = []

    def _write(self, level: str, message: str, extra: dict | None = None):
        entry = {
            "ts": datetime.now().isoformat(),
            "level": level,
            "logger": self.name,
            "msg": message,
        }
        if extra:
            entry["extra"] = extra

        # Append to daily log file
        try:
            with open(_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def info(self, message: str, **extra):
        self._write("INFO", message, extra or None)

    def warn(self, message: str, **extra):
        self._warn_count += 1
        self._write("WARN", message, extra or None)

    def error(self, message: str, exc: Exception | None = None, **extra):
        self._error_count += 1
        if exc:
            extra["traceback"] = traceback.format_exception(type(exc), exc, exc.__traceback__)[-3:]
        self._write("ERROR", message, extra or None)

        # Store for API access
        err_entry = {
            "time": datetime.now().isoformat(),
            "message": message,
            "extra": extra,
        }
        self._recent_errors.append(err_entry)
        if len(self._recent_errors) > 50:
            self._recent_errors = self._recent_errors[-50:]

        # Auto-alert: create notification (fire-and-forget)
        self._auto_alert(message, extra)

    def _auto_alert(self, message: str, extra: dict):
        """Create a notification for errors (non-blocking)."""
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._create_alert(message, extra))
        except RuntimeError:
            pass  # No event loop running

    async def _create_alert(self, message: str, extra: dict):
        try:
            from services.notification_service import create_notification
            await create_notification(
                title=f"[Error] {message[:100]}",
                message=json.dumps(extra, ensure_ascii=False, default=str)[:500] if extra else None,
                ntype="error",
                metadata={"source": "structured_logger", "auto": True},
            )
        except Exception:
            pass

    def get_stats(self) -> dict:
        return {
            "error_count": self._error_count,
            "warn_count": self._warn_count,
            "recent_errors": self._recent_errors[-10:],
            "log_file": str(_LOG_FILE),
        }

    def get_recent_errors(self, limit: int = 20) -> list[dict]:
        return self._recent_errors[-limit:]


# Singleton
structured_logger = StructuredLogger()
