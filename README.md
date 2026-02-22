# Sketch2Solve — Reasoning Coach

Solve LeetCode problems by speaking, drawing on a whiteboard, and writing pseudocode. The app captures these signals, infers your intended algorithmic approach, and returns Socratic hints (questions first, not full solutions).

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key (for Whisper STT + GPT-4o Vision + GPT-4o Audio)

### Backend

```bash
cd backend
cp .env.example .env        # fill in your OPENAI_API_KEY
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

## Architecture

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, tldraw (whiteboard), Monaco Editor (pseudocode), MediaRecorder API (audio).

**Backend:** FastAPI, SQLite + SQLAlchemy, OpenAI (Whisper, GPT-4o, GPT-4o Audio Preview), ElevenLabs TTS (optional).

> Formerly known as LeetCoach.

### How It Works

1. Enter a LeetCode number (e.g., `200`) or paste problem text
2. Draw on the whiteboard, write pseudocode, and speak your reasoning
3. Every 10 seconds a checkpoint captures whiteboard JSON, pseudocode, labels, and audio
4. Audio is transcribed via Whisper and displayed live
5. When you click **Reflect** / **Hint**, say "I'm stuck", pause for 3s, or add a new pseudocode block:
   - Whiteboard is exported as PNG → GPT-4o Vision generates a structural description
   - All context (problem, pseudocode, labels, visual description, transcript) + raw audio → GPT-4o Audio Preview
   - Returns: inferred pattern, missing pieces, Socratic questions, micro-hint
6. End the session to generate a Mental Model Card summarizing your approach evolution

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key for Whisper, GPT-4o, GPT-4o Audio |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for spoken hints |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice ID (default: Rachel) |
