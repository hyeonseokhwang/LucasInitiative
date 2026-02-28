import time
import httpx
from fastapi import APIRouter
from services.db_service import fetch_all, fetch_one

router = APIRouter()

# Exchange rate cache (1 hour)
_rate_cache = {"rate": 1400.0, "fetched_at": 0}


async def get_usd_krw() -> float:
    """Fetch live USD/KRW rate, cached for 1 hour."""
    now = time.time()
    if now - _rate_cache["fetched_at"] < 3600:
        return _rate_cache["rate"]

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://open.er-api.com/v6/latest/USD")
            data = resp.json()
            rate = data["rates"]["KRW"]
            _rate_cache["rate"] = rate
            _rate_cache["fetched_at"] = now
            return rate
    except Exception:
        return _rate_cache["rate"]  # fallback to last known or default


@router.get("")
async def get_usage():
    """Get overall API usage summary."""
    # From api_usage table (new data)
    tracked = await fetch_one(
        """SELECT
             COALESCE(SUM(input_tokens), 0) as total_input,
             COALESCE(SUM(output_tokens), 0) as total_output,
             COALESCE(SUM(cost_usd), 0) as total_cost,
             COUNT(*) as call_count
           FROM api_usage"""
    )

    # Also estimate from old messages (before api_usage table existed)
    old_msgs = await fetch_one(
        """SELECT
             COALESCE(SUM(tokens_used), 0) as total_output,
             COUNT(*) as call_count
           FROM messages
           WHERE model LIKE 'supervisor%'
             AND id NOT IN (SELECT DISTINCT purpose FROM api_usage WHERE purpose IS NOT NULL)"""
    )

    # Estimate old input tokens (system prompt ~800 + user ~100 per call)
    old_input_est = (old_msgs["call_count"] or 0) * 900
    old_output = old_msgs["total_output"] or 0
    old_cost = (old_input_est / 1_000_000 * 1.0) + (old_output / 1_000_000 * 5.0)

    total_input = (tracked["total_input"] or 0) + old_input_est
    total_output = (tracked["total_output"] or 0) + old_output
    total_cost = (tracked["total_cost"] or 0) + old_cost
    total_calls = (tracked["call_count"] or 0) + (old_msgs["call_count"] or 0)

    rate = await get_usd_krw()
    budget = 5.0

    return {
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_tokens": total_input + total_output,
        "total_cost_usd": round(total_cost, 6),
        "total_cost_krw": round(total_cost * rate, 0),
        "api_calls": total_calls,
        "budget_usd": budget,
        "budget_remaining_usd": round(budget - total_cost, 4),
        "budget_remaining_krw": round((budget - total_cost) * rate, 0),
        "exchange_rate": round(rate, 2),
    }


@router.get("/daily")
async def get_daily_usage():
    """Get daily breakdown."""
    rows = await fetch_all(
        """SELECT
             date(created_at) as day,
             SUM(input_tokens) as input_tokens,
             SUM(output_tokens) as output_tokens,
             SUM(cost_usd) as cost_usd,
             COUNT(*) as calls
           FROM api_usage
           GROUP BY date(created_at)
           ORDER BY day DESC
           LIMIT 30"""
    )
    return {"daily": rows}
