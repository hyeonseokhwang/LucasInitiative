"""
Enhanced research features:
1. Auto-scheduling (daily morning research on predefined keywords)
2. Research comparison (diff past vs current on same topic)
3. Single-report export (MD with evidence chain)
4. Keyword alert detection (notify when keywords appear in research)
5. Quality metrics calculation (auto-computed per report)
"""
import json
from datetime import datetime, timedelta
from services.db_service import execute, fetch_all, fetch_one
from services.notification_service import create_notification
from services.research_service import queue_manual


# ─── 1. AUTO-SCHEDULING ───

async def get_scheduled_keywords() -> list[dict]:
    """Get all scheduled research keywords."""
    return await fetch_all(
        "SELECT * FROM research_schedule ORDER BY enabled DESC, category, keyword"
    )


async def add_scheduled_keyword(keyword: str, category: str = "general", frequency: str = "daily") -> int:
    """Add a new scheduled keyword."""
    return await execute(
        "INSERT INTO research_schedule (keyword, category, frequency) VALUES (?, ?, ?)",
        (keyword, category, frequency),
    )


async def update_scheduled_keyword(kid: int, enabled: bool = None, keyword: str = None,
                                    category: str = None, frequency: str = None) -> bool:
    """Update a scheduled keyword."""
    existing = await fetch_one("SELECT id FROM research_schedule WHERE id = ?", (kid,))
    if not existing:
        return False
    updates, params = [], []
    if enabled is not None:
        updates.append("enabled = ?")
        params.append(1 if enabled else 0)
    if keyword is not None:
        updates.append("keyword = ?")
        params.append(keyword)
    if category is not None:
        updates.append("category = ?")
        params.append(category)
    if frequency is not None:
        updates.append("frequency = ?")
        params.append(frequency)
    if not updates:
        return True
    params.append(kid)
    await execute(f"UPDATE research_schedule SET {', '.join(updates)} WHERE id = ?", tuple(params))
    return True


async def delete_scheduled_keyword(kid: int) -> bool:
    """Delete a scheduled keyword."""
    existing = await fetch_one("SELECT id FROM research_schedule WHERE id = ?", (kid,))
    if not existing:
        return False
    await execute("DELETE FROM research_schedule WHERE id = ?", (kid,))
    return True


async def run_scheduled_research():
    """Execute scheduled research for due keywords. Called by scheduler."""
    now = datetime.now()
    rows = await fetch_all("SELECT * FROM research_schedule WHERE enabled = 1")

    queued = 0
    for row in rows:
        last_run = row.get("last_run")
        freq = row.get("frequency", "daily")

        should_run = False
        if not last_run:
            should_run = True
        else:
            lr = datetime.fromisoformat(last_run)
            if freq == "daily" and (now - lr).total_seconds() >= 82800:  # ~23h
                should_run = True
            elif freq == "weekly" and (now - lr).total_seconds() >= 604800:  # 7 days
                should_run = True

        if should_run:
            await queue_manual(row["keyword"])
            await execute(
                "UPDATE research_schedule SET last_run = ? WHERE id = ?",
                (now.isoformat(), row["id"]),
            )
            queued += 1

    if queued > 0:
        print(f"[Research Scheduler] Queued {queued} scheduled research topics")
    return queued


# ─── 2. RESEARCH COMPARISON ───

async def compare_research(topic_title: str, limit: int = 5) -> dict:
    """Find and compare past research on similar topics."""
    # Find all reports with similar titles
    reports = await fetch_all(
        """SELECT r.id, r.title, r.summary, r.confidence_avg, r.agreement_rate,
                  r.contradictions, r.evidence_count, r.created_at, t.category
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.title LIKE ? OR t.query LIKE ?
           ORDER BY r.created_at DESC LIMIT ?""",
        (f"%{topic_title}%", f"%{topic_title}%", limit),
    )

    if len(reports) < 2:
        return {"reports": reports, "changes": [], "has_comparison": False}

    # Compare consecutive reports
    changes = []
    for i in range(len(reports) - 1):
        current = reports[i]
        previous = reports[i + 1]
        change = {
            "current_id": current["id"],
            "previous_id": previous["id"],
            "current_date": current["created_at"],
            "previous_date": previous["created_at"],
            "confidence_delta": round((current["confidence_avg"] or 0) - (previous["confidence_avg"] or 0), 3),
            "agreement_delta": round((current["agreement_rate"] or 0) - (previous["agreement_rate"] or 0), 3),
            "evidence_delta": (current["evidence_count"] or 0) - (previous["evidence_count"] or 0),
            "contradiction_delta": (current["contradictions"] or 0) - (previous["contradictions"] or 0),
        }
        # Determine trend
        if change["confidence_delta"] > 0.05:
            change["trend"] = "improving"
        elif change["confidence_delta"] < -0.05:
            change["trend"] = "declining"
        else:
            change["trend"] = "stable"
        changes.append(change)

    return {"reports": reports, "changes": changes, "has_comparison": True}


