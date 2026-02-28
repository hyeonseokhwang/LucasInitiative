"""
Multi-source search engine: DuckDuckGo + Google + Naver.
Results are deduplicated and merged.
"""
import os
import httpx
from bs4 import BeautifulSoup
from ddgs import DDGS
from dotenv import load_dotenv

load_dotenv()

_NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
_NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")


# ─── Individual Search Engines ───

async def _search_ddg(query: str, max_results: int = 5) -> list[dict]:
    """DuckDuckGo search."""
    try:
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=max_results))
        return [
            {"title": r.get("title", ""), "url": r.get("href", r.get("url", "")),
             "body": r.get("body", ""), "source_engine": "duckduckgo"}
            for r in raw if r.get("title")
        ]
    except Exception as e:
        print(f"[Search] DuckDuckGo error: {e}")
        return []


async def _search_google(query: str, max_results: int = 5) -> list[dict]:
    """Google search via googlesearch-python."""
    try:
        from googlesearch import search as gsearch
        results = []
        for url in gsearch(query, num_results=max_results, lang="ko"):
            results.append({
                "title": url.split("/")[-1][:80] or url[:80],
                "url": url,
                "body": "",
                "source_engine": "google",
            })
        return results
    except Exception as e:
        print(f"[Search] Google error: {e}")
        return []


async def _search_naver(query: str, max_results: int = 5) -> list[dict]:
    """Naver Search API (news). Requires NAVER_CLIENT_ID/SECRET."""
    if not _NAVER_CLIENT_ID or not _NAVER_CLIENT_SECRET:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://openapi.naver.com/v1/search/news.json",
                params={"query": query, "display": max_results, "sort": "date"},
                headers={
                    "X-Naver-Client-Id": _NAVER_CLIENT_ID,
                    "X-Naver-Client-Secret": _NAVER_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
        return [
            {
                "title": _strip_html(item.get("title", "")),
                "url": item.get("link", ""),
                "body": _strip_html(item.get("description", "")),
                "source_engine": "naver",
            }
            for item in items
        ]
    except Exception as e:
        print(f"[Search] Naver error: {e}")
        return []


def _strip_html(text: str) -> str:
    """Remove HTML tags from Naver API response."""
    import re
    return re.sub(r"<[^>]+>", "", text).strip()


# ─── Unified Multi-Source Search ───

async def search_web(query: str, max_results: int = 5) -> list[dict]:
    """Search using all available engines, deduplicate by URL/title."""
    all_results = []
    seen = set()

    # DuckDuckGo (primary)
    ddg = await _search_ddg(query, max_results)
    for r in ddg:
        key = r.get("url", "") or r.get("title", "")
        if key and key not in seen:
            seen.add(key)
            all_results.append(r)

    # Naver (if configured)
    naver = await _search_naver(query, max_results)
    for r in naver:
        key = r.get("url", "") or r.get("title", "")
        if key and key not in seen:
            seen.add(key)
            all_results.append(r)

    # Google (supplementary, only if we have few results)
    if len(all_results) < max_results:
        google = await _search_google(query, max_results - len(all_results))
        for r in google:
            key = r.get("url", "") or r.get("title", "")
            if key and key not in seen:
                seen.add(key)
                all_results.append(r)

    return all_results[:max_results * 2]  # allow slightly more for quality


async def search_multilingual(query_ko: str, max_per_lang: int = 3) -> list[dict]:
    """Search in Korean + English + Japanese. Translate query via Ollama."""
    all_results = []

    # Korean (original)
    kr = await search_web(query_ko, max_per_lang)
    all_results.extend(kr)

    # English translation
    en_query = await _translate_query(query_ko, "English")
    if en_query and en_query != query_ko:
        en = await search_web(en_query, max_per_lang)
        all_results.extend(en)

    # Japanese (for Asian market context)
    jp_query = await _translate_query(query_ko, "Japanese")
    if jp_query and jp_query != query_ko:
        jp = await search_web(jp_query, max_per_lang)
        all_results.extend(jp)

    return all_results


async def _translate_query(query: str, target_lang: str) -> str:
    """Translate a search query using local Ollama. Fast, no API cost."""
    try:
        from services.ollama_service import chat_stream

        prompt = f"Translate this search query to {target_lang}. Return ONLY the translated query, nothing else:\n{query}"
        result = ""
        async for chunk in chat_stream(
            "gemma2:2b",  # fastest model for translation
            [{"role": "user", "content": prompt}]
        ):
            if chunk.get("message", {}).get("content"):
                result += chunk["message"]["content"]
            if chunk.get("done"):
                break
        # Clean up: take first line, strip quotes
        result = result.strip().split("\n")[0].strip('"\'')
        return result if len(result) > 2 else ""
    except Exception as e:
        print(f"[Search] Translation error ({target_lang}): {e}")
        return ""


# ─── Page Fetching ───

async def fetch_page(url: str, max_chars: int = 5000) -> dict:
    """Fetch a web page and extract clean text content."""
    try:
        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        clean = "\n".join(lines)

        if len(clean) > max_chars:
            clean = clean[:max_chars] + "\n...(truncated)"

        title = soup.title.string if soup.title else url
        return {"url": url, "title": title, "content": clean, "length": len(clean)}

    except Exception as e:
        return {"url": url, "title": "Error", "content": str(e), "length": 0}


async def search_and_summarize(query: str, max_results: int = 3) -> str:
    """Search web and return formatted results for LLM consumption."""
    results = await search_web(query, max_results=max_results)
    if not results:
        return "No search results found."
    parts = [f"## Search results for: {query}\n"]
    for i, r in enumerate(results, 1):
        parts.append(f"### {i}. {r.get('title', 'No title')}")
        parts.append(f"URL: {r.get('url', '')}")
        parts.append(f"Source: {r.get('source_engine', 'unknown')}")
        parts.append(f"{r.get('body', '')}\n")
    return "\n".join(parts)
