# CyberGuard AI — Talking Avatar Cybersecurity Concierge

A real-time AI agent with a **talking avatar** that speaks, listens, and fetches live intelligence on cyber risks, AI security trends, and threat intelligence.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                        │
│  ┌───────────────┐  ┌───────────┐  ┌─────────────────┐  │
│  │  VIDEO FEED   │  │  AUDIO    │  │   SECURE COMMS  │  │
│  │  (Avatar via  │  │  (WebAudio│  │   (Chat + Text  │  │
│  │  Daily.co     │  │   Canvas) │  │    Input)       │  │
│  │  WebRTC)      │  │           │  │                 │  │
│  └───────────────┘  └───────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
              │ WebRTC (Daily.co room)
              ▼
┌──────────────────────────────┐
│      TAVUS CVI PLATFORM      │
│  Realistic talking avatar    │
│  STT (Deepgram) + TTS voice  │
│  Real-time lip-sync video    │
└──────────────────────────────┘
              │ Webhook (each user turn)
              ▼
┌──────────────────────────────┐
│     FASTAPI BACKEND          │
│  LangChain GPT-4o Agent      │
│  ┌─────────┐ ┌───────────┐   │
│  │CISA KEV │ │NVD/CVE    │   │
│  │ Feed    │ │Search     │   │
│  └─────────┘ └───────────┘   │
│  ┌─────────┐ ┌───────────┐   │
│  │Tavily   │ │MITRE      │   │
│  │Web Srch │ │ATT&CK     │   │
│  └─────────┘ └───────────┘   │
└──────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Avatar & voice | **Tavus CVI** (Conversational Video Interface) |
| WebRTC | **Daily.co** (embedded in Tavus) |
| Frontend | **Next.js 14** + TypeScript + Tailwind CSS |
| Backend | **FastAPI** + Python 3.11+ |
| AI Agent | **LangChain** + **GPT-4o** |
| Cyber Intel | CISA KEV, NVD API v2, Tavily Search, MITRE ATT&CK |
| Voice STT | Deepgram (via Tavus) |
| Voice TTS | ElevenLabs (via Tavus) |

## Prerequisites

- Python 3.11+
- Node.js 18+
- **Tavus API key** — [tavus.io](https://tavus.io) (free tier available)
- **OpenAI API key** — [platform.openai.com](https://platform.openai.com)
- **Tavily API key** — [tavily.com](https://tavily.com) (free tier: 1000 req/month)
- **ngrok** for local development (exposes backend webhook to Tavus)

## Quick Start

### 1. Clone & configure

```bash
cd "d:\Cyber Security AI"
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your API keys
```

### 3. Expose backend via ngrok (for Tavus webhook)

```bash
# In a separate terminal
ngrok http 8000

# Copy the HTTPS URL (e.g. https://abc123.ngrok-free.app)
# Paste it into backend/.env as WEBHOOK_BASE_URL
```

### 4. Start backend

```bash
# From backend/ with venv active
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Start dev server
npm run dev
```

### 6. Open the app

Navigate to [http://localhost:3000](http://localhost:3000) and click **▶ START SESSION**.

---

## Environment Variables

### `backend/.env`

| Variable | Description |
|----------|-------------|
| `TAVUS_API_KEY` | Your Tavus API key |
| `TAVUS_REPLICA_ID` | Avatar replica ID (use `r79e1c033f` for Tavus stock) |
| `WEBHOOK_BASE_URL` | Public URL of your backend (ngrok URL in dev) |
| `OPENAI_API_KEY` | OpenAI API key |
| `TAVILY_API_KEY` | Tavily search API key |

### `frontend/.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend URL (default: `http://localhost:8000`) |

---

## Getting a Tavus Replica ID

1. Sign up at [tavus.io](https://tavus.io)
2. Go to **Replicas** → use a stock replica (e.g. `r79e1c033f`) or record your own
3. Copy the Replica ID into `TAVUS_REPLICA_ID`

---

## What CyberGuard Can Tell You

Ask CyberGuard anything like:

- *"What are the most critical vulnerabilities CISA flagged this month?"*
- *"Explain the latest AI prompt injection attacks and how to defend against them."*
- *"What ransomware groups are most active right now?"*
- *"Walk me through the MITRE ATT&CK techniques used in a typical phishing campaign."*
- *"What are the top cyber risks for financial institutions in 2025?"*
- *"How does Zero Trust Architecture reduce attack surface?"*
- *"What AI security risks should I consider when deploying LLMs internally?"*

---

## Project Structure

```
Cyber Security AI/
├── backend/
│   ├── main.py              # FastAPI app + Tavus webhook handler
│   ├── agent.py             # LangChain GPT-4o agent
│   ├── tools/
│   │   ├── cisa_kev.py      # CISA Known Exploited Vulnerabilities feed
│   │   ├── nvd_search.py    # NVD CVE database search
│   │   ├── web_search.py    # Tavily web search (news & trends)
│   │   └── mitre_attack.py  # MITRE ATT&CK framework lookup
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/             # Next.js app router
    │   ├── components/
    │   │   ├── ConciergeUI.tsx    # Main layout orchestrator
    │   │   ├── VideoPanel.tsx     # Avatar video feed
    │   │   ├── AudioVisualizer.tsx # Real-time audio bars
    │   │   └── ChatPanel.tsx      # Conversation transcript + input
    │   ├── hooks/
    │   │   └── useTavusRoom.ts    # Daily.co WebRTC integration
    │   └── lib/
    │       ├── api.ts             # Backend API calls
    │       └── types.ts           # TypeScript interfaces
    ├── package.json
    └── .env.local.example
```

---

## Production Deployment

- Deploy backend to **Railway**, **Render**, or **AWS Lambda** (ensure public HTTPS URL)
- Deploy frontend to **Vercel** (`NEXT_PUBLIC_BACKEND_URL` → production backend URL)
- Remove ngrok requirement by using the production backend URL as `WEBHOOK_BASE_URL`

---

## Security Notes

- All API keys are stored in `.env` files (never committed to version control)
- Webhook endpoint validates Tavus event types before processing
- No user data is stored or logged beyond the active session
- `.gitignore` should include `.env`, `.env.local`
