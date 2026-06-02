"""
FastAPI backend for CyberGuard AI Concierge.

Endpoints:
  POST /api/start-conversation  — creates a Tavus CVI conversation, returns URL
  POST /webhook/tavus           — receives user turns from Tavus, runs LangChain agent
  GET  /health                  — liveness check
"""

import os
import uuid
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from agent import build_agent, openai_messages_to_history, FALLBACK_MODEL

# ── Bootstrap ──────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("cyberguard")

TAVUS_API_KEY: str = os.getenv("TAVUS_API_KEY", "")
TAVUS_REPLICA_ID: str = os.getenv("TAVUS_REPLICA_ID", "r79e1c033f")
TAVUS_PERSONA_ID: str = os.getenv("TAVUS_PERSONA_ID", "")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Resolve webhook base URL — prefer explicit env var, then Render's auto-injected URL,
# then fall back to empty string (webhook disabled).
_raw_webhook = os.getenv("WEBHOOK_BASE_URL", "").rstrip("/")
_placeholder = "your-ngrok-subdomain"
if not _raw_webhook or _placeholder in _raw_webhook:
    # Render injects RENDER_EXTERNAL_URL automatically for every web service
    _render_url = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
    _raw_webhook = _render_url
WEBHOOK_BASE_URL: str = _raw_webhook

TAVUS_API_BASE = "https://tavusapi.com"
TAVUS_HEADERS = {
    "x-api-key": TAVUS_API_KEY,
    "Content-Type": "application/json",
}

CUSTOM_GREETING = (
    "Hello! I'm CyberGuard, your AI Cybersecurity Concierge. "
    "I have real-time access to CISA vulnerability feeds, CVE databases, "
    "MITRE ATT&CK intelligence, and the latest threat news. "
    "Ask me about active exploits, AI security risks, ransomware trends, "
    "or anything in the world of cybersecurity. How can I help you today?"
)

CONVERSATIONAL_CONTEXT = (
    "You are CyberGuard, an elite Cybersecurity AI Concierge specialising in "
    "cyber risk intelligence, AI security trends, vulnerability management, "
    "MITRE ATT&CK threat intelligence, and information security best practices. "
    "Always be concise, authoritative, and action-oriented. "
    "Pair every threat with a defensive recommendation."
)


# ── Agent (lazy singletons – works in server and serverless alike) ────────
_agent_executor = None
_fallback_agent_executor = None


def _get_agent():
    """Return the primary agent executor, building it on first call."""
    global _agent_executor  # noqa: PLW0603
    if _agent_executor is None:
        log.info("Building LangChain agent…")
        _agent_executor = build_agent()
        log.info("Agent ready.")
    return _agent_executor


def _get_fallback_agent():
    """Return the fallback agent (higher-rate-limit model), building it on first call."""
    global _fallback_agent_executor  # noqa: PLW0603
    if _fallback_agent_executor is None:
        log.info("Building fallback LangChain agent (%s)…", FALLBACK_MODEL)
        _fallback_agent_executor = build_agent(model=FALLBACK_MODEL)
        log.info("Fallback agent ready.")
    return _fallback_agent_executor


def _is_rate_limit_error(exc: Exception) -> bool:
    err_str = str(exc)
    return (
        "429" in err_str
        or "rate_limit" in err_str.lower()
        or "RESOURCE_EXHAUSTED" in err_str
        or "quota" in err_str.lower()
        or "rate limit" in err_str.lower()
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Webhook base URL: %s", WEBHOOK_BASE_URL or "(not configured — Tavus built-in LLM)")
    _get_agent()  # Pre-warm in traditional server mode
    yield


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="CyberGuard AI Concierge", version="1.0.0", lifespan=lifespan)

