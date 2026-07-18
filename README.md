# Properly

**Properly** is an AI-powered phonics tutor for children aged 4–7. It listens as they read aloud, analyses pronunciation at the phoneme level, and coaches them in real time through **Mrs Owl** — a warm virtual tutor.

Private phonics coaching often costs **£40–£80 per hour**. Properly is built to make personalised, DfE **Letters and Sounds**-aligned practice available to every family, including a mock demo path that can run with no OpenAI API spend when no API key is configured.

---

## What it does

| Feature | Detail |
|---------|--------|
| Listening & assessment | Mic capture over WebSockets; local heuristic scoring in mock mode, Whisper transcription when live AI is configured |
| Mrs Owl coaching | Short, encouraging feedback (configurable OpenAI chat model + OpenAI TTS `tts-1`) |
| Personalised stories | Themes (dragons, space, animals…) constrained to the child’s phonics phase |
| Phonics UI | Colour grapheme tiles, IPA strips, interactive phase guides |
| Rewards | Acorns, streaks, trophies |
| Storybooks | A4 PDF with text, low-cost generated illustration, grapheme tiles, IPA strip |
| Anti-cheat | Jaccard similarity on words + phonemes before a session can complete |
| Progress | Tracking aligned with Letters and Sounds phases 2–5 |

---

## How it works

```
React 18 (Vite) ──REST──► Node / Express API ──► SQLite (WAL)
       │                         │
       └──── WebSocket audio ────┤
                                 ├── shared/phonicsEngine.js
                                 └── OpenAI (optional): GPT-5.6 chat · Whisper · tts-1 · GPT Image
```

[`shared/phonicsEngine.js`](shared/phonicsEngine.js) is the single source of truth for:

- all **44 IPA phonemes**
- DfE Letters and Sounds **phases 1–5**
- grapheme → phoneme maps, vocabulary allowlists, highlighting, Jaccard helpers

Both the API and the React client import this module so assessment and UI never drift apart.

### Repository layout

```
ProperlyOpenAI/
  client/          React 18 + Vite SPA
  server/          Express API, WebSocket hub, SQLite, OpenAI services
  shared/          phonicsEngine.js
  Dockerfile       Single-image production build
  render.yaml      Render free-tier blueprint
  .env.example     Environment template
```

---

## Prerequisites

- **Node.js 20+** (22 recommended)
- **npm 10+**
- Optional: **Docker** (for cloud / container deploys)
- Optional: **OpenAI API key** (only if you want live AI; not required for mock demos)

---

## Local deployment

### 1. Install

```bash
git clone <your-repo-url> ProperlyOpenAI
cd ProperlyOpenAI
npm run install:all
```

### 2. Configure environment

```bash
# Windows (PowerShell)
Copy-Item .env.example server\.env

# macOS / Linux
cp .env.example server/.env
```

**No OpenAI API spend (default / recommended for first run):**

```env
OPENAI_API_KEY=
MOCK_MODE=true
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
SERVE_CLIENT=true
JACCARD_THRESHOLD=0.55
TTS_VOICE=nova
ILLUSTRATIONS_ENABLED=false
```

Leave `OPENAI_API_KEY` empty for a fully local/mock demo. If you keep an API key in `server/.env`, set `MOCK_MODE=true` and `ILLUSTRATIONS_ENABLED=false` to avoid story/chat/TTS/image API calls. The app still generates phase-safe stories, local coach lines, SVG illustrations, PDFs, and assessment stubs.

If `OPENAI_API_KEY` is present, story illustrations use OpenAI image generation so each new story gets a picture that matches the selected topic and story scene. Defaults are tuned for small, kid-friendly artwork:

```env
ILLUSTRATIONS_ENABLED=true
ILLUSTRATION_MODEL=gpt-image-1-mini
ILLUSTRATION_QUALITY=low
ILLUSTRATION_FORMAT=webp
ILLUSTRATION_COMPRESSION=70
ILLUSTRATION_CACHE_SCOPE=scene
```

