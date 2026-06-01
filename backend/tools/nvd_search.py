"""
NVD (National Vulnerability Database) CVE Search Tool.
Queries the NVD API v2 for CVE details, CVSS scores, and descriptions.
"""

import httpx
from langchain_core.tools import tool


NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
NVD_HEADERS = {"User-Agent": "CyberGuard-AI-Concierge/1.0"}


@tool
def nvd_cve_search(query: str) -> str:
    """
    Search the National Vulnerability Database (NVD) for CVE details.
    Returns CVE descriptions, CVSS v3 scores, severity ratings, and affected products.
    Use for: specific CVE lookups, vulnerability severity analysis, recent CVEs by keyword,
    CVEs affecting a specific vendor/product (e.g. 'Microsoft Exchange', 'Apache Log4j').
    Input: a CVE ID like 'CVE-2024-1234', a keyword, or a product name.
    """
    try:
        q = query.strip()
        params: dict = {"resultsPerPage": 8}

        if q.upper().startswith("CVE-"):
            params["cveId"] = q.upper()
        else:
            params["keywordSearch"] = q
            params["keywordExactMatch"] = False

        with httpx.Client(timeout=15.0, headers=NVD_HEADERS) as client:
            resp = client.get(NVD_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("vulnerabilities", [])
        if not items:
            return f"No CVEs found in NVD for query: '{query}'"

        total = data.get("totalResults", len(items))
        lines = [f"NVD CVE Search — '{query}' ({len(items)} of {total} results)\n"]

        for item in items:
            cve = item.get("cve", {})
            cve_id = cve.get("id", "N/A")

            # Description (English)
            descs = cve.get("descriptions", [])
            description = next(
                (d["value"] for d in descs if d.get("lang") == "en"),
                "No description available.",
            )[:300]

            # CVSS v3 score
            metrics = cve.get("metrics", {})
            cvss_score = "N/A"
            severity = "N/A"
            cvss_v3 = metrics.get("cvssMetricV31") or metrics.get("cvssMetricV30")
            if cvss_v3:
                cvss_data = cvss_v3[0].get("cvssData", {})
                cvss_score = cvss_data.get("baseScore", "N/A")
                severity = cvss_data.get("baseSeverity", "N/A")

            published = cve.get("published", "")[:10]
            modified = cve.get("lastModified", "")[:10]

            lines.append(
                f"• {cve_id}  |  CVSS: {cvss_score} ({severity})  "
                f"|  Published: {published}  |  Modified: {modified}\n"
                f"  {description}\n"
            )

        return "\n".join(lines)

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 403:
            return "NVD API rate limit hit. Please wait ~6 seconds between requests."
        return f"NVD API HTTP error: {exc}"
    except Exception as exc:  # noqa: BLE001
        return f"Unexpected error in nvd_cve_search: {exc}"