async def compare_two_reports(report_id_a: int, report_id_b: int) -> dict:
    """Compare two specific reports by ID."""
    report_a = await fetch_one(
        """SELECT r.*, t.query, t.category
           FROM research_reports r JOIN research_topics t ON r.topic_id = t.id
           WHERE r.id = ?""", (report_id_a,)
    )
    report_b = await fetch_one(
        """SELECT r.*, t.query, t.category
           FROM research_reports r JOIN research_topics t ON r.topic_id = t.id
           WHERE r.id = ?""", (report_id_b,)
    )
    if not report_a or not report_b:
        return {"error": "One or both reports not found"}

    evidence_a = await fetch_all(
        "SELECT claim, source, confidence FROM research_evidence WHERE topic_id = ? ORDER BY confidence DESC",
        (report_a["topic_id"],),
    )
    evidence_b = await fetch_all(
        "SELECT claim, source, confidence FROM research_evidence WHERE topic_id = ? ORDER BY confidence DESC",
        (report_b["topic_id"],),
    )

    # Find new/removed claims (by source match)
    sources_a = {e["source"] for e in evidence_a}
    sources_b = {e["source"] for e in evidence_b}

    return {
        "report_a": report_a,
        "report_b": report_b,
        "diff": {
            "confidence_delta": round((report_a["confidence_avg"] or 0) - (report_b["confidence_avg"] or 0), 3),
            "agreement_delta": round((report_a["agreement_rate"] or 0) - (report_b["agreement_rate"] or 0), 3),
            "evidence_delta": (report_a["evidence_count"] or 0) - (report_b["evidence_count"] or 0),
            "new_sources": list(sources_a - sources_b),
            "removed_sources": list(sources_b - sources_a),
            "common_sources": list(sources_a & sources_b),
        },
        "evidence_a_count": len(evidence_a),
        "evidence_b_count": len(evidence_b),
    }


# ─── 3. SINGLE REPORT EXPORT (Markdown) ───

