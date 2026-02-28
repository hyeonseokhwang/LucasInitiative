import httpx
from bs4 import BeautifulSoup
from ddgs import DDGS


async def search_web(query: str, max_results: int = 5) -> list[dict]:
    """Search the web using DuckDuckGo. Returns list of {title, url, body}."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return results
    except Exception as e:
        return [{"title": "Search Error", "url": "", "body": str(e)}]


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

        # Remove script, style, nav, footer
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)

        # Collapse blank lines
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
        parts.append(f"URL: {r.get('href', r.get('url', ''))}")
        parts.append(f"{r.get('body', '')}\n")

    return "\n".join(parts)
