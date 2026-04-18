# ATC Simulator

A browser-based air traffic control simulator for the Buenos Aires TMA, with an optional AI agent controller powered by a local LLM via Ollama.

---

## What it is

You play as an ATC controller managing aircraft in and around Buenos Aires. Aircraft spawn with assigned routes, and your job is to sequence approaches to SABE (Aeroparque), clear departures, and maintain separation between all aircraft in the airspace.

The sim runs at a fixed 10 Hz physics tick, scaled by 1×/2×/4× time compression. Conflict detection raises warnings at 5 nm / 1500 ft and critical alerts at 3 nm / 1000 ft.

**Three controller modes:**

- **Human** — you issue all commands via the command panel or free-text chat
- **AI** — a local LLM (via Ollama) issues all commands; you observe
- **Collaborative** — the LLM proposes commands, you approve or reject each one

---

## Stack

- React 18 + TypeScript + Vite
- Zustand for state management
- Leaflet / react-leaflet for the radar map
- Node.js + Express + Socket.IO for the AI backend
- Ollama for local LLM inference (structured JSON output)

---

## Project layout

```
air_traffic_game/
├── packages/
│   └── core/               # Shared simulation logic (@atc/core)
│       └── src/
│           ├── types.ts
│           ├── physics.ts
│           ├── approach.ts
│           ├── separation.ts
│           ├── scoring.ts
│           ├── commands.ts
│           ├── spawner.ts
│           ├── scenarios.ts
│           └── ...
├── apps/
│   └── server/             # Node.js backend + AI agent
│       └── src/
│           ├── server.ts       # Express + Socket.IO
│           ├── agent.ts        # LLM decision loop
│           ├── safetyEngine.ts # TCAS-like override layer
│           ├── validator.ts    # Command validation
│           └── ...
├── src/                    # React frontend
│   ├── components/
│   ├── hooks/
│   └── store/
├── MECHANICS.md            # Full simulation rules reference
├── AGENT.md                # AI agent architecture and LLM interface docs
└── CLAUDE.md               # Codebase guide for AI assistants
```

---

## Running the frontend only (Human mode)

No backend required.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The game loop runs entirely in the browser.

---

## Running with the AI agent

You need [Ollama](https://ollama.com) installed and a model pulled.

### 1. Pull a model

```bash
ollama pull qwen3:8b
```

Any instruction-tuned model with structured JSON output works. `qwen3:8b` is the default and recommended option.

### 2. Install backend dependencies

```bash
cd apps/server
npm install
cd ../..
```

### 3. Start the backend

```bash
cd apps/server
npm start
```

The server starts on `http://localhost:3001`. Default mode is `collaborative`.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP/WebSocket port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `qwen3:8b` | Model name |
| `OLLAMA_TEMPERATURE` | `0.2` | Sampling temperature |
| `OLLAMA_CTX` | `4096` | Context window tokens |
| `CONTROLLER_MODE` | `collaborative` | `human`, `ai`, or `collaborative` |

Example with a remote Ollama instance:

```bash
OLLAMA_HOST=http://192.168.1.50:11434 OLLAMA_MODEL=llama3.2 npm start
```

### 4. Start the frontend

In a separate terminal from the project root:

```bash
npm run dev
```

Switch the mode toggle in the bottom toolbar from **Human** to **AI** or **Collab**. The frontend connects to the backend via WebSocket and the AI agent panel appears in the sidebar.

---

## Controls

### Command panel

Select an aircraft from the flight strip rack or click it on the map, then use the sliders and buttons to issue:

- **Heading** — 0–360°
- **Altitude** — 1000–25000 ft
- **Speed** — 100–350 kt
- **Approach** — clears the aircraft for ILS to the selected runway
- **Hold** — puts the aircraft in a racetrack holding pattern
- **Takeoff** — clears a departing aircraft

### Free-text chat

Natural language commands are parsed into structured commands. Examples:

```
ARG123 turn left heading 270
DAL456 descend to flight level 80
AAL789 cleared ILS runway 13
LAN101 hold
```

### Keyboard

| Key | Action |
|---|---|
| `` ` `` | Toggle debug overlay (FPS, aircraft state dump, last 10 commands) |

### Sim toolbar

| Control | Description |
|---|---|
| ⏸ / ▶ | Pause / resume |
| ↺ | Restart scenario |
| 1× / 2× / 4× | Time compression |
| Runway icon | Toggle active runway editor |
| Flask icon *(dev only)* | Load a test scenario instantly |
| Human / AI / Collab | Controller mode toggle |

---

## Development

```bash
npm run build     # type-check + production build
npm run lint      # ESLint
npm run preview   # preview production build
```

### Running the AI evaluation harness

Runs 6 standardized scenarios × N times and prints a CSV report (collisions, violations, decisions, latency, score):

```bash
cd apps/server
npx tsx src/evaluation.ts       # 3 runs per scenario (default)
npx tsx src/evaluation.ts 5     # 5 runs per scenario
```

### Telemetry logs

Written to `apps/server/logs/agent-{YYYY-MM-DD}.jsonl` — one JSONL entry per decision, rejection, safety override, or session start.

Replay files are saved to `apps/server/logs/replays/` on server shutdown, or manually:

```bash
curl http://localhost:3001/api/replay/save
```

---

## Further reading

- [`MECHANICS.md`](./MECHANICS.md) — full simulation rules: ILS capture, separation thresholds, scoring, holding, aircraft performance profiles, difficulty scaling
- [`AGENT.md`](./AGENT.md) — AI agent architecture, LLM prompt, JSON schema, Socket.IO event reference, evaluation harness details