async def export_single_report_md(report_id: int) -> str | None:
    """Export a single research report as detailed Markdown."""
    report = await fetch_one(
        """SELECT r.*, t.query, t.trigger_type, t.priority, t.category
           FROM research_reports r
           JOIN research_topics t ON r.topic_id = t.id
           WHERE r.id = ?""",
        (report_id,),
    )
    if not report:
        return None

    evidence = await fetch_all(
        "SELECT * FROM research_evidence WHERE topic_id = ? ORDER BY confidence DESC",
        (report["topic_id"],),
    )

    quality = await fetch_one(
        "SELECT * FROM research_quality_metrics WHERE report_id = ?", (report_id,)
    )

    lines = []
    lines.append(f"# {report['title']}")
    lines.append("")
    lines.append(f"**Date**: {report['created_at']}")
    lines.append(f"**Category**: {report.get('category', 'general')}")
    lines.append(f"**Trigger**: {report.get('trigger_type', 'auto')} | **Priority**: {report.get('priority', 5)}")
    lines.append(f"**Model**: {report.get('model_used', 'N/A')}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Metrics
    lines.append("## Metrics")
    lines.append(f"- Confidence: **{(report['confidence_avg'] or 0)*100:.1f}%**")
    lines.append(f"- Agreement Rate: {(report['agreement_rate'] or 0)*100:.1f}%")
    lines.append(f"- Evidence Count: {report['evidence_count'] or 0}")
    lines.append(f"- Contradictions: {report['contradictions'] or 0}")
    if quality:
        lines.append(f"- Quality Score: {(quality['quality_score'] or 0)*100:.1f}%")
        lines.append(f"- Source Diversity: {(quality['source_diversity'] or 0)*100:.1f}%")
        lines.append(f"- Verified Sources: {quality['verified_count']}/{quality['source_count']}")
    lines.append("")

    # Summary
    lines.append("## Summary")
    lines.append(report["summary"])
    lines.append("")

    # Full Analysis
    if report.get("full_analysis"):
        lines.append("## Full Analysis")
        lines.append(report["full_analysis"])
        lines.append("")

    # Evidence Chain
    if evidence:
        lines.append("## Evidence Chain")
        lines.append("")
        for i, ev in enumerate(evidence, 1):
            conf_pct = (ev["confidence"] or 0) * 100
            verified = " [Verified]" if ev["verified"] else ""
            lines.append(f"### Evidence #{i} (Confidence: {conf_pct:.0f}%){verified}")
            lines.append(f"- **Source**: {ev['source']} ({ev['source_type']})")
            lines.append(f"- **Claim**: {ev['claim']}")
            if ev.get("contradicts"):
                try:
                    conflicts = json.loads(ev["contradicts"])
                    if conflicts:
                        lines.append(f"- **Contradicts**: {json.dumps(conflicts, ensure_ascii=False)}")
                except (json.JSONDecodeError, TypeError):
                    pass
            lines.append("")

    lines.append("---")
    lines.append(f"*Generated by Lucas AI Research Engine*")

    return "\n".join(lines)


# ─── 4. KEYWORD ALERT SYSTEM ───

async def get_keyword_alerts() -> list[dict]:
    """Get all keyword alert subscriptions."""
    return await fetch_all(
        "SELECT * FROM research_keyword_alerts ORDER BY enabled DESC, keyword"
    )


async def add_keyword_alert(keyword: str, category: str = "all") -> int:
    """Subscribe to keyword alerts."""
    return await execute(
        "INSERT INTO research_keyword_alerts (keyword, category) VALUES (?, ?)",
        (keyword, category),
    )


async def update_keyword_alert(alert_id: int, enabled: bool = None, keyword: str = None) -> bool:
    """Update a keyword alert."""
    existing = await fetch_one("SELECT id FROM research_keyword_alerts WHERE id = ?", (alert_id,))
    if not existing:
        return False
    updates, params = [], []
    if enabled is not None:
        updates.append("enabled = ?")
        params.append(1 if enabled else 0)
    if keyword is not None:
        updates.append("keyword = ?")
        params.append(keyword)
    if not updates:
        return True
    params.append(alert_id)
    await execute(f"UPDATE research_keyword_alerts SET {', '.join(updates)} WHERE id = ?", tuple(params))
    return True


async def delete_keyword_alert(alert_id: int) -> bool:
    """Delete a keyword alert."""
    existing = await fetch_one("SELECT id FROM research_keyword_alerts WHERE id = ?", (alert_id,))
    if not existing:
        return False
    await execute("DELETE FROM research_keyword_alerts WHERE id = ?", (alert_id,))
    return True


async def check_keyword_alerts(report_title: str, report_summary: str, report_id: int):
    """Check if a completed research matches any keyword alerts. Create notifications."""
    alerts = await fetch_all("SELECT * FROM research_keyword_alerts WHERE enabled = 1")
    text = f"{report_title} {report_summary}".lower()

    for alert in alerts:
        kw = alert["keyword"].lower()
        if kw in text:
            await create_notification(
                title=f"[Keyword Alert] '{alert['keyword']}' detected",
                message=f"Research report '{report_title}' contains your tracked keyword.",
                ntype="alert",
                metadata={"keyword": alert["keyword"], "report_id": report_id, "alert_id": alert["id"]},
            )


# ─── 5. QUALITY METRICS ───

async def calculate_quality_metrics(report_id: int, topic_id: int) -> dict:
    """Calculate and store quality metrics for a research report."""
    evidence = await fetch_all(
        "SELECT * FROM research_evidence WHERE topic_id = ?", (topic_id,)
    )

    if not evidence:
        metrics = {
            "source_count": 0, "unique_sources": 0, "web_sources": 0, "db_sources": 0,
            "verified_count": 0, "duplicate_rate": 0.0, "avg_confidence": 0.0,
            "min_confidence": 0.0, "max_confidence": 0.0, "source_diversity": 0.0,
            "freshness_hours": 0.0, "quality_score": 0.0,
        }
    else:
        source_count = len(evidence)
        sources = [e["source"] for e in evidence]
        unique_sources = len(set(sources))
        web_sources = sum(1 for e in evidence if e.get("source_type") in ("web", "news", "academic"))
        db_sources = sum(1 for e in evidence if e.get("source_type") in ("db_market", "db_news", "db_alert", "internal"))
        verified_count = sum(1 for e in evidence if e.get("verified"))

        confidences = [e["confidence"] for e in evidence if e.get("confidence") is not None]
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        min_conf = min(confidences) if confidences else 0.0
        max_conf = max(confidences) if confidences else 0.0

        # Duplicate rate: same claim from different sources
        claims = [e["claim"].lower().strip() for e in evidence]
        unique_claims = len(set(claims))
        duplicate_rate = 1.0 - (unique_claims / source_count) if source_count > 0 else 0.0

        # Source diversity
        source_diversity = unique_sources / source_count if source_count > 0 else 0.0

        # Freshness: avg hours since evidence creation
        now = datetime.now()
        ages = []
        for e in evidence:
            try:
                created = datetime.fromisoformat(e["created_at"])
                ages.append((now - created).total_seconds() / 3600)
            except (ValueError, TypeError):
                pass
        freshness_hours = sum(ages) / len(ages) if ages else 0.0

        # Composite quality score (0-1)
        # Factors: confidence (40%), diversity (20%), verification rate (20%), evidence count (10%), freshness (10%)
        verification_rate = verified_count / source_count if source_count > 0 else 0.0
        count_score = min(source_count / 15, 1.0)  # 15+ sources = max
        freshness_score = max(0, 1.0 - (freshness_hours / 168))  # decay over 7 days

        quality_score = (
            avg_conf * 0.40 +
            source_diversity * 0.20 +
            verification_rate * 0.20 +
            count_score * 0.10 +
            freshness_score * 0.10
        )

        metrics = {
            "source_count": source_count,
            "unique_sources": unique_sources,
            "web_sources": web_sources,
            "db_sources": db_sources,
            "verified_count": verified_count,
            "duplicate_rate": round(duplicate_rate, 3),
            "avg_confidence": round(avg_conf, 3),
            "min_confidence": round(min_conf, 3),
            "max_confidence": round(max_conf, 3),
            "source_diversity": round(source_diversity, 3),
            "freshness_hours": round(freshness_hours, 1),
            "quality_score": round(quality_score, 3),
        }

    # Store in DB
    await execute(
        """INSERT INTO research_quality_metrics
           (report_id, source_count, unique_sources, web_sources, db_sources, verified_count,
            duplicate_rate, avg_confidence, min_confidence, max_confidence, source_diversity,
            freshness_hours, quality_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (report_id, metrics["source_count"], metrics["unique_sources"], metrics["web_sources"],
         metrics["db_sources"], metrics["verified_count"], metrics["duplicate_rate"],
         metrics["avg_confidence"], metrics["min_confidence"], metrics["max_confidence"],
         metrics["source_diversity"], metrics["freshness_hours"], metrics["quality_score"]),
    )

    return metrics


async def get_quality_metrics(report_id: int) -> dict | None:
    """Get quality metrics for a report."""
    return await fetch_one(
        "SELECT * FROM research_quality_metrics WHERE report_id = ?", (report_id,)
    )


async def get_quality_overview() -> dict:
    """Get aggregate quality metrics across all reports."""
    row = await fetch_one(
        """SELECT COUNT(*) AS total,
                  AVG(quality_score) AS avg_quality,
                  AVG(source_count) AS avg_sources,
                  AVG(source_diversity) AS avg_diversity,
                  AVG(avg_confidence) AS avg_confidence,
                  SUM(verified_count) AS total_verified,
                  SUM(source_count) AS total_sources
           FROM research_quality_metrics"""
    )
    if not row or not row["total"]:
        return {"total": 0}
    return {
        "total": row["total"],
        "avg_quality": round(row["avg_quality"] or 0, 3),
        "avg_sources": round(row["avg_sources"] or 0, 1),
        "avg_diversity": round(row["avg_diversity"] or 0, 3),
        "avg_confidence": round(row["avg_confidence"] or 0, 3),
        "verification_rate": round((row["total_verified"] or 0) / max(row["total_sources"] or 1, 1), 3),
    }