OpenAI image generation is metered API usage, not a free API feature. The app keeps usage light by using the mini image model, low quality, compressed WebP output, and cache reuse. The server always caches exact story scenes and, by default, reuses generated images only when the phonics phase, selected theme, and visible story subjects match. This avoids paying for repeated dog-and-mud scenes while preventing one broad “animals” or “space” image from being reused for unrelated stories.

**Live AI / hackathon judging mode (uses metered OpenAI API calls):**

```env
OPENAI_API_KEY=sk-...
MOCK_MODE=false
OPENAI_CHAT_MODEL=gpt-5.6
```

For OpenAI Build Week judging, set `OPENAI_CHAT_MODEL=gpt-5.6` so story generation, Mrs Owl coaching, and transcript refinement use the required chat model. The app keeps a mock/demo mode so judges can still exercise the full product flow when no API key is available.

### 3. Seed sample data (optional)

```bash
npm run seed
```

Creates a sample child (**Amelia**, Phase 2) and a starter story for offline demos.

### 4. Run in development (two processes)

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| API health | http://localhost:3001/api/health |
| WebSocket | `ws://localhost:3001/ws/audio` (proxied via Vite) |

### 5. Run in production mode on your machine

Build the SPA and serve it from the API (one port):

```bash
npm run start:prod
```

Then open http://localhost:3001

### 6. Local Docker (optional)

```bash
docker build -t properly .
docker run --rm -p 3001:3001 ^
  -e MOCK_MODE=true ^
  -e CLIENT_ORIGIN=* ^
  -e SERVE_CLIENT=true ^
  properly
```

On macOS/Linux use `\` instead of `^` for line continuations.

Open http://localhost:3001

---

## Low-cost cloud deployment

Goal: a **public demo URL** that can run as a no-API-spend mock demo, and can be switched to live OpenAI API mode for the hackathon video or judge testing if you provide a key.

Use **mock mode** (`MOCK_MODE=true`, no API key, or `ILLUSTRATIONS_ENABLED=false` when a key is present) for no OpenAI API spend. You still get the full UX for demos, teaching, and portfolio screenshots.

### Why one service?

Properly needs:

- a long-lived **Node** process
- **WebSockets** for audio
- a writable disk for **SQLite** + PDFs/images

That rules out pure serverless hosts (Vercel/Netlify functions) for the API. The simplest path is: **one Docker web service** that serves both the API and the built React app.

### Option A — Render (simple single-service path)

1. Push this repo to GitHub / GitLab.
2. In [Render](https://render.com), create a new **Blueprint** from the repo (uses [`render.yaml`](render.yaml)), **or** create a **Web Service**:
   - **Runtime:** Docker
   - **Dockerfile path:** `./Dockerfile`
   - **Plan:** Free
   - **Health check path:** `/api/health`
3. Set environment variables:

| Key | Value |
|-----|--------|
| `MOCK_MODE` | `true` |
| `SERVE_CLIENT` | `true` |
| `CLIENT_ORIGIN` | `*` |
| `JACCARD_THRESHOLD` | `0.55` |
| `ILLUSTRATIONS_ENABLED` | `false` for no OpenAI image spend; `true` for live generated story art when an API key is configured |

4. Deploy. Open `https://<your-service>.onrender.com`.

The included `render.yaml` defaults `ILLUSTRATIONS_ENABLED=false` so adding a Render service does not accidentally trigger image API usage. Turn it on only for the live judged demo or recorded walkthrough.

**Free-tier notes**

- The service **spins down** after idle time; the first request after sleep can take ~30–60s.
- The free filesystem is **ephemeral** — SQLite data, PDFs, and images reset on redeploy/restart. Fine for demos; not for production pupil records.
- Do **not** set `OPENAI_API_KEY`, or set `ILLUSTRATIONS_ENABLED=false`, if you want to avoid OpenAI API spend.

