"""
Web Search Tools for the CyberGuard AI Concierge.

Primary backend  : Apify Google Search Scraper (apify~google-search-scraper)
Fallback backend : Tavily Search API

Both `cyber_web_search` and `cyber_news_search` are exported with the same
signatures as before — no changes required in agent.py or __init__.py.
"""

import logging
import os

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Apify — synchronous run (no polling needed)
# ---------------------------------------------------------------------------
_APIFY_RUN_SYNC = (
    "https://api.apify.com/v2/acts/apify~google-search-scraper"
    "/run-sync-get-dataset-items"
)

# ---------------------------------------------------------------------------
# Tavily (fallback)
# ---------------------------------------------------------------------------
_TAVILY_API_URL = "https://api.tavily.com/search"


# ===========================================================================
# Apify helpers
# ===========================================================================

def _apify_search(query: str, search_type: str = "web", num_results: int = 8) -> list[dict]:
    """
    Run the Apify Google Search Scraper synchronously and return raw items.
    search_type: "web" | "news"
    Raises on HTTP error so the caller can fall back to Tavily.
    """
    api_key = os.getenv("APIFY_API_KEY", "")
    if not api_key:
        raise ValueError("APIFY_API_KEY is not configured.")

    payload: dict = {
        "queries": query,
        "maxPagesPerQuery": 1,
        "resultsPerPage": num_results,
        "languageCode": "en",
        "countryCode": "us",
        "mobileResults": False,
    }
    if search_type == "news":
        payload["searchType"] = "news"

    with httpx.Client(timeout=55.0) as client:
        resp = client.post(
            _APIFY_RUN_SYNC,
            params={"token": api_key},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()  # list of dataset items


def _format_apify(items: list[dict], query: str) -> str:
    """Convert Apify dataset items to a readable string."""
    lines = [f"Search results for: '{query}'\n"]
    found = 0

    for item in items:
        # Items can be nested (organicResults / newsResults / topStories)
        # or flat (when the scraper returns one result per item).
        for key in ("organicResults", "newsResults", "topStories"):
            sub = item.get(key)
            if isinstance(sub, list):
                for r in sub:
                    title = r.get("title") or r.get("heading") or "No title"
                    url = r.get("url") or r.get("link") or ""
                    snippet = (r.get("description") or r.get("snippet") or "")[:500]
                    date = r.get("date") or r.get("publishedAt") or ""
                    date_str = f"  ({date})" if date else ""
                    lines.append(f"• {title}{date_str}\n  {url}\n  {snippet}\n")
                    found += 1

        # Flat result format (title / url / description at the top level)
        if not found and item.get("title"):
            title = item.get("title", "No title")
            url = item.get("url") or item.get("link") or ""
            snippet = (item.get("description") or item.get("snippet") or "")[:500]
            date = item.get("date") or ""
            date_str = f"  ({date})" if date else ""
            lines.append(f"• {title}{date_str}\n  {url}\n  {snippet}\n")
            found += 1

    if found == 0:
        return f"No results found for: '{query}'"

    return "\n".join(lines)


# ===========================================================================
# Tavily helpers (fallback)
# ===========================================================================

def _tavily_search(query: str, topic: str = "general", max_results: int = 8) -> dict:
    """Raw Tavily search — returns the full JSON response dict."""
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key:
        return {"error": "TAVILY_API_KEY is not configured."}

    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "topic": topic,
        "max_results": max_results,
        "include_answer": True,
        "include_raw_content": False,
    }

    with httpx.Client(timeout=25.0) as client:
        resp = client.post(_TAVILY_API_URL, json=payload)
        resp.raise_for_status()
        return resp.json()


def _format_tavily(data: dict, query: str) -> str:
    results = data.get("results", [])
    if not results:
        return f"No results found for: '{query}'"

    lines = [f"Search results for: '{query}'\n"]
    if data.get("answer"):
        lines.append(f"Summary: {data['answer']}\n")

    for r in results:
        title = r.get("title", "No title")
        url = r.get("url", "")
        content = r.get("content", "")[:500]
        published = r.get("published_date", "")
        date_str = f"  ({published})" if published else ""
        lines.append(f"• {title}{date_str}\n  {url}\n  {content}\n")

    return "\n".join(lines)


# ===========================================================================
# Unified search with automatic fallback
# ===========================================================================

def _search_with_fallback(query: str, search_type: str = "web") -> str:
    """
    Try Apify first; if it fails or returns nothing, fall back to Tavily.
    search_type: "web" | "news"
    """
    apify_key = os.getenv("APIFY_API_KEY", "")

    # ── Apify path ──────────────────────────────────────────────────────────
    if apify_key:
        try:
            items = _apify_search(query, search_type=search_type)
            if items:
                result = _format_apify(items, query)
                if "No results found" not in result:
                    logger.info("Apify search succeeded for: %s", query)
                    return result
            logger.warning("Apify returned empty results for: %s — trying Tavily", query)
        except httpx.HTTPStatusError as exc:
            # 402 = quota exceeded, 401 = bad key — log and fall through
            logger.warning(
                "Apify HTTP %s for '%s': %s — falling back to Tavily",
                exc.response.status_code, query, exc.response.text[:200],
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Apify error for '%s': %s — falling back to Tavily", query, exc)
    else:
        logger.info("APIFY_API_KEY not set — using Tavily directly.")

    # ── Tavily fallback ─────────────────────────────────────────────────────
    tavily_topic = "news" if search_type == "news" else "general"
    try:
        data = _tavily_search(query, topic=tavily_topic)
        if "error" in data:
            return data["error"]
        return _format_tavily(data, query)
    except httpx.HTTPStatusError as exc:
        return f"Search error {exc.response.status_code}: {exc.response.text[:200]}"
    except Exception as exc:  # noqa: BLE001
        return f"Search error: {exc}"


# ===========================================================================
# LangChain tools (same names / signatures as before)
# ===========================================================================

@tool
def cyber_web_search(query: str) -> str:
    """
    Search the web for cybersecurity topics, AI security research, threat intelligence,
    vulnerability disclosures, ransomware campaigns, APT activity, compliance updates,
    and emerging information security developments. Searches the full web.
    Use this for any factual or recent-events question.
    Input: a natural language search query (e.g. 'latest ransomware trends 2025',
    'AI security risks', 'zero-day exploits this week').
    """
    return _search_with_fallback(query, search_type="web")


@tool
def cyber_news_search(query: str) -> str:
    """
    Fetch the LATEST breaking cybersecurity and AI security news articles.
    Use this specifically when the user asks about: current news, recent events,
    what happened this week/month, latest breaches, new malware, upcoming trends,
    AI security developments, or anything time-sensitive.
    Returns the most recently published articles from Google News via Apify.
    Input: a news-focused query (e.g. 'latest cyber attacks', 'AI security news today',
    'ransomware news 2025', 'information security trends').
    """
    return _search_with_fallback(query, search_type="news")
