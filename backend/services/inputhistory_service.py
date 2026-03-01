"""
Input History Service — Lucas Initiative coordination inbox parser.
Reads mobile-command, instruct, report files from .coordination/inbox/ and
commander-log.md to provide a unified timeline of Lucas's requests and system activity.
"""

import os
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

COORDINATION_DIR = Path("G:/Lucas-Initiative/.coordination")
INBOX_DIR = COORDINATION_DIR / "inbox"

KST = timezone(timedelta(hours=9))


def _parse_timestamp_from_filename(filename: str) -> Optional[str]:
    """Extract Unix ms timestamp from filename like instruct-worker-1-1772328493572.md"""
    match = re.search(r"-(\d{13})\.md$", filename)
    if match:
        ts_ms = int(match.group(1))
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=KST)
        return dt.isoformat()
    return None


def _parse_iso_from_content(content: str) -> Optional[str]:
    """Extract ISO timestamp from > 2026-03-01T01:13:36.261Z line"""
    match = re.search(r">\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)", content)
    if match:
        raw = match.group(1)
        try:
            if raw.endswith("Z"):
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(KST)
            else:
                dt = datetime.fromisoformat(raw).astimezone(KST)
            return dt.isoformat()
        except Exception:
            return raw
    return None


def _extract_target(content: str) -> Optional[str]:
    """Extract To: worker-N from content"""
    match = re.search(r">\s*To:\s*(.+)", content)
    if match:
        return match.group(1).strip()
    return None


def _extract_source(content: str) -> Optional[str]:
    """Extract From: ... from content"""
    match = re.search(r">\s*From:\s*(.+)", content)
    if match:
        return match.group(1).strip()
    return None


def _extract_title(content: str) -> str:
    """Extract first heading or first non-meta line as title"""
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    # fallback: first non-empty, non-meta line
    for line in content.split("\n"):
        line = line.strip()
        if line and not line.startswith(">") and not line.startswith("#"):
            return line[:100]
    return "(no title)"


def _extract_body(content: str) -> str:
    """Extract body content (skip header meta lines)"""
    lines = content.split("\n")
    body_lines = []
    past_header = False
    for line in lines:
        stripped = line.strip()
        if not past_header:
            if stripped.startswith("#") or stripped.startswith(">") or stripped == "":
                continue
            past_header = True
        body_lines.append(line)
    return "\n".join(body_lines).strip()


def _classify_file(filename: str) -> dict:
    """Classify file type and extract metadata from filename"""
    if filename.startswith("mobile-command-"):
        return {"type": "command", "category": "lucas_input", "icon": "command"}
    elif filename.startswith("instruct-commander-"):
        return {"type": "instruct", "category": "self_instruct", "icon": "instruct"}
    elif filename.startswith("instruct-worker-"):
        match = re.match(r"instruct-worker-(\d+)-", filename)
        worker = f"worker-{match.group(1)}" if match else "unknown"
        return {"type": "instruct", "category": "task_assign", "icon": "instruct", "worker": worker}
    elif filename.startswith("report-worker-"):
        match = re.match(r"report-worker-(\d+)-", filename)
        worker = f"worker-{match.group(1)}" if match else "unknown"
        return {"type": "report", "category": "worker_report", "icon": "report", "worker": worker}
    else:
        return {"type": "other", "category": "other", "icon": "file"}


def _detect_status(content: str) -> str:
    """Detect status from content"""
    lower = content.lower()
    if "user decision needed" in lower or "needsuserdecision" in lower:
        return "needs_decision"
    if any(kw in lower for kw in ["completed", "done", "finished", "success"]):
        return "completed"
    if any(kw in lower for kw in ["in progress", "working", "started", "진행"]):
        return "in_progress"
    if any(kw in lower for kw in ["blocked", "failed", "error"]):
        return "blocked"
    return "pending"