### Option B — Fly.io free allowance

```bash
# Install flyctl, then:
fly launch --no-deploy   # accept Docker, set app name
fly secrets set MOCK_MODE=true CLIENT_ORIGIN=* SERVE_CLIENT=true
fly deploy
```

Attach a small volume later if you want SQLite to survive restarts:

```bash
fly volumes create properly_data --size 1
```

Then point `DB_PATH` / `STORAGE_DIR` at the mounted path (see Fly volume docs).

### Option C — Railway trial credits

1. New project → Deploy from GitHub → Dockerfile.
2. Variables: `MOCK_MODE=true`, `SERVE_CLIENT=true`, `CLIENT_ORIGIN=*`.
3. Expose the web service port (Railway injects `PORT` automatically).

Railway’s “free” tier is usually **trial credits**, not forever-free — use Render/Fly if you need ongoing $0 hosting.

### Option D — Split free static + free API (advanced)

| Piece | Host | Notes |
|-------|------|--------|
| Frontend | Cloudflare Pages / Netlify / Vercel | Build command: `npm install --prefix client && npm run build --prefix client`; output `client/dist` |
| Backend | Render / Fly Docker | Same API image; `SERVE_CLIENT=false` |

You must then:

1. Set `CLIENT_ORIGIN` to your exact frontend origin (e.g. `https://properly.pages.dev`).
2. Point the SPA at the API (today the client uses **same-origin** `/api` and `/ws` — for a split host you would add a Vite `VITE_API_URL` / proxy config). Prefer **Option A** unless you need a separate CDN.

### Controlling cloud and API cost

| Lever | How |
|-------|-----|
| No OpenAI API spend | Leave `OPENAI_API_KEY` empty. If a key is present, use `MOCK_MODE=true` and `ILLUSTRATIONS_ENABLED=false`. |
| Lower hosting spend | Render free web service or Fly free allowance, subject to each provider's current limits |
| No extra DB bill | SQLite on local disk (accept ephemeral data on free tiers) |
| Optional live AI later | Set `OPENAI_API_KEY` + `MOCK_MODE=false` — then OpenAI API usage is billed to your OpenAI account |
| Low-cost story art | Keep `ILLUSTRATION_MODEL=gpt-image-1-mini`, `ILLUSTRATION_QUALITY=low`, `ILLUSTRATION_FORMAT=webp`, and `ILLUSTRATION_CACHE_SCOPE=scene` |

---

## Demo walkthrough

1. Open the app and create a child (name, phase, interests).
2. Tap **Read a new story**.
3. On the reading screen:
   - use the mic, **or**
   - paste the story into the practice transcript box (reliable for demos / noisy rooms).
4. Tap **Finish & collect acorns** (Jaccard must pass, or use **Complete anyway** for demos).
5. Download the PDF; check **Progress** and **Rewards**.

## OpenAI Build Week notes

Properly targets the **Education** track for OpenAI Build Week. The Devpost page asks for a working project built with Codex using GPT-5.6, a category, a project description, a public demo video under 3 minutes, a code repository URL, setup instructions, and the `/feedback` Codex Session ID used for the main build work.

The live AI path uses OpenAI for:

- GPT-5.6 story generation constrained to DfE Letters and Sounds phases
- GPT-5.6 Mrs Owl coaching and transcript refinement
- Whisper transcription fallback for child reading audio
- OpenAI TTS for spoken tutor feedback
- `gpt-image-1-mini` low-quality compressed illustrations for generated storybooks

Submission checklist:

- Public demo URL for the deployed app
- Code repository URL for judging/testing
- Public YouTube/Vimeo demo video under 3 minutes, with audio explaining how Codex and GPT-5.6 were used
- Project description: problem, solution, OpenAI usage, technical architecture, and impact
- `/feedback` Codex Session ID from the main build session
- Any sample data or credentials needed for judge testing

