"""Technical indicator calculations using pandas.

All functions take a pandas DataFrame with OHLCV columns
(Open, High, Low, Close, Volume) and return results as list[dict]
suitable for JSON serialization.
"""

import pandas as pd
import numpy as np


def _series_to_list(series: pd.Series, date_index) -> list[dict]:
    """Convert a pandas Series + DatetimeIndex to list of {date, value}."""
    result = []
    for idx, val in zip(date_index, series):
        if pd.isna(val):
            continue
        result.append({
            "date": idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx),
            "value": round(float(val), 4),
        })
    return result


def calc_sma(df: pd.DataFrame, periods: list[int] | None = None) -> dict:
    """Simple Moving Average.

    Args:
        df: OHLCV DataFrame
        periods: List of periods (default: [5, 10, 20, 50, 200])

    Returns:
        {period: [{date, value}, ...], ...}
    """
    if df.empty:
        return {}
    if periods is None:
        periods = [5, 10, 20, 50, 200]

    close = df["Close"]
    result = {}
    for p in periods:
        sma = close.rolling(window=p).mean()
        result[f"sma{p}"] = _series_to_list(sma, df.index)
    return result


def calc_ema(df: pd.DataFrame, periods: list[int] | None = None) -> dict:
    """Exponential Moving Average.

    Args:
        df: OHLCV DataFrame
        periods: List of periods (default: [12, 26, 50])

    Returns:
        {period: [{date, value}, ...], ...}
    """
    if df.empty:
        return {}
    if periods is None:
        periods = [12, 26, 50]

    close = df["Close"]
    result = {}
    for p in periods:
        ema = close.ewm(span=p, adjust=False).mean()
        result[f"ema{p}"] = _series_to_list(ema, df.index)
    return result


def calc_rsi(df: pd.DataFrame, period: int = 14) -> list[dict]:
    """Relative Strength Index (Wilder's method).

    Args:
        df: OHLCV DataFrame
        period: RSI period (default: 14)

    Returns:
        [{date, value}, ...]  (value 0-100)
    """
    if df.empty or len(df) < period + 1:
        return []

    close = df["Close"]
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)

    # Wilder's smoothing (exponential)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))

    return _series_to_list(rsi, df.index)


def calc_macd(
    df: pd.DataFrame,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> dict:
    """MACD (Moving Average Convergence Divergence).

    Args:
        df: OHLCV DataFrame
        fast: Fast EMA period (default: 12)
        slow: Slow EMA period (default: 26)
        signal: Signal line period (default: 9)

    Returns:
        {
            "macd": [{date, value}],
            "signal": [{date, value}],
            "histogram": [{date, value}]
        }
    """
    if df.empty or len(df) < slow + signal:
        return {"macd": [], "signal": [], "histogram": []}

    close = df["Close"]
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line

    return {
        "macd": _series_to_list(macd_line, df.index),
        "signal": _series_to_list(signal_line, df.index),
        "histogram": _series_to_list(histogram, df.index),
    }


def calc_bollinger_bands(
    df: pd.DataFrame,
    period: int = 20,
    std_dev: float = 2.0,
) -> dict:
    """Bollinger Bands.

    Args:
        df: OHLCV DataFrame
        period: Moving average period (default: 20)
        std_dev: Standard deviation multiplier (default: 2.0)

    Returns:
        {
            "upper": [{date, value}],
            "middle": [{date, value}],
            "lower": [{date, value}],
            "bandwidth": [{date, value}]
        }
    """
    if df.empty or len(df) < period:
        return {"upper": [], "middle": [], "lower": [], "bandwidth": []}

    close = df["Close"]
    middle = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    bandwidth = ((upper - lower) / middle) * 100

    return {
        "upper": _series_to_list(upper, df.index),
        "middle": _series_to_list(middle, df.index),
        "lower": _series_to_list(lower, df.index),
        "bandwidth": _series_to_list(bandwidth, df.index),
    }


def calc_all_indicators(
    df: pd.DataFrame,
    sma_periods: list[int] | None = None,
    ema_periods: list[int] | None = None,
    rsi_period: int = 14,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    bb_period: int = 20,
    bb_std: float = 2.0,
) -> dict:
    """Calculate all indicators at once.

    Returns:
        {
            "sma": {...},
            "ema": {...},
            "rsi": [...],
            "macd": {...},
            "bollinger": {...},
            "ohlcv": [...]
        }
    """
    if df.empty:
        return {"sma": {}, "ema": {}, "rsi": [], "macd": {}, "bollinger": {}, "ohlcv": []}

    # OHLCV data
    ohlcv = []
    for idx, row in df.iterrows():
        ohlcv.append({
            "date": idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })

    return {
        "sma": calc_sma(df, sma_periods),
        "ema": calc_ema(df, ema_periods),
        "rsi": calc_rsi(df, rsi_period),
        "macd": calc_macd(df, macd_fast, macd_slow, macd_signal),
        "bollinger": calc_bollinger_bands(df, bb_period, bb_std),
        "ohlcv": ohlcv,
    }
