"""
Research Analytics Service:
1. Trend Analysis - keyword frequency tracking over time
2. AI Weekly Insight Generation - summarize recent research via Ollama
3. Data Pipeline Monitoring - processing time, success rate, error logs
4. Research Queue System - queue management with status API
"""
import asyncio
import json
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from services.db_service import execute, fetch_all, fetch_one
from services.cache_service import stats_cache, research_cache
from config import OLLAMA_BASE_URL, DEFAULT_MODEL
import httpx


# ─── 1. TREND ANALYSIS ───

# Common Korean/English stop words to exclude from trends
_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "and", "or", "but", "if",
    "for", "of", "in", "on", "at", "to", "by", "with", "from", "as",
    "this", "that", "these", "those", "it", "its", "not", "no", "so",
    "이", "가", "은", "는", "을", "를", "의", "에", "에서", "으로", "로",
    "와", "과", "도", "만", "까지", "부터", "및", "등", "중", "것",
    "수", "더", "한", "된", "할", "하는", "있는", "없는", "대한",
}

_WORD_PATTERN = re.compile(r'[가-힣]{2,}|[a-zA-Z]{3,}')


def _extract_keywords(text: str, top_n: int = 20) -> list[tuple[str, int]]:
    """Extract meaningful keywords from text."""
    words = _WORD_PATTERN.findall(text.lower())
    filtered = [w for w in words if w not in _STOP_WORDS and len(w) >= 2]
    return Counter(filtered).most_common(top_n)


async def get_keyword_trends(days: int = 30, top_n: int = 20) -> dict:
    """Track keyword frequency changes over time from research data."""
    cache_key = f"kw_trends_{days}_{top_n}"
    cached = stats_cache.get(cache_key)
    if cached is not None:
        return cached
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()

    reports = await fetch_all(
        """SELECT r.title, r.summary, r.created_at, t.category
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.created_at > ?
           ORDER BY r.created_at""",
        (cutoff,),
    )

    if not reports:
        return {"trends": [], "daily": {}, "total_reports": 0}

    # Aggregate keywords per day
    daily_keywords: dict[str, Counter] = defaultdict(Counter)
    overall = Counter()

    for r in reports:
        text = f"{r['title']} {r['summary']}"
        day = r["created_at"][:10]  # YYYY-MM-DD
        kws = _extract_keywords(text, top_n=30)
        for word, count in kws:
            daily_keywords[day][word] += count
            overall[word] += count

    # Top keywords overall
    top_keywords = overall.most_common(top_n)

    # Build daily series for top keywords
    dates = sorted(daily_keywords.keys())
    daily_series = {}
    for kw, _ in top_keywords:
        daily_series[kw] = [
            {"date": d, "count": daily_keywords[d].get(kw, 0)}
            for d in dates
        ]

    # Detect rising/falling trends
    trends = []
    half = len(dates) // 2 if len(dates) > 1 else 1
    first_half_dates = dates[:half] if half > 0 else dates
    second_half_dates = dates[half:] if half > 0 else dates

    for kw, total in top_keywords:
        first = sum(daily_keywords[d].get(kw, 0) for d in first_half_dates)
        second = sum(daily_keywords[d].get(kw, 0) for d in second_half_dates)
        if first == 0 and second > 0:
            direction = "new"
        elif first > 0 and second == 0:
            direction = "declining"
        elif second > first * 1.3:
            direction = "rising"
        elif second < first * 0.7:
            direction = "declining"
        else:
            direction = "stable"

        trends.append({
            "keyword": kw,
            "total": total,
            "first_half": first,
            "second_half": second,
            "direction": direction,
        })

    result = {
        "trends": trends,
        "daily": daily_series,
        "total_reports": len(reports),
        "date_range": {"from": dates[0], "to": dates[-1]} if dates else {},
    }
    stats_cache.set(cache_key, result, ttl=300)  # 5 min
    return result


async def get_category_trends(days: int = 30) -> dict:
    """Get category distribution trends over time."""
    cache_key = f"cat_trends_{days}"
    cached = stats_cache.get(cache_key)
    if cached is not None:
        return cached
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()

    rows = await fetch_all(
        """SELECT date(r.created_at) AS day, t.category, COUNT(*) AS cnt
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.created_at > ?
           GROUP BY day, t.category
           ORDER BY day""",
        (cutoff,),
    )

    daily: dict[str, dict] = defaultdict(lambda: {"stock": 0, "realestate": 0, "general": 0})
    for r in rows:
        daily[r["day"]][r["category"] or "general"] = r["cnt"]

    result = {
        "category_trends": [
            {"date": d, **cats} for d, cats in sorted(daily.items())
        ]
    }
    stats_cache.set(cache_key, result, ttl=300)  # 5 min
    return result


