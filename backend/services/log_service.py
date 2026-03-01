"""In-memory log capture service with ring buffer.

Captures Python logging output and stores in a ring buffer for API access.
Also reads from log files if they exist.
"""
import logging
import re
import sys
import io
from collections import deque
from datetime import datetime
from pathlib import Path
from config import BASE_DIR


MAX_LOG_LINES = 2000  # ring buffer size

# Log entry structure
class LogEntry:
    __slots__ = ("timestamp", "level", "message", "source")

    def __init__(self, timestamp: str, level: str, message: str, source: str = "app"):
        self.timestamp = timestamp
        self.level = level
        self.message = message
        self.source = source

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "message": self.message,
            "source": self.source,
        }


class LogService:
    def __init__(self):
        self._buffer: deque[LogEntry] = deque(maxlen=MAX_LOG_LINES)
        self._handler: logging.Handler | None = None

    def setup(self):
        """Install logging handler to capture all Python log output."""
        handler = _RingBufferHandler(self._buffer)
        handler.setFormatter(logging.Formatter("%(message)s"))
        handler.setLevel(logging.INFO)  # Only capture INFO+ from Python logging
        logging.root.addHandler(handler)
        logging.root.setLevel(logging.INFO)
        # Suppress noisy DEBUG loggers
        for name in ("aiosqlite", "httpcore", "httpx", "hpack"):
            logging.getLogger(name).setLevel(logging.WARNING)

        # Also capture print() calls by wrapping stdout
        self._stdout_wrapper = _PrintCapture(sys.stdout, self._buffer, "INFO")
        self._stderr_wrapper = _PrintCapture(sys.stderr, self._buffer, "ERROR")
        sys.stdout = self._stdout_wrapper  # type: ignore
        sys.stderr = self._stderr_wrapper  # type: ignore

        self._handler = handler

    def get_logs(
        self,
        lines: int = 100,
        level: str | None = None,
        search: str | None = None,
    ) -> list[dict]:
        """Get filtered logs from the ring buffer."""
        result = []
        level_upper = level.upper() if level else None
        search_lower = search.lower() if search else None

        for entry in reversed(self._buffer):
            if level_upper and entry.level != level_upper:
                continue
            if search_lower and search_lower not in entry.message.lower():
                continue
            result.append(entry.to_dict())
            if len(result) >= lines:
                break

        result.reverse()  # oldest first
        return result

    def get_stats(self) -> dict:
        """Get log level counts."""
        counts = {"INFO": 0, "WARN": 0, "ERROR": 0, "DEBUG": 0}
        for entry in self._buffer:
            if entry.level in counts:
                counts[entry.level] += 1
        return {"total": len(self._buffer), "counts": counts}


class _RingBufferHandler(logging.Handler):
    """Logging handler that writes to a deque ring buffer."""

    LEVEL_MAP = {
        logging.DEBUG: "DEBUG",
        logging.INFO: "INFO",
        logging.WARNING: "WARN",
        logging.ERROR: "ERROR",
        logging.CRITICAL: "ERROR",
    }

    def __init__(self, buffer: deque):
        super().__init__()
        self._buffer = buffer

    def emit(self, record: logging.LogRecord):
        try:
            level = self.LEVEL_MAP.get(record.levelno, "INFO")
            msg = self.format(record)
            entry = LogEntry(
                timestamp=datetime.now().isoformat(),
                level=level,
                message=msg,
                source=record.name or "app",
            )
            self._buffer.append(entry)
        except Exception:
            pass


class _PrintCapture(io.TextIOWrapper if hasattr(io, 'TextIOWrapper') else object):
    """Wraps stdout/stderr to capture print() calls into the log buffer."""

    def __init__(self, original, buffer: deque, default_level: str):
        self._original = original
        self._buffer = buffer
        self._default_level = default_level

    def write(self, text: str) -> int:
        if text and text.strip():
            level = self._detect_level(text)
            entry = LogEntry(
                timestamp=datetime.now().isoformat(),
                level=level,
                message=text.strip(),
                source="stdout" if self._default_level == "INFO" else "stderr",
            )
            self._buffer.append(entry)
        return self._original.write(text)

    def flush(self):
        self._original.flush()

    def fileno(self):
        return self._original.fileno()

    def isatty(self):
        return self._original.isatty()

    def _detect_level(self, text: str) -> str:
        t = text.upper()
        if "ERROR" in t or "EXCEPTION" in t or "TRACEBACK" in t:
            return "ERROR"
        if "WARN" in t or "WARNING" in t:
            return "WARN"
        if "DEBUG" in t:
            return "DEBUG"
        return self._default_level


# Singleton
log_service = LogService()