# Include Vercel deployment URL automatically if present
_vercel_url = os.getenv("VERCEL_URL", "")
_allowed_origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "https://shubhangilokhande123.github.io",
]
if _vercel_url:
    _allowed_origins.append(f"https://{_vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ────────────────────────────────────────────────────────────────
class StartConversationRequest(BaseModel):
    user_name: str = "Visitor"


class SendMessageRequest(BaseModel):
    conversation_id: str = ""
    text: str


# ── Routes ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "CyberGuard AI Concierge"}


@app.post("/api/start-conversation")
async def start_conversation(body: StartConversationRequest):
    if not TAVUS_API_KEY:
        raise HTTPException(status_code=500, detail="TAVUS_API_KEY is not configured.")

    # Only use the webhook if WEBHOOK_BASE_URL resolved to a real URL
    use_webhook = bool(WEBHOOK_BASE_URL)

    payload = {
        "replica_id": TAVUS_REPLICA_ID,
        **(({"persona_id": TAVUS_PERSONA_ID}) if TAVUS_PERSONA_ID else {}),
        "conversation_name": f"CyberGuard Session — {body.user_name}",
        "conversational_context": CONVERSATIONAL_CONTEXT,
        "custom_greeting": CUSTOM_GREETING,
        **({"callback_url": f"{WEBHOOK_BASE_URL}/webhook/tavus"} if use_webhook else {}),
        "properties": {
            "max_call_duration": 3600,
            "enable_recording": False,
            "enable_transcription": True,
            "language": "english",
            "apply_greenscreen": False,
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        log.info("Creating conversation — webhook %s", "ON" if use_webhook else "OFF (Tavus built-in LLM)")
        resp = await client.post(
            f"{TAVUS_API_BASE}/v2/conversations",
            headers=TAVUS_HEADERS,
            json=payload,
        )

    if resp.status_code not in (200, 201):
        log.error("Tavus API error %s: %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=502,
            detail=f"Tavus API returned {resp.status_code}: {resp.text}",
        )

    data = resp.json()
    log.info("Conversation created: %s", data.get("conversation_id"))
    return {
        "conversation_id": data.get("conversation_id"),
        "conversation_url": data.get("conversation_url"),
        "status": data.get("status", "active"),
    }


@app.post("/api/send-message")
async def send_message(body: SendMessageRequest):
    """Direct text message endpoint — runs LangChain agent and returns the reply."""
    text = body.text.strip()
    if not text:
        return {"response": "Please provide a message.", "conversation_id": body.conversation_id}

    log.info("Text message: %s…", text[:80])
    import asyncio

    # ── Attempt 1 & 2: primary model with brief back-off ──────────────────
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            result = _get_agent().invoke({"input": text, "chat_history": []})
            reply: str = result.get("output", "I could not generate a response. Please try again.")
            log.info("Text reply (%d chars): %s…", len(reply), reply[:80])
            return {"response": reply, "conversation_id": body.conversation_id}
        except Exception as exc:
            last_exc = exc
            if _is_rate_limit_error(exc):
                wait = 2 ** attempt  # 1s, 2s
                log.warning("Primary model rate-limited (attempt %d/2), waiting %ds…", attempt + 1, wait)
                await asyncio.sleep(wait)
            else:
                break  # Non-retryable — skip straight to fallback

    # ── Attempt 3: fallback to higher-rate-limit model ─────────────────────
    try:
        log.warning("Switching to fallback model %s…", FALLBACK_MODEL)
        result = _get_fallback_agent().invoke({"input": text, "chat_history": []})
        reply = result.get("output", "I could not generate a response. Please try again.")
        log.info("Fallback reply (%d chars): %s…", len(reply), reply[:80])
        return {"response": reply, "conversation_id": body.conversation_id}
    except Exception as exc:
        last_exc = exc
        log.exception("Fallback agent also failed: %s", exc)

    return {
        "response": "I'm having trouble reaching my intelligence feeds right now. Please try again in a moment.",
        "conversation_id": body.conversation_id,
    }


@app.post("/webhook/tavus")
async def tavus_webhook(request: Request):
    """
    Tavus calls this endpoint with each user turn.
    Supports two common Tavus webhook formats:
      1. OpenAI-compatible  { messages: [{role, content}] }
      2. Simple             { message: "...", event_type: "..." }
    """
    try:
        body: dict = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    log.info("Webhook received: %s", str(body)[:200])

    # ── Format 1: OpenAI-compatible messages array ─────────────────────────
    if "messages" in body:
        messages: list[dict] = body["messages"]
        # Extract the last user message
        user_messages = [m for m in messages if m.get("role") == "user"]
        if not user_messages:
            return _openai_response("How can I help you with cybersecurity today?")
        user_input = user_messages[-1].get("content", "").strip()
        # Build history (all messages except the last user one)
        history_msgs = messages[:-1] if messages[-1].get("role") == "user" else messages
        history = openai_messages_to_history(history_msgs)

    # ── Format 2: Simple event payload ────────────────────────────────────
    elif "message" in body or "content" in body:
        event_type = body.get("event_type") or body.get("type") or ""
        # Ignore non-user-speech events
        if event_type and event_type not in (
            "conversation.user_turn",
            "user_message",
            "conversation.echo",
        ):
            return JSONResponse({"response": "", "message": ""})

        user_input = (body.get("message") or body.get("content", "")).strip()
        history = []

    else:
        log.warning("Unrecognised webhook payload: %s", str(body)[:200])
        return JSONResponse({"response": "", "message": ""})

    if not user_input:
        return _openai_response("Please go ahead — I'm listening.")

    # ── Run agent with fallback on rate-limit ─────────────────────────────
    import asyncio
    reply: str = ""
    for agent_fn, label in [(_get_agent, "primary"), (_get_fallback_agent, FALLBACK_MODEL)]:
        try:
            result = agent_fn().invoke({"input": user_input, "chat_history": history})
            reply = result.get("output", "")
            break
        except Exception as exc:  # noqa: BLE001
            if _is_rate_limit_error(exc) and label == "primary":
                log.warning("Webhook: primary model rate-limited, switching to fallback…")
                await asyncio.sleep(1)
                continue
            log.exception("Agent error (%s): %s", label, exc)
            reply = (
                "I encountered an issue retrieving that information. "
                "Please rephrase your question or try again in a moment."
            )
            break
    if not reply:
        reply = "I could not generate a response. Please try again."

    log.info("Agent reply (%d chars): %s…", len(reply), reply[:80])

    # Return both formats so Tavus can use whichever it needs
    return _openai_response(reply)


def _openai_response(content: str) -> dict:
    """Return an OpenAI-compatible chat completion response (Tavus CVI format)."""
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        # Also include simple format for compatibility
        "response": content,
        "message": content,
    }


# ── Mangum handler for Vercel / AWS Lambda serverless ─────────────────────
try:
    from mangum import Mangum  # noqa: E402
    handler = Mangum(app, lifespan="off")
except ImportError:
    handler = None  # Not running in serverless environment
