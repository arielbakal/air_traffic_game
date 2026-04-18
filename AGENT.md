# AGENT.md — AI Controller Reference

## Architecture

Three-layer hybrid control:

```
LLM (Ollama) → Command Validator → Deterministic Safety Engine → Aircraft State
```

**Layer 1 — LLM Strategic Agent** (`apps/server/src/agent.ts`):
- Runs every 7 sim-seconds (configurable), skips if busy
- 15-second per-aircraft cooldown to prevent yo-yoing
- Calls Ollama via HTTP, parses structured JSON response
- Tracks state: `idle | thinking | applying`, decision count, mean latency

**Layer 2 — Command Validator** (`apps/server/src/validator.ts`):
- Fuzzy callsign matching (tolerates minor typos)
- State legality: no approach on departing aircraft, no takeoff on arriving, etc.
- Value sanity: headings 0–360, altitudes 1000–25000ft, speeds 100–350kt
- Deduplication: one command per aircraft per decision cycle

**Layer 3 — Safety Engine** (`apps/server/src/safetyEngine.ts`):
- Runs every physics tick (10Hz), overrides LLM if collision imminent within 60s
- TCAS-RA logic: climbs higher aircraft +1000ft, descends lower −1000ft
- Emits `agent:override` event to frontend

## LLM Interface

**Model**: `qwen3:8b` (default) — configurable via `OLLAMA_MODEL` env var  
**Host**: `localhost:11434` — configurable via `OLLAMA_HOST`  
**Temperature**: 0.2  
**Context window**: 4096 tokens

### System Prompt (summary)

Role: experienced ATC controller managing Buenos Aires TMA.

Separation minima:
- Warning: < 5nm or < 1500ft vertical
- Critical: < 3nm or < 1000ft vertical
- Collision: < 1nm or < 200ft vertical

ILS capture conditions (SABE):
- Within 18nm of threshold
- Heading within 30° of runway heading
- Altitude within 1800ft of 3° glideslope intercept

Priority framework:
1. Resolve active collision threats
2. Sequence approaches to SABE
3. Clear departures
4. Maintain separation margins

### JSON Schema

```json
{
  "assessment": "<situational summary>",
  "commands": [
    { "type": "heading",  "callsign": "ARG123", "value": 270, "reasoning": "..." },
    { "type": "altitude", "callsign": "ARG456", "value": 7000, "reasoning": "..." },
    { "type": "speed",    "callsign": "ARG789", "value": 220, "reasoning": "..." },
    { "type": "approach", "callsign": "ARG101", "runway": "SABE-13", "reasoning": "..." },
    { "type": "hold",     "callsign": "ARG202", "reasoning": "..." },
    { "type": "takeoff",  "callsign": "ARG303", "runway": "SABE-31", "reasoning": "..." },
    { "type": "noop",     "reasoning": "situation nominal" }
  ]
}
```

### Situation Report Format

Each decision cycle the agent receives a markdown report:

```
## ATC Situation Report — T+{seconds}s

### Active Aircraft
| Callsign | Status | Alt | Hdg | Spd | Dist/Brg from SABE | Runway |
...

### Active Conflicts
| A/C 1 | A/C 2 | Severity | Distance | Alt Diff |
...

### Pending Decisions
- Prior commands still in effect: ...
```

## Controller Modes

**Human** (`human`): Local Zustand store runs the physics loop; backend not used.

**AI** (`ai`): Backend runs physics at 10Hz; frontend receives state via Socket.IO `game:state`. Human commands are silently ignored by the server. Agent issues all commands.

**Collaborative** (`collaborative`): Agent issues commands to a pending queue. Human approves (`command:approve`) or rejects (`command:reject`) via the UI before they take effect.

## Socket.IO Events

| Direction | Event | Payload |
|---|---|---|
| Server → Client | `game:state` | Full serialized `GameState` |
| Server → Client | `agent:status` | `{ mode, model, ollamaHost, agentStatus }` |
| Server → Client | `agent:decision` | `{ assessment, commands, status }` |
| Server → Client | `agent:override` | Override metadata |
| Client → Server | `game:command` | `{ callsign, command: CommandType }` |
| Client → Server | `game:pause` | `boolean` |
| Client → Server | `game:speed` | `1 \| 2 \| 4` |
| Client → Server | `game:restart` | — |
| Client → Server | `mode:change` | `ControllerMode` |
| Client → Server | `command:approve` | `index: number` |
| Client → Server | `command:reject` | `index: number` |

## Telemetry

JSONL log entries written to `logs/agent-{YYYY-MM-DD}.jsonl`:
- `session_start` — model, seed, difficulty
- `decision` — assessment, commands, latency, token counts
- `rejection` — command that failed validation, reason
- `safety_override` — aircraft id, patch applied
- `error` — exception during agent cycle

## Evaluation Harness

Run: `cd apps/server && npx tsx src/evaluation.ts [runs=3]`

Scenarios (6 total):
- `HEAD_ON_CONFLICT` — two aircraft converging head-on (120s)
- `VERTICAL_CONFLICT` — stacked aircraft needing altitude separation (60s)
- `APPROACH_SABE_13` — single aircraft on ILS approach (180s)
- `HOLDING_TEST` — aircraft in hold, needs clearance (120s)
- `RUSH_HOUR` — 5 aircraft competing for runway (300s)
- `DEPARTURE_TEST` — departure sequencing (90s)

Output CSV columns: `scenario, run, success, collisions, violations, landings, departures, decisions, issued, rejected, latencyMs, tokensIn, tokensOut, score`

**Success criterion**: zero collisions.

## Running the Backend

```bash
cd apps/server
npm install
npm start              # default: port 3001, qwen3:8b @ localhost:11434

# Override model/host:
OLLAMA_MODEL=llama3.2 OLLAMA_HOST=http://192.168.1.10:11434 npm start

# Controller mode (default: collaborative):
CONTROLLER_MODE=ai npm start
```

Frontend connects automatically when mode is switched from Human to AI/Collaborative.
