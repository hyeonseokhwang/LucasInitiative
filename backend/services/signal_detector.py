"""
Stock Signal Detector — detects technical trading signals.

Signals:
  - Moving Average Cross (Golden Cross / Death Cross)
  - RSI Overbought / Oversold
  - Volume Breakout

Uses existing indicator_service.py for calculations.
"""
import asyncio
from datetime import datetime
from services.stock_service import (
    fetch_stock_history_dataframe,
    DEFAULT_KR_STOCKS,
    DEFAULT_US_STOCKS,
    STOCK_SECTORS,
)
from services.indicator_service import calc_sma, calc_rsi
from services.db_service import execute, fetch_all
from ws.handler import manager as ws_manager


# Signal types
SIGNAL_GOLDEN_CROSS = "golden_cross"       # Short MA crosses above Long MA
SIGNAL_DEATH_CROSS = "death_cross"         # Short MA crosses below Long MA
SIGNAL_RSI_OVERSOLD = "rsi_oversold"       # RSI < 30
SIGNAL_RSI_OVERBOUGHT = "rsi_overbought"   # RSI > 70
SIGNAL_VOLUME_BREAKOUT = "volume_breakout"  # Volume > 2x average


async def _detect_ma_cross(symbol: str, name: str, short: int, long: int) -> list[dict]:
    """Detect moving average crossovers in the last 3 days."""
    signals = []
    try:
        df = await fetch_stock_history_dataframe(symbol, period="3mo")
        if df is None or df.empty or len(df) < long + 3:
            return []

        close = df["Close"]
        sma_short = close.rolling(window=short).mean()
        sma_long = close.rolling(window=long).mean()

        # Check last 3 data points for crossover
        for i in range(-3, 0):
            if i - 1 < -len(df):
                continue

            prev_diff = sma_short.iloc[i - 1] - sma_long.iloc[i - 1]
            curr_diff = sma_short.iloc[i] - sma_long.iloc[i]

            if prev_diff <= 0 < curr_diff:
                # Golden cross
                date_str = df.index[i].strftime("%Y-%m-%d") if hasattr(df.index[i], "strftime") else str(df.index[i])
                signals.append({
                    "symbol": symbol,
                    "name": name,
                    "type": SIGNAL_GOLDEN_CROSS,
                    "detail": f"{short}/{long}일 골든크로스",
                    "price": round(float(close.iloc[i]), 2),
                    "date": date_str,
                    "strength": "strong" if short == 20 and long == 60 else "moderate",
                })

            elif prev_diff >= 0 > curr_diff:
                # Death cross
                date_str = df.index[i].strftime("%Y-%m-%d") if hasattr(df.index[i], "strftime") else str(df.index[i])
                signals.append({
                    "symbol": symbol,
                    "name": name,
                    "type": SIGNAL_DEATH_CROSS,
                    "detail": f"{short}/{long}일 데드크로스",
                    "price": round(float(close.iloc[i]), 2),
                    "date": date_str,
                    "strength": "strong" if short == 20 and long == 60 else "moderate",
                })

    except Exception as e:
        print(f"[SignalDetector] MA cross error ({symbol}): {e}")

    return signals


async def _detect_rsi_signal(symbol: str, name: str, period: int = 14) -> list[dict]:
    """Detect RSI overbought/oversold conditions."""
    signals = []
    try:
        df = await fetch_stock_history_dataframe(symbol, period="3mo")
        if df is None or df.empty or len(df) < period + 5:
            return []

        rsi_data = calc_rsi(df, period)
        if not rsi_data:
            return []

        # Check last 3 data points
        for item in rsi_data[-3:]:
            rsi_val = item["value"]
            if rsi_val <= 30:
                signals.append({
                    "symbol": symbol,
                    "name": name,
                    "type": SIGNAL_RSI_OVERSOLD,
                    "detail": f"RSI {rsi_val:.1f} (과매도)",
                    "price": 0,  # Will be filled later
                    "date": item["date"],
                    "strength": "strong" if rsi_val <= 20 else "moderate",
                })
            elif rsi_val >= 70:
                signals.append({
                    "symbol": symbol,
                    "name": name,
                    "type": SIGNAL_RSI_OVERBOUGHT,
                    "detail": f"RSI {rsi_val:.1f} (과매수)",
                    "price": 0,
                    "date": item["date"],
                    "strength": "strong" if rsi_val >= 80 else "moderate",
                })

    except Exception as e:
        print(f"[SignalDetector] RSI error ({symbol}): {e}")

    return signals