# ─── 2. AI WEEKLY INSIGHT ───

async def _call_ollama(prompt: str, model: str = None, timeout: int = 120) -> str:
    """Call Ollama generate API (non-streaming)."""
    model = model or DEFAULT_MODEL
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
        )
        data = resp.json()
        return data.get("response", "")


async def generate_weekly_insight(force: bool = False) -> dict:
    """Generate weekly insight report from recent research using Ollama."""
    # Check if already generated this week
    if not force:
        existing = await fetch_one(
            """SELECT * FROM daily_reports
               WHERE report_type = 'weekly_insight'
                 AND created_at > datetime('now', '-6 days')
               ORDER BY created_at DESC LIMIT 1"""
        )
        if existing:
            return {"status": "cached", "report": existing}

    # Gather recent reports (last 7 days)
    reports = await fetch_all(
        """SELECT r.title, r.summary, r.confidence_avg, r.evidence_count,
                  r.contradictions, t.category, r.created_at
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.created_at > datetime('now', '-7 days')
           ORDER BY r.created_at DESC"""
    )

    if not reports:
        return {"status": "no_data", "message": "No research reports in the last 7 days"}

    # Build context for LLM
    report_summaries = []
    for r in reports:
        conf = (r["confidence_avg"] or 0) * 100
        report_summaries.append(
            f"- [{r['category'] or 'general'}] {r['title']} "
            f"(신뢰도: {conf:.0f}%, 증거: {r['evidence_count']}건, "
            f"모순: {r['contradictions']}건) - {r['created_at'][:10]}\n"
            f"  요약: {r['summary'][:200]}"
        )

    context = "\n".join(report_summaries)

    prompt = f"""당신은 금융 및 부동산 전문 분석가입니다. 아래는 지난 7일간의 리서치 리포트 목록입니다.

이 데이터를 종합하여 주간 인사이트 리포트를 한국어로 작성해주세요.

## 리서치 리포트 ({len(reports)}건)
{context}

## 작성 형식
1. **주간 핵심 요약** (3-5줄)
2. **주요 트렌드** (상승/하락/새로운 이슈)
3. **카테고리별 분석**
   - 주식 시장 동향
   - 부동산 시장 동향
   - 기타 주요 사항
4. **리스크 요인** (주의해야 할 점)
5. **다음 주 전망 및 모니터링 포인트**

핵심적인 내용만 간결하게 작성하세요. 총 A4 1페이지 분량."""

    start = time.time()
    analysis = await _call_ollama(prompt, timeout=180)
    duration = time.time() - start

    if not analysis:
        return {"status": "error", "message": "LLM returned empty response"}

    # Save to daily_reports
    report_id = await execute(
        """INSERT INTO daily_reports (report_type, title, content, data_json)
           VALUES ('weekly_insight', ?, ?, ?)""",
        (
            f"Weekly Insight - {datetime.now().strftime('%Y-%m-%d')}",
            analysis,
            json.dumps({
                "report_count": len(reports),
                "duration_sec": round(duration, 1),
                "model": DEFAULT_MODEL,
            }, ensure_ascii=False),
        ),
    )

    return {
        "status": "generated",
        "id": report_id,
        "title": f"Weekly Insight - {datetime.now().strftime('%Y-%m-%d')}",
        "content": analysis,
        "report_count": len(reports),
        "duration_sec": round(duration, 1),
    }


