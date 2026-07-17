# 📐 Jurvus v1 Specification

*Living document — amend before you code. Last updated: 2026-07-17*

> 🔄 **Amendment 2026-07-17:** After open-source research, Jurvus is now a **remix** on the [openclaw-jarvis-ui](https://github.com/jincocodev/openclaw-jarvis-ui) foundation (ISC). Its Express server already provides the Gateway WS relay, token handling, SSE system monitor, and a working orb HUD — replacing the custom `bridge/` planned below. The **workspaces view is descoped** to [tenacitOS](https://github.com/carlosazaustre/tenacitOS) (installed alongside on port 4300), which ships a mature 3D office. Sections below marked 🏛️ *legacy* describe the original from-scratch plan and are kept for the data contract + visual-state language, which still govern Phase 2.

## 1. 🎯 Goal

Give Patrick a single glanceable view of what his OpenClaw agent fleet is doing right now: which agents are alive, working, or erroring; what cron jobs fire next; how loaded the GPU is; and whether channels (Slack/WhatsApp) are healthy.

**Non-goals (v1):** controlling agents, sending messages, audio, voice, auth for remote viewers.

## 1.5 🔀 Revised Plan (current)

| Phase | Work | Source |
|-------|------|--------|
| **1** 🚧 | Vendor jarvis-ui → `Jurvus`, config to gateway `ws://127.0.0.1:3100`, server port **3210**, SPA port **4200**, rebrand (name "Jurvus", Nuwud palette) | jarvis-ui |
| **2** ✅ | **Fleet ring shipped 2026-07-17:** `server/fleet.js` polls gateway RPC (`cron.list`) + `nvidia-smi` every 5s → SSE `{type:'fleet'}`; `src/components/fleet.js` renders one dual-layer ThreeJS-Ball-style orb per agent (breathing idle 😌, wobble+pulse running ⚡, triple-flash error 🔴, dimmed unknown 😶) in a slow-spinning ring; **click an orb → chat routes to that agent** (`POST /api/agent/select` swaps sessionKey server-side, history reloads). Central orb kept as LOC presence. | this repo |
| **2.5** 🔜 | VRAM gauge HUD panel (data already in fleet SSE), facet-audio port from ThreeJS-Ball, cron countdowns on orb labels | this repo |
| **3a** ✅ | **Controls shipped 2026-07-17:** FLEET tab in DATA CENTER — ring/label toggles, spin/radius/orb-size sliders (persisted), live agent menu with state dots + click-to-talk; `fleet-audio.js` SFX engine (pentatonic pings ⚡, error buzz 🔴, select click — volume/mute persisted); 🎥 CINEMA mode (all HUD hidden, camera auto-orbit, ESC exits) | this repo |
| **3b** ✅ | **Ball DNA shipped 2026-07-17:** faithful ThreeJS-Ball facet audio port (baseFreq 220+(facet%12)·50, waveform-per-facet, ±50¢ detune, ball envelope) on orb hover; hover **dents** with 0.6s spring-back on both mesh layers; E-major click chord on orb select; Watermelon-Hydrogen Carousel3DPro focus methodology — selected orb eases to front and holds (FOCUS toggle), ←/→ arrow keys cycle agents (credit: nuwud/Watermelon-Hydrogen, nuwud/threejs-ball) | this repo |
| **3c** ✅ | **Ring interaction + advisor shipped 2026-07-17:** grab-and-drag ring rotation with snap-to-nearest-front + select on release; scroll wheel over ring steps prev/next agent (zoom preserved off-ring); 💡 **ADVISE** — per-agent button + "WHAT SHOULD I DO NEXT?" sends a domain-specific revenue-coaching prompt (per-agent domain map) into that agent's chat; SFX volume/mute + music volume/stop injected into the ♪ AUDIO panel | this repo |
| **3d** ✅ | **Voice + polish shipped 2026-07-17:** camera-relative snap-to-front (front anchor computed live from camera azimuth — tracks orbits); GITS-style rotating curved-text ring on selected orb (agent · state · ONLINE, canvas texture, screen-space spin); 🎙 VOICE toggle wires upstream VAD loop — mic → whisper-cli (local, `~/.whisper-models`) → selected agent → edge-tts reply, verified end-to-end (test WAV transcribed verbatim); auto-start on login for Jurvus + tenacitOS via Startup-folder silent VBS launchers | this repo |
| **4** 🔮 | Productization: configurable multi-host build, ClawHub packaging, premium theme variants | this repo |

**Attribution:** ISC license and Jincoco/Filip Zrnzevic credits stay in README + LICENSE. ✍️

## 2. 🧩 Components 🏛️ *legacy reference*

### 2.1 🔌 Telemetry Bridge (`bridge/`)

Node 22+, deps: `ws` only. Runs on **port 3210** (HTTP + WebSocket).

| Endpoint | Purpose |
|----------|---------|
| `GET /snapshot` | Latest telemetry JSON (for debugging / other consumers) |
| `WS /` | Pushes telemetry JSON to all clients on every poll tick |

**Collectors** (each wrapped in try/catch; failure marks its section `stale`, never crashes the loop):

| Collector | Command | Interval |
|-----------|---------|----------|
| `cron` | `openclaw cron list --json` | 5s |
| `health` | `openclaw gateway call health` (fallback: `openclaw health`) | 10s |
| `ollama` | `GET http://localhost:11434/api/ps` (fallback: `ollama ps`) | 5s |
| `gpu` | `nvidia-smi --query-gpu=... --format=csv,noheader` | 5s |

🔒 **Security:** bridge binds `127.0.0.1` only. Gateway token (if ever needed) is read from OpenClaw config server-side and never sent to clients.

### 2.2 📦 Data Contract (bridge → app)

```jsonc
{
  "ts": 1784320000000,
  "collectors": { "cron": "ok", "health": "ok", "ollama": "ok", "gpu": "ok" }, // or "stale"
  "gateway": { "ok": true, "detail": "event loop ok" },
  "channels": { "slack": "ok", "whatsapp": "ok" },        // "ok" | "down" | "unknown"
  "agents": [
    {
      "id": "nuwud-dev",
      "state": "idle",              // idle | running | error | unknown
      "model": "ollama/qwen3:14b",  // model of most recent/next cron job, if known
      "lastRunTs": 1784319000000,
      "lastStatus": "ok",           // ok | error | running | null
      "jobs": 2                     // cron jobs owned by this agent
    }
  ],
  "cron": [
    { "id": "…", "name": "hb-nuwud-ops", "agentId": "nuwud-ops",
      "nextRunTs": 1784325000000, "lastStatus": "ok", "schedule": "every 2h" }
  ],
  "gpu": { "name": "RTX 4090", "usedMiB": 3200, "totalMiB": 24564, "utilPct": 12 },
  "ollama": { "models": [ { "name": "qwen3:14b", "sizeBytes": 9300000000, "until": "…" } ] }
}
```

**Agent state derivation (v1):** `running` if any of the agent's cron jobs report status `running`; `error` if most recent job status is `error`; else `idle`. Agents come from the health output's agent roster; agents with no cron jobs are `unknown` (shown dimmed).

### 2.3 🎨 Visualization App (`app/`)

Vite + vanilla Three.js ES modules on **port 4200**. Single scene, two camera rigs (views), DOM overlay HUD.

#### 🟣 Orbs + HUD view (default, key `1`)

- Central **gateway core**: large slow-rotating icosahedron. Cyan glow when `gateway.ok`, red when down.
- **Agent orbs** on an orbit ring around the core, evenly spaced, name label sprite below each.
- Orb visual states:

| State | Color | Motion |
|-------|-------|--------|
| 😌 `idle` | agent's hue, gentle gradient | slow breathing (scale ±2%, ~4s period) |
| ⚡ `running` | brightened + emissive boost | fast pulse (~0.8s) + vertex ripple |
| 🔴 `error` | red gradient | sharp flash ×3, then simmering glow |
| 😶 `unknown` | desaturated gray | static, 40% opacity |

- Orb core adapted from ThreeJS-Ball: `IcosahedronGeometry(1, 3)`, canvas-generated radial gradient texture, per-vertex displacement for ripple.
- 🖱️ Click orb → **detail panel** (DOM, right side): agent id, state, model, jobs, last run time/status, owned cron jobs with next-run countdowns.

#### 🎛️ HUD (DOM/SVG overlay, both views)

- 📊 **VRAM gauge** (top right): used/total MiB bar + GPU util %. Turns amber >80%, red >92%.
- ⏱️ **Cron ring** (bottom left): next 5 jobs, name + countdown `mm:ss`.
- 📜 **Event ticker** (bottom): last 20 state transitions ("nuwud-ops ⚡ running", "hb-nuwud-content ✅ ok").
- 🔵 **Channel dots** (top left): Slack / WhatsApp / Gateway, green/red/gray.
- ⚠️ **Stale banner**: if bridge disconnects, dim scene + "TELEMETRY OFFLINE" banner.

#### 🖥️ Workspaces view (key `2`)

- Camera flies down/over to a floor grid of **workstation pods**, one per agent: rounded desk box, monitor plane, chair block, status light bar.
- Monitor emissive color = agent state (same palette as orbs). Status light animates when `running`.
- Name label above each pod. Click pod → same detail panel.
- v1 keeps geometry primitive (boxes/planes) — richer props are Phase 2. 🚧

#### 🎥 Shared

- `OrbitControls` for camera; view switch animates camera between rigs (~1.2s ease).
- 60fps target; all per-frame allocations avoided; single `requestAnimationFrame` loop.
- Reconnecting WS client with exponential backoff (1s → 15s cap).

## 3. 🎨 Palette

| Element | Color |
|---------|-------|
| Background | `#07070f` deep space |
| Gateway core | `#00FFFF` cyan |
| Agent base hues | assigned from golden-angle rotation per agent index (stable order = sorted ids) |
| Running boost | +30% lightness, emissive `0.6` |
| Error | `#FF2244` |
| HUD text | `#9fefff` on translucent `#0a0a18cc` panels |

## 4. 🛣️ Phases

| Phase | Contents | Status |
|-------|----------|--------|
| **1** | Bridge (poll), orbs + HUD, workspaces v1, detail panel, view switching | 🚧 this build |
| **2** | Gateway WS event stream, ThreeJS-Ball facet audio port, token ripples, richer workspace props, session/log tail in panel | 🔜 |
| **3** | Voice layer, TikTok camera mode, multi-host support, productization | 🔮 |

## 5. ✅ Acceptance (Phase 1)

1. `npm start` in `bridge/` → `GET localhost:3210/snapshot` returns contract-shaped JSON with live cron + GPU data.
2. `npm run dev` in `app/` → orbs render for every agent in the roster; states match `openclaw cron list`.
3. Kill the bridge → app shows TELEMETRY OFFLINE within 10s; restart → recovers without reload.
4. Trigger `openclaw cron run <hb job>` → that agent's orb goes ⚡ running, then back to 😌, and the ticker logs both transitions.
5. Views switch with `1`/`2`; panel opens from both views.
