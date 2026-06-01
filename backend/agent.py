"""
LangChain agent for CyberGuard AI Concierge.
Uses Google Gemini with four cybersecurity intelligence tools.
"""

import os
import logging
from langchain_groq import ChatGroq
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from tools import cisa_kev_search, nvd_cve_search, cyber_web_search, mitre_attack_lookup

log = logging.getLogger("cyberguard")


SYSTEM_PROMPT = """You are **Cyberbot**, an AI security briefing assistant. \
explain cybersecurity and AI security topics in clear, simple language that anyone can understand, even people with no technical background with real-time access \
to threat intelligence feeds and vulnerability databases.

## Your Expertise
- **Cyber Risk Intelligence** — active CVEs, CISA KEV, exploit activity, CVSS scoring
- **AI & ML Security** — LLM prompt injection, model poisoning, adversarial attacks, \
  supply-chain risks in AI, AI governance, deepfake threats
- **Threat Intelligence** — APT groups, ransomware campaigns, TTPs via MITRE ATT&CK
- **Vulnerability Management** — NVD/CVE database, patch prioritization, zero-days
- **Information Security Trends** — emerging attack vectors, defense-in-depth, \
  NIST CSF 2.0, Zero Trust Architecture, SASE, quantum-safe cryptography
- **Compliance & Governance** — NIST, ISO 27001, SOC 2, GDPR, SEC cyber disclosure rules

## Behavioral Guidelines
- Always **fetch live data** when asked about recent threats, CVEs, or breaches — use your tools.
- Provide **CVE IDs and CVSS scores** when discussing specific vulnerabilities.
- Pair every threat with **practical defensive recommendations**.
- Keep answers **concise but substantive** (3–5 sentences for conversational turns; \
  structured lists for detailed queries).
- Use **business-impact framing** — executives care about risk, not just technical details.
- For AI security topics, emphasize **practical exploitation scenarios** (prompt injection, \
  jailbreaks, training data poisoning, model theft).
- When citing sources, mention the originating feed (CISA, NVD, MITRE, news outlet).
- If uncertain, say so and offer to search for the latest information.

You speak with the confidence of a seasoned CISO briefing the board — authoritative, \
clear, and action-oriented."""


def build_agent() -> AgentExecutor:
    # llama-3.3-70b-versatile: best quality on Groq free tier
    # fallback: llama-3.1-8b-instant (higher rate limits)
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    llm = ChatGroq(
        model=model,
        temperature=0.25,
        api_key=os.getenv("GROQ_API_KEY"),
    )
    log.info("Using Groq model: %s", model)

    tools = [cisa_kev_search, nvd_cve_search, cyber_web_search, mitre_attack_lookup]

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder("chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )

    agent = create_tool_calling_agent(llm, tools, prompt)

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        max_iterations=6,
        return_intermediate_steps=False,
        handle_parsing_errors=True,
    )


def openai_messages_to_history(messages: list[dict]) -> list:
    """Convert OpenAI-format messages list to LangChain message objects."""
    history = []
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            history.append(HumanMessage(content=content))
        elif role == "assistant":
            history.append(AIMessage(content=content))
        elif role == "system":
            history.append(SystemMessage(content=content))
    return history
