"""
Simple API key authentication middleware.
If DASHBOARD_API_KEY env var is set, all /api/* requests must include:
  - Header: X-API-Key: <key>
  - OR query param: ?api_key=<key>
If DASHBOARD_API_KEY is not set, all requests pass through (no auth).
"""
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Lightweight API key gate for /api/* routes."""

    def __init__(self, app):
        super().__init__(app)
        self._api_key = os.getenv("DASHBOARD_API_KEY", "").strip()

    async def dispatch(self, request: Request, call_next):
        # Skip auth if no key configured
        if not self._api_key:
            return await call_next(request)

        path = request.url.path

        # Only protect /api/* routes (exclude health check, static, ws)
        if not path.startswith("/api/"):
            return await call_next(request)

        # Allow health check without auth
        if path == "/api/health":
            return await call_next(request)

        # Check header first, then query param
        provided = request.headers.get("X-API-Key", "")
        if not provided:
            provided = request.query_params.get("api_key", "")

        if provided != self._api_key:
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid or missing API key", "hint": "Set X-API-Key header or api_key query param"},
            )

        return await call_next(request)
