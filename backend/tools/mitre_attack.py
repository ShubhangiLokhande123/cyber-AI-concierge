"""
MITRE ATT&CK Framework Tool.
Queries the MITRE ATT&CK STIX data to look up techniques, tactics, and threat groups.
"""

import httpx
from langchain_core.tools import tool


MITRE_ATTACK_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
)

# Lightweight technique index cached in module scope after first fetch
_technique_cache: list[dict] | None = None


def _load_attack_data() -> list[dict]:
    global _technique_cache  # noqa: PLW0603
    if _technique_cache is not None:
        return _technique_cache

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(MITRE_ATTACK_URL)
            resp.raise_for_status()
            data = resp.json()

        techniques = []
        for obj in data.get("objects", []):
            if obj.get("type") not in ("attack-pattern", "intrusion-set", "malware", "tool"):
                continue
            if obj.get("revoked") or obj.get("x_mitre_deprecated"):
                continue

            ext_refs = obj.get("external_references", [])
            att_id = next(
                (r.get("external_id", "") for r in ext_refs if r.get("source_name") == "mitre-attack"),
                "",
            )

            techniques.append(
                {
                    "id": att_id,
                    "name": obj.get("name", ""),
                    "type": obj.get("type", ""),
                    "description": obj.get("description", "")[:400],
                    "phases": [
                        p.get("phase_name", "")
                        for p in obj.get("kill_chain_phases", [])
                    ],
                    "platforms": obj.get("x_mitre_platforms", []),
                }
            )

        _technique_cache = techniques
        return techniques
    except Exception:  # noqa: BLE001
        return []


@tool
def mitre_attack_lookup(query: str) -> str:
    """
    Look up MITRE ATT&CK techniques, tactics, threat groups (APTs), and malware families.
    Use for: understanding attack techniques (e.g. 'T1566 phishing'), threat actor TTPs,
    kill-chain phases, lateral movement techniques, persistence methods, ransomware tactics,
    and mapping observed behaviors to ATT&CK framework IDs.
    Input: a technique ID (T1566), tactic name (phishing, persistence), APT group name,
    or malware name (Cobalt Strike, Emotet).
    """
    try:
        techniques = _load_attack_data()
        if not techniques:
            return "MITRE ATT&CK data unavailable. Check network connectivity."

        q = query.strip().lower()
        matches = []

        for t in techniques:
            score = 0
            if q == t["id"].lower():
                score = 100  # Exact ID match
            elif q in t["name"].lower():
                score = 80
            elif any(q in p.lower() for p in t["phases"]):
                score = 60
            elif q in t["description"].lower():
                score = 40

            if score > 0:
                matches.append((score, t))

        matches.sort(key=lambda x: x[0], reverse=True)
        top = matches[:6]

        if not top:
            return f"No MITRE ATT&CK entries found matching: '{query}'"

        lines = [f"MITRE ATT&CK Results for '{query}' ({len(top)} matches)\n"]

        for _, t in top:
            obj_type = t["type"].replace("-", " ").title()
            phases_str = ", ".join(t["phases"]) or "N/A"
            platforms_str = ", ".join(t["platforms"][:4]) or "N/A"

            lines.append(
                f"• [{t['id']}] {t['name']}  ({obj_type})\n"
                f"  Tactic(s): {phases_str}\n"
                f"  Platforms: {platforms_str}\n"
                f"  {t['description'][:300]}\n"
            )

        return "\n".join(lines)

    except Exception as exc:  # noqa: BLE001
        return f"MITRE ATT&CK lookup error: {exc}"
