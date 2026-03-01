"""
Data Integrity Checker — validates all DB tables, indexes, and migration status.
Run via API or on startup to ensure database health.
"""
from services.db_service import fetch_all, fetch_one


async def check_integrity() -> dict:
    """Full database integrity check."""
    results = {
        "status": "ok",
        "tables": {},
        "indexes": {},
        "issues": [],
        "migration_status": "up_to_date",
    }

    # 1. Check all expected tables exist and have rows
    expected_tables = [
        "conversations", "messages", "tasks", "metrics", "schedules",
        "expenses", "api_usage", "market_data", "realestate_data",
        "realestate_watchlist", "scheduled_jobs", "daily_reports",
        "collected_items", "research_topics", "research_evidence",
        "research_reports", "source_reliability", "portfolio",
        "telegram_config", "notifications", "sentiment_scores",
        "research_keyword_alerts", "research_quality_metrics",
        "research_schedule",
    ]

    existing_tables = await fetch_all(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    existing_names = {t["name"] for t in existing_tables}

    for table in expected_tables:
        if table not in existing_names:
            results["tables"][table] = {"exists": False, "rows": 0}
            results["issues"].append(f"Missing table: {table}")
            results["status"] = "warning"
        else:
            row = await fetch_one(f"SELECT COUNT(*) AS cnt FROM [{table}]")
            results["tables"][table] = {"exists": True, "rows": row["cnt"] if row else 0}

    # 2. Check all expected indexes exist
    expected_indexes = [
        "idx_messages_conv", "idx_collected_hash", "idx_collected_cat",
        "idx_market_symbol", "idx_realestate_district", "idx_tasks_status",
        "idx_metrics_time", "idx_schedules_start", "idx_expenses_paid",
        "idx_research_topics_status", "idx_research_evidence_topic",
        "idx_research_reports_topic", "idx_watchlist_district",
        "idx_notifications_read", "idx_notifications_type",
        "idx_sentiment_symbol", "idx_sentiment_date",
        "idx_keyword_alerts_enabled", "idx_quality_metrics_report",
        "idx_research_schedule_enabled", "idx_portfolio_symbol",
        # Round 4 performance indexes
        "idx_collected_items_created", "idx_research_reports_created",
        "idx_research_reports_bookmarked", "idx_research_topics_created",
        "idx_research_topics_category", "idx_market_data_recorded",
        "idx_daily_reports_created", "idx_api_usage_created",
        "idx_messages_created", "idx_sentiment_scores_analyzed",
    ]

    existing_indexes = await fetch_all(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    existing_idx_names = {i["name"] for i in existing_indexes}

    for idx in expected_indexes:
        exists = idx in existing_idx_names
        results["indexes"][idx] = {"exists": exists}
        if not exists:
            results["issues"].append(f"Missing index: {idx}")
            results["status"] = "warning"

    # 3. SQLite integrity check
    integrity = await fetch_one("PRAGMA integrity_check")
    if integrity and integrity.get("integrity_check") != "ok":
        results["issues"].append(f"SQLite integrity issue: {integrity}")
        results["status"] = "error"

    # 4. Foreign key check
    fk_violations = await fetch_all("PRAGMA foreign_key_check")
    if fk_violations:
        results["issues"].append(f"Foreign key violations: {len(fk_violations)} found")
        results["status"] = "warning"

    # 5. WAL mode check
    journal = await fetch_one("PRAGMA journal_mode")
    results["journal_mode"] = journal.get("journal_mode", "unknown") if journal else "unknown"
    if results["journal_mode"] != "wal":
        results["issues"].append("Journal mode is not WAL (expected WAL for performance)")

    # Summary
    total_tables = len(expected_tables)
    existing_count = sum(1 for t in expected_tables if t in existing_names)
    total_indexes = len(expected_indexes)
    existing_idx_count = sum(1 for i in expected_indexes if i in existing_idx_names)

    results["summary"] = {
        "tables": f"{existing_count}/{total_tables}",
        "indexes": f"{existing_idx_count}/{total_indexes}",
        "total_issues": len(results["issues"]),
    }

    if results["issues"]:
        results["migration_status"] = "needs_attention"

    return results
