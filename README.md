# Sketch2Solve — Reasoning Coach

Solve LeetCode problems by speaking, drawing on a whiteboard, and writing pseudocode. The app captures these **multimodal** signals, infers your intended algorithmic approach, and returns **Socratic** hints (questions first, not full solutions).

---

## Overview

Sketch2Solve is an **AI-powered coding coach** that combines **speech-to-text (STT)**, **vision**, and **large language models (LLMs)** to give you real-time, pedagogy-aware feedback while you reason through algorithm problems. The system is built on **foundation models** that have been trained on massive amounts of online text, code, and multimodal data; we layer **curated algorithmic knowledge** (LeetCode problem metadata, topic tags, and solution patterns from public problem sets) and **prompt engineering** so the coach understands both *what* you’re drawing/saying and *how* it fits the canonical approach for each problem.

We don’t train our own model weights — instead we **orchestrate** pre-trained models (OpenAI’s GPT-4o, Whisper) over **structured context**: problem descriptions and topic tags fetched from LeetCode’s GraphQL API, a local **problem cache**, and hand-crafted **system prompts** that encode Socratic tutoring and pattern recognition. The result is a coach that feels “trained” on algorithm curricula and online coding knowledge, while remaining fast to iterate and deploy.

---

## Technical Stack

### Frontend

| Technology | Role |
|------------|------|
| **Next.js 14** | React framework, App Router, server components |
| **TypeScript** | Static typing |
| **Tailwind CSS** | Styling |
| **tldraw** | Collaborative whiteboard / canvas (freehand sketches, shapes, arrows) |
| **Monaco Editor** | Pseudocode editing (syntax highlighting, keybindings) |
| **MediaRecorder API** | Browser audio capture for voice input |
| **WebSocket** | Real-time live transcript and checkpoint sync with backend |

### Backend

| Technology | Role |
|------------|------|
| **FastAPI** | REST + WebSocket API server |
| **SQLite + SQLAlchemy** | Persistence for sessions, checkpoints, analyses |
| **OpenAI API** | **Whisper** (STT), **GPT-4o** (vision + text), optional **GPT-4o Audio** |
| **ElevenLabs** (optional) | Text-to-speech (TTS) for spoken hints |
| **httpx** | Async HTTP for LeetCode GraphQL / Alfa API |
| **Uvicorn** | ASGI server |

### AI / ML Pipeline

- **STT (Speech-to-Text):** Whisper transcribes user speech; transcript is streamed and stored per session.
- **Vision:** Whiteboard canvas is exported as PNG → **GPT-4o Vision** produces a **visual description** (nodes, edges, arrays, pointers, labels) and optional **generated pseudocode** from the drawing.
- **Coach:** Multimodal context (problem + topic tags, pseudocode, labels, transcript, whiteboard image) is sent to **GPT-4o** with a **system prompt** that defines Socratic behavior, pattern inference, and JSON output (inferred approach, missing pieces, questions, micro-hint).
- **Verifier:** A separate GPT-4o call evaluates whether the user’s approach (drawing + pseudocode + voice) is correct and efficient, returning pass/fail and actionable feedback.
- **Prompt engineering:** All model behavior is driven by **system prompts** and **few-shot style** context (problem metadata, examples); no fine-tuning of model weights.

### Data & Integrations

- **LeetCode:** Problem metadata (title, description, difficulty, topic tags, examples) via **LeetCode GraphQL** and/or **Alfa LeetCode API**; fallback slug map for common problem IDs.
- **Problem cache:** Local JSON cache (`backend/data/problems_cache.json`) of fetched problems to avoid repeated network calls.
- **Sessions & checkpoints:** Each session stores full transcript, problem JSON, and time-ordered checkpoints (whiteboard snapshot, pseudocode, labels) for replay and mental-model card generation.

---

## How It Works (User Flow)

1. Enter a **LeetCode problem number** (e.g. `200`) or paste problem text; the app fetches or uses cached problem data.
2. **Draw** on the whiteboard, **write pseudocode** in Monaco, and **speak** your reasoning; audio is transcribed via Whisper and shown as a live transcript.
3. Every **10 seconds** a **checkpoint** captures whiteboard state (JSON), pseudocode, labels, and audio.
4. When you click **Reflect** / **Hint**, say *“I’m stuck”*, pause for 3s, or add a new pseudocode block:
   - Whiteboard is exported as **PNG** → GPT-4o Vision returns a structural description.
   - Full context (problem, pseudocode, labels, visual description, transcript) and optional raw audio → **GPT-4o** (and optionally GPT-4o Audio).
   - Response: **inferred pattern**, **missing pieces**, **Socratic questions**, **micro-hint** (and optional TTS).
5. End the session to generate a **Mental Model Card** summarizing your approach over time.

---

## Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **OpenAI API key** (for Whisper STT, GPT-4o Vision, GPT-4o text/audio)

### Backend

```bash
cd backend
cp .env.example .env   # fill in OPENAI_API_KEY
pip install -r requirements.txt
```

From the **project root** (`code/`):

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for Whisper, GPT-4o Vision, GPT-4o |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for spoken hints (TTS) |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice ID (default: Rachel) |

---

## Project Structure (High Level)

```
code/
├── backend/           # FastAPI app
│   ├── core/          # WebSocket manager
│   ├── data/          # LC slug map, problems cache
│   ├── models/        # SQLAlchemy DB models
│   ├── prompts/       # Coach & verifier system prompts
│   ├── routers/       # sessions, checkpoints, coach, visualize, verify
│   └── services/      # coach, vision, verifier, STT, TTS, problems, storage
├── frontend/          # Next.js app
│   └── src/
│       ├── app/       # App Router pages
│       ├── components/# Whiteboard, CoachPanel, PseudocodeEditor, etc.
│       └── lib/       # API client, WebSocket, checkpoint engine, trigger detection
└── README.md
```

---

*Formerly known as LeetCoach.*
