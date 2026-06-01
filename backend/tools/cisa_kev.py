"""
CISA Known Exploited Vulnerabilities (KEV) Catalog Tool.
Fetches the live KEV feed from CISA and returns the most recently added entries.
"""

import httpx
from datetime import datetime, timedelta
from langchain_core.tools import tool


CISA_KEV_URL = (
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
)


@tool
def cisa_kev_search(query: str) -> str:
    """
    Fetch CISA Known Exploited Vulnerabilities (KEV) catalog.
    Returns the most recently added actively-exploited CVEs that organizations must patch.
    Use for questions about: recent vulnerabilities, actively exploited CVEs, CISA alerts,
    mandatory patch deadlines, and urgent security advisories.
    Input: 'recent', 'latest', a CVE ID (e.g. 'CVE-2024-1234'), or a vendor/product name.
    """
    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.get(CISA_KEV_URL)
            resp.raise_for_status()
            data = resp.json()

        vulns: list[dict] = data.get("vulnerabilities", [])
        vulns.sort(key=lambda v: v.get("dateAdded", ""), reverse=True)

        q = query.strip().lower()

        # Filter by CVE ID
        if q.startswith("cve-"):
            matches = [v for v in vulns if v.get("cveID", "").lower() == q]
            if not matches:
                return f"CVE '{query}' not found in the CISA KEV catalog."
            vulns = matches[:1]

        # Filter by vendor/product
        elif q not in ("recent", "latest", "all", ""):
            matches = [
                v
                for v in vulns
                if q in v.get("vendorProject", "").lower()
                or q in v.get("product", "").lower()
                or q in v.get("vulnerabilityName", "").lower()
            ]
            vulns = matches[:10] if matches else vulns[:10]

        else:
            # Default: last 30 days
            cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
            recent = [v for v in vulns if v.get("dateAdded", "") >= cutoff]
            vulns = recent[:10] if recent else vulns[:10]

        total = len(data.get("vulnerabilities", []))
        lines = [f"CISA KEV — {len(vulns)} entries shown (catalog total: {total})\n"]

        for v in vulns:
            lines.append(
                f"• {v.get('cveID', 'N/A')}  |  "
                f"{v.get('vendorProject', '')} / {v.get('product', '')}\n"
                f"  Name: {v.get('vulnerabilityName', '')}\n"
                f"  Added: {v.get('dateAdded', 'N/A')}  |  "
                f"Fed. Due: {v.get('dueDate', 'N/A')}\n"
                f"  {v.get('shortDescription', '')[:200]}\n"
            )

        return "\n".join(lines)

    except httpx.HTTPError as exc:
        return f"Network error fetching CISA KEV: {exc}"
    except Exception as exc:  # noqa: BLE001
        return f"Unexpected error in cisa_kev_search: {exc}"
