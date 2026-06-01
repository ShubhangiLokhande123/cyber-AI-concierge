"""
Web Search Tool (Tavily) for latest cybersecurity news,
AI security trends, threat intelligence, and emerging vulnerabilities.
"""

import os
import httpx
from langchain_core.tools import tool

TAVILY_API_URL = "https://api.tavily.com/search"

CYBER_DOMAINS = [
    "bleepingcomputer.com",
    "threatpost.com",
    "darkreading.com",
    "krebsonsecurity.com",
    "therecord.media",
    "securityweek.com",
    "cyberscoop.com",
    "wired.com",
    "arstechnica.com",
    "arxiv.org",
    "nist.gov",
    "cisa.gov",
]


@tool
def cyber_web_search(query: str) -> str:
    """
    Search the web for the latest cybersecurity news, AI security trends,
    threat intelligence reports, ransomware campaigns, APT activity,
    zero-day disclosures, and emerging information security developments.
    Use for: current events, recent breaches, AI/ML security research,
    upcoming security conferences, compliance updates, and threat actor profiles.
    Input: a natural language search query.
    """
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key:
        return "TAVILY_API_KEY is not configured. Web search unavailable."

    try:
        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": "advanced",
            "include_domains": CYBER_DOMAINS,
            "max_results": 6,
            "include_answer": True,
        }

        with httpx.Client(timeout=20.0) as client:
            resp = client.post(TAVILY_API_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", [])
        if not results:
            return f"No results found for: '{query}'"

        lines = [f"Web Search Results for: '{query}'\n"]

        if data.get("answer"):
            lines.append(f"Summary: {data['answer']}\n")

        for r in results:
            title = r.get("title", "No title")
            url = r.get("url", "")
            content = r.get("content", "")[:350]
            published = r.get("published_date", "")
            date_str = f"  ({published})" if published else ""
            lines.append(f"• {title}{date_str}\n  {url}\n  {content}\n")

        return "\n".join(lines)

    except httpx.HTTPStatusError as exc:
        return f"Tavily API error {exc.response.status_code}: {exc.response.text[:200]}"
    except Exception as exc:  # noqa: BLE001
        return f"Web search error: {exc}"