Reference links:

- [OpenAI Build Week overview](https://openai.devpost.com/)
- [OpenAI Build Week rules](https://openai.devpost.com/rules)
- [OpenAI Build Week resources](https://openai.devpost.com/resources)
- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

---

## API reference (scaffold)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health + mock flag |
| `POST` | `/api/children` | Create profile |
| `GET` | `/api/children/:id/progress` | Progress + sessions |
| `POST` | `/api/stories/generate` | Story + illustration + PDF |
| `GET` | `/api/stories/:id/pdf` | Download A4 PDF |
| `POST` | `/api/sessions/start` | Begin reading session |
| `POST` | `/api/sessions/:id/complete` | Jaccard gate + rewards |
| `POST` | `/api/coach` | Mrs Owl message (+ TTS when live) |
| `GET` | `/api/phonics/phases/:n` | Phase guide tiles |
| `WS` | `/ws/audio` | Audio stream + assessment events |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | _(empty)_ | Enables metered OpenAI API calls for live chat, Whisper, TTS, and GPT Image |
| `MOCK_MODE` | `false`* | Force local/mock story and coach responses; auto-on when key is missing |
| `PORT` | `3001` | HTTP + WebSocket port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allow-list (`*` or comma-separated) |
| `SERVE_CLIENT` | `true` | Serve `client/dist` from the API |
| `JACCARD_THRESHOLD` | `0.55` | Configured similarity gate; the current scorer enforces a minimum internal pass threshold of 0.72 |
| `TTS_VOICE` | `nova` | OpenAI TTS voice |
| `ILLUSTRATIONS_ENABLED` | `true` | Generate story art with OpenAI image models when a key is configured; otherwise use SVG placeholders |
| `ILLUSTRATION_MODEL` | `gpt-image-1-mini` | Cost-efficient image model for story illustrations |
| `ILLUSTRATION_QUALITY` | `low` | Low/medium/high quality for GPT Image models |
| `ILLUSTRATION_FORMAT` | `webp` | Output format for GPT Image models (`webp`, `jpeg`, or `png`) |
| `ILLUSTRATION_COMPRESSION` | `70` | Compression level for WebP/JPEG story images |
| `ILLUSTRATION_CACHE_SCOPE` | `scene` | `scene` reuses images when phase, theme, and visible story subjects match; `topic` is broader and cheaper but less precise; `story` / `exact` only reuses exact story-scene matches |
| `DB_PATH` | `data/properly.db` | SQLite file (relative to `server/`) |
| `STORAGE_DIR` | `storage` | PDFs, images, audio |

\*Effective mock is `MOCK_MODE=true` **or** missing API key.

---

## Design challenges (and how the scaffold handles them)

| Challenge | Approach |
|-----------|----------|
| Real-time audio on home Wi‑Fi | Level meter, silence hints, WS heartbeats, degrade to Whisper-at-end |
| False “completed” readings | Jaccard on word + phoneme sets; retry when below threshold |
| LLM inventing hard words | Low temperature, few-shot Phase examples, vocabulary post-filter |

---

## Phoneme sound bank

All **44 IPA phonemes** use **real British English isolation recordings** (not synthetic Web Audio tones), cached in the browser via `usePhonemePlayer` / `phonemeCache`.

- Files: `client/public/phonemes/*.mp3`
- Re-download: `npm run phonemes:download`
- Attribution: `client/public/phonemes/ATTRIBUTION.txt`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run install:all` | Install root + server + client deps |
| `npm run phonemes:download` | Download real 44 IPA phoneme MP3s |
| `npm run dev` | Dev API + Vite client |
| `npm run build` | Production SPA build |
| `npm run start` | Start API (serves SPA if `client/dist` exists) |
| `npm run start:prod` | Build SPA then start API |
| `npm run seed` | Seed sample child + story |

---

## Licence

Private / educational prototype.