async def get_weekly_insights(limit: int = 10) -> list[dict]:
    """List past weekly insight reports."""
    return await fetch_all(
        """SELECT * FROM daily_reports
           WHERE report_type = 'weekly_insight'
           ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    )


# ─── 3. PIPELINE MONITORING ───

# In-memory pipeline stats (reset on server restart, persisted periodically)
_pipeline_stats = {
    "total_runs": 0,
    "successful": 0,
    "failed": 0,
    "total_duration_sec": 0.0,
    "errors": [],  # last 50 errors
    "stage_timings": defaultdict(list),  # stage -> list of durations
    "started_at": datetime.now().isoformat(),
}


def record_pipeline_run(success: bool, duration_sec: float, topic_title: str = "",
                        error: str = None, stage_timings: dict = None):
    """Record a pipeline run result."""
    _pipeline_stats["total_runs"] += 1
    _pipeline_stats["total_duration_sec"] += duration_sec
    if success:
        _pipeline_stats["successful"] += 1
    else:
        _pipeline_stats["failed"] += 1
        if error:
            _pipeline_stats["errors"].append({
                "time": datetime.now().isoformat(),
                "topic": topic_title,
                "error": error[:500],
                "duration_sec": round(duration_sec, 1),
            })
            # Keep only last 50 errors
            if len(_pipeline_stats["errors"]) > 50:
                _pipeline_stats["errors"] = _pipeline_stats["errors"][-50:]

    if stage_timings:
        for stage, dur in stage_timings.items():
            _pipeline_stats["stage_timings"][stage].append(dur)
            # Keep only last 100 per stage
            if len(_pipeline_stats["stage_timings"][stage]) > 100:
                _pipeline_stats["stage_timings"][stage] = _pipeline_stats["stage_timings"][stage][-100:]


async def get_pipeline_stats() -> dict:
    """Get pipeline monitoring statistics."""
    cached = stats_cache.get("pipeline_stats")
    if cached is not None:
        return cached
    total = _pipeline_stats["total_runs"]
    success_rate = (_pipeline_stats["successful"] / total * 100) if total > 0 else 0
    avg_duration = (_pipeline_stats["total_duration_sec"] / total) if total > 0 else 0

    # Stage averages
    stage_avgs = {}
    for stage, durations in _pipeline_stats["stage_timings"].items():
        if durations:
            stage_avgs[stage] = {
                "avg_sec": round(sum(durations) / len(durations), 1),
                "min_sec": round(min(durations), 1),
                "max_sec": round(max(durations), 1),
                "count": len(durations),
            }

    # DB-based historical stats
    db_stats = await fetch_one(
        """SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
              AVG(CASE WHEN completed_at IS NOT NULL
                  THEN (julianday(completed_at) - julianday(created_at)) * 86400
                  ELSE NULL END) AS avg_sec
           FROM research_topics"""
    )

    result = {
        "session": {
            "total_runs": total,
            "successful": _pipeline_stats["successful"],
            "failed": _pipeline_stats["failed"],
            "success_rate": round(success_rate, 1),
            "avg_duration_sec": round(avg_duration, 1),
            "started_at": _pipeline_stats["started_at"],
        },
        "historical": {
            "total_topics": db_stats["total"] if db_stats else 0,
            "completed": db_stats["completed"] if db_stats else 0,
            "failed": db_stats["failed"] if db_stats else 0,
            "avg_duration_sec": round(db_stats["avg_sec"] or 0, 1) if db_stats else 0,
        },
        "stage_performance": stage_avgs,
        "recent_errors": _pipeline_stats["errors"][-10:],
    }
    stats_cache.set("pipeline_stats", result, ttl=60)  # 1 min
    return result


# ─── 4. RESEARCH QUEUE SYSTEM ───

class ResearchQueueManager:
    """Enhanced queue with visibility into pending items and status."""

    def __init__(self):
        self._queue: list[dict] = []
        self._processing: dict | None = None
        self._completed: list[dict] = []  # last 20
        self._lock = asyncio.Lock()

    async def enqueue(self, query: str, priority: int = 5, category: str = "general") -> dict:
        """Add a research request to the queue."""
        item = {
            "id": f"q-{int(time.time() * 1000)}",
            "query": query,
            "priority": priority,
            "category": category,
            "status": "queued",
            "queued_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
        }
        async with self._lock:
            self._queue.append(item)
            # Sort by priority (lower = higher priority)
            self._queue.sort(key=lambda x: x["priority"])
        return item

    async def dequeue(self) -> dict | None:
        """Get next item to process."""
        async with self._lock:
            if not self._queue:
                return None
            item = self._queue.pop(0)
            item["status"] = "processing"
            item["started_at"] = datetime.now().isoformat()
            self._processing = item
            return item

    async def complete(self, queue_id: str, success: bool = True, result: dict = None):
        """Mark current item as completed."""
        async with self._lock:
            if self._processing and self._processing["id"] == queue_id:
                self._processing["status"] = "completed" if success else "failed"
                self._processing["completed_at"] = datetime.now().isoformat()
                if result:
                    self._processing["result"] = result
                self._completed.append(self._processing)
                if len(self._completed) > 20:
                    self._completed = self._completed[-20:]
                self._processing = None

    async def remove(self, queue_id: str) -> bool:
        """Remove an item from the queue."""
        async with self._lock:
            for i, item in enumerate(self._queue):
                if item["id"] == queue_id:
                    self._queue.pop(i)
                    return True
        return False

    async def get_status(self) -> dict:
        """Get full queue status."""
        async with self._lock:
            return {
                "queued": list(self._queue),
                "processing": self._processing,
                "completed": list(reversed(self._completed)),
                "queue_size": len(self._queue),
                "is_processing": self._processing is not None,
            }


# Global queue manager
queue_manager = ResearchQueueManager()