async def get_input_history(
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    date_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    type_filter: Optional[str] = None,
) -> dict:
    """Read and parse all inbox files into a unified timeline."""
    entries = []

    if not INBOX_DIR.exists():
        return {"entries": [], "total": 0, "has_more": False}

    for fname in os.listdir(INBOX_DIR):
        if not fname.endswith(".md"):
            continue

        fpath = INBOX_DIR / fname
        try:
            content = fpath.read_text(encoding="utf-8")
        except Exception:
            continue

        classification = _classify_file(fname)
        timestamp = _parse_iso_from_content(content) or _parse_timestamp_from_filename(fname)
        if not timestamp:
            # Use file mtime as fallback
            try:
                mtime = os.path.getmtime(fpath)
                timestamp = datetime.fromtimestamp(mtime, tz=KST).isoformat()
            except Exception:
                continue

        title = _extract_title(content)
        body = _extract_body(content)
        target = _extract_target(content)
        source = _extract_source(content)
        status = _detect_status(content)

        entry = {
            "id": fname,
            "filename": fname,
            "timestamp": timestamp,
            "title": title,
            "body": body[:500],  # truncate for list view
            "full_body": body,
            "type": classification["type"],
            "category": classification["category"],
            "worker": classification.get("worker") or target or source or "",
            "status": status,
            "needs_decision": status == "needs_decision",
        }

        # Apply filters
        if type_filter and entry["type"] != type_filter:
            continue
        if status_filter and entry["status"] != status_filter:
            continue
        if date_filter:
            try:
                entry_date = entry["timestamp"][:10]
                if entry_date != date_filter:
                    continue
            except Exception:
                pass
        if search:
            search_lower = search.lower()
            searchable = f"{title} {body} {entry['worker']}".lower()
            if search_lower not in searchable:
                continue

        entries.append(entry)

    # Sort by timestamp descending (newest first)
    entries.sort(key=lambda e: e["timestamp"], reverse=True)

    total = len(entries)
    paginated = entries[offset : offset + limit]

    # Remove full_body from list response
    for e in paginated:
        del e["full_body"]

    return {
        "entries": paginated,
        "total": total,
        "has_more": (offset + limit) < total,
    }


async def get_input_detail(file_id: str) -> Optional[dict]:
    """Get full detail of a single inbox entry."""
    fpath = INBOX_DIR / file_id
    if not fpath.exists() or not fpath.name.endswith(".md"):
        return None

    try:
        content = fpath.read_text(encoding="utf-8")
    except Exception:
        return None

    classification = _classify_file(file_id)
    timestamp = _parse_iso_from_content(content) or _parse_timestamp_from_filename(file_id)

    return {
        "id": file_id,
        "filename": file_id,
        "timestamp": timestamp,
        "title": _extract_title(content),
        "body": _extract_body(content),
        "raw_content": content,
        "type": classification["type"],
        "category": classification["category"],
        "worker": classification.get("worker") or _extract_target(content) or _extract_source(content) or "",
        "status": _detect_status(content),
        "needs_decision": _detect_status(content) == "needs_decision",
    }


async def get_commander_log() -> dict:
    """Parse commander-log.md into structured entries."""
    log_path = COORDINATION_DIR / "commander-log.md"
    if not log_path.exists():
        return {"entries": [], "raw": ""}

    try:
        content = log_path.read_text(encoding="utf-8")
    except Exception:
        return {"entries": [], "raw": ""}

    entries = []
    current_date = ""
    current_time = ""
    current_title = ""
    current_body_lines = []

    for line in content.split("\n"):
        # Date header: ## 2026-03-01 (KST)
        date_match = re.match(r"^##\s+(\d{4}-\d{2}-\d{2})", line)
        if date_match:
            # Flush previous entry
            if current_title:
                entries.append({
                    "date": current_date,
                    "time": current_time,
                    "title": current_title,
                    "body": "\n".join(current_body_lines).strip(),
                })
            current_date = date_match.group(1)
            current_time = ""
            current_title = ""
            current_body_lines = []
            continue

        # Time + title: ### HH:MM — Title
        time_match = re.match(r"^###\s+(\d{2}:\d{2})\s*[—-]\s*(.*)", line)
        if time_match:
            # Flush previous entry
            if current_title:
                entries.append({
                    "date": current_date,
                    "time": current_time,
                    "title": current_title,
                    "body": "\n".join(current_body_lines).strip(),
                })
            current_time = time_match.group(1)
            current_title = time_match.group(2).strip()
            current_body_lines = []
            continue

        current_body_lines.append(line)

    # Flush last entry
    if current_title:
        entries.append({
            "date": current_date,
            "time": current_time,
            "title": current_title,
            "body": "\n".join(current_body_lines).strip(),
        })

    return {"entries": entries, "total": len(entries)}


async def get_stats() -> dict:
    """Get summary statistics for the inbox."""
    if not INBOX_DIR.exists():
        return {"total": 0, "by_type": {}, "by_status": {}, "today_count": 0}

    today = datetime.now(KST).strftime("%Y-%m-%d")
    total = 0
    by_type = {}
    by_status = {}
    today_count = 0

    for fname in os.listdir(INBOX_DIR):
        if not fname.endswith(".md"):
            continue
        total += 1

        classification = _classify_file(fname)
        ftype = classification["type"]
        by_type[ftype] = by_type.get(ftype, 0) + 1

        fpath = INBOX_DIR / fname
        try:
            content = fpath.read_text(encoding="utf-8")
            status = _detect_status(content)
            by_status[status] = by_status.get(status, 0) + 1

            ts = _parse_iso_from_content(content) or _parse_timestamp_from_filename(fname)
            if ts and ts[:10] == today:
                today_count += 1
        except Exception:
            pass

    return {
        "total": total,
        "by_type": by_type,
        "by_status": by_status,
        "today_count": today_count,
    }