async def _detect_volume_breakout(symbol: str, name: str) -> list[dict]:
    """Detect abnormal volume (> 2x 20-day average)."""
    signals = []
    try:
        df = await fetch_stock_history_dataframe(symbol, period="3mo")
        if df is None or df.empty or len(df) < 25:
            return []

        vol = df["Volume"]
        avg_vol = vol.rolling(window=20).mean()

        # Check last trading day
        latest_vol = vol.iloc[-1]
        latest_avg = avg_vol.iloc[-1]

        if latest_avg > 0 and latest_vol > latest_avg * 2:
            ratio = latest_vol / latest_avg
            date_str = df.index[-1].strftime("%Y-%m-%d") if hasattr(df.index[-1], "strftime") else str(df.index[-1])
            signals.append({
                "symbol": symbol,
                "name": name,
                "type": SIGNAL_VOLUME_BREAKOUT,
                "detail": f"거래량 {ratio:.1f}배 급증",
                "price": round(float(df["Close"].iloc[-1]), 2),
                "date": date_str,
                "strength": "strong" if ratio > 3 else "moderate",
            })

    except Exception as e:
        print(f"[SignalDetector] Volume error ({symbol}): {e}")

    return signals


async def scan_all_signals() -> list[dict]:
    """Scan all tracked stocks for signals. Returns list of detected signals."""
    all_signals = []
    all_stocks = {**DEFAULT_KR_STOCKS, **DEFAULT_US_STOCKS}

    print(f"[SignalDetector] Scanning {len(all_stocks)} stocks...")
    start = datetime.now()

    for symbol, name in all_stocks.items():
        # MA crosses: 5/20 and 20/60
        signals = await _detect_ma_cross(symbol, name, 5, 20)
        all_signals.extend(signals)

        signals = await _detect_ma_cross(symbol, name, 20, 60)
        all_signals.extend(signals)

        # RSI
        signals = await _detect_rsi_signal(symbol, name)
        all_signals.extend(signals)

        # Volume
        signals = await _detect_volume_breakout(symbol, name)
        all_signals.extend(signals)

        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)

    elapsed = (datetime.now() - start).total_seconds()
    print(f"[SignalDetector] Scan complete: {len(all_signals)} signals found in {elapsed:.1f}s")

    # Save to DB and notify
    if all_signals:
        await _save_signals(all_signals)
        await _notify_signals(all_signals)

    return all_signals


async def _save_signals(signals: list[dict]):
    """Save detected signals to collected_items table."""
    import json
    for sig in signals:
        await execute(
            """INSERT INTO collected_items (category, title, content, source, url, content_hash, extra)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "signal",
                f"[{sig['type']}] {sig['name']}",
                sig["detail"],
                "signal_detector",
                "",
                f"sig_{sig['symbol']}_{sig['type']}_{sig['date']}",
                json.dumps(sig, ensure_ascii=False),
            ),
        )


async def _notify_signals(signals: list[dict]):
    """Broadcast signals to WebSocket and optionally Telegram."""
    strong = [s for s in signals if s["strength"] == "strong"]
    if not strong:
        return

    alert_text = "[Signal Alert]\n"
    for s in strong:
        emoji = {"golden_cross": "GC", "death_cross": "DC", "rsi_oversold": "RSI↓", "rsi_overbought": "RSI↑", "volume_breakout": "VOL"}
        alert_text += f"  [{emoji.get(s['type'], '?')}] {s['name']}: {s['detail']}\n"

    await ws_manager.broadcast({
        "type": "collector_alert",
        "data": {"category": "signal", "message": alert_text, "count": len(strong)},
    })

    # Telegram (optional)
    try:
        from services.telegram_service import send_alert
        await send_alert(alert_text)
    except Exception:
        pass

    # Notification DB
    try:
        from services.notification_service import create_notification
        await create_notification("signal", "Trading Signal Detected", alert_text)
    except Exception:
        pass


async def get_recent_signals(limit: int = 50) -> list[dict]:
    """Get recently detected signals from DB."""
    import json
    rows = await fetch_all(
        "SELECT * FROM collected_items WHERE category = 'signal' ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
    result = []
    for r in rows:
        try:
            extra = json.loads(r.get("extra", "{}"))
            result.append(extra)
        except Exception:
            result.append(dict(r))
    return result
