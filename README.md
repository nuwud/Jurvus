# 🤖 Jurvus — Mission Control for Your AI Agents

> **Jurvus** = *Jarvis for Nuwud*. A real-time 3D visualization of the OpenClaw agent fleet running on LUMINARCH-TITAN — orbs, HUD, and workspaces, powered by Three.js.

![Version](https://img.shields.io/badge/version-1.0.1-blueviolet) ![Three.js](https://img.shields.io/badge/three.js-WebGL-orange) ![Spec Guided](https://img.shields.io/badge/build-spec--guided-brightgreen) ![License](https://img.shields.io/badge/license-ISC-blue)

---

## ✨ What It Does

- 🟣 **Agent Fleet Ring** — one living, breathing orb per OpenClaw agent (auto-discovered), orbiting the central presence orb. Color and motion reflect real state: idle 😌, running ⚡, error 🔴, with pentatonic SFX on transitions.
- 💬 **Click-to-Talk** — select any orb (click, drag-snap, scroll wheel, or ←/→ keys) and the chat panel + voice loop route to that agent's session. A GITS-style curved text ring circles the active orb.
- 💡 **ADVISE** — every agent can coach you: one click sends a domain-specific prompt asking for the top 3 highest-leverage revenue actions in its lane.
- 🎙 **Voice Loop** — hands-free: VAD mic detection → local whisper.cpp transcription → agent → streaming edge-tts reply, interruptible mid-sentence.
- 🏀 **ThreeJS-Ball DNA** — per-facet synth timbres on hover, surface dents that spring back, E-major click chords.
- 🎥 **Cinema Mode** — hides the entire HUD and auto-orbits the camera for clean recordings.
- 🔌 **Telemetry Server** — a local Node relay that speaks the Gateway WebSocket protocol, polls cron/GPU/Ollama, and streams state over SSE. Your gateway token never touches the page.

## 🧱 Foundation — Standing on Open Shoulders

Jurvus is a **remix**, not a from-scratch build:

- 🦾 Server relay + HUD bones forked from [**openclaw-jarvis-ui**](https://github.com/jincocodev/openclaw-jarvis-ui) (ISC) by Jincoco — Gateway WebSocket streaming, token auth relay, SSE system monitor, TTS. Upstream orb design credit: [Filip Zrnzevic](https://codepen.io/filipz).
- 🏀 The orb itself is Nuwud's [**ThreeJS-Ball**](https://github.com/nuwud/threejs-ball) — deformable icosahedron, gradient materials, facet audio.
- 🏢 Daily-driver dashboards (cron manager, costs, memory browser, 3D office) are delegated to [**tenacitOS**](https://github.com/carlosazaustre/tenacitOS) (MIT), installed separately — Jurvus doesn't duplicate them.

**Jurvus's own contribution:** fleet-of-orbs view (one living ThreeJS-Ball per agent), agent-state choreography, and the cinematic HUD.

## 🗺️ Architecture

```
┌────────────────────┐   ws (token 🔒)  ┌──────────────────────┐   ws://3210   ┌───────────────────┐
│ OpenClaw Gateway   │◄────────────────┤  server/ (Express)   ├──────────────►│  Vite SPA @4200   │
│ ws://127.0.0.1:3100│                 │  relay · SSE · sysmon │               │  orb fleet · HUD  │
└────────────────────┘                 └──────────────────────┘               └───────────────────┘
```

## 🚀 Quick Start

```powershell
npm install
./setup.sh          # auto-detects Gateway token → .env (or set GATEWAY_TOKEN manually)

# Production (recommended)
npm run build
node --env-file=.env server/index.js
# open http://localhost:3210

# Development (Vite HMR)
npm run dev
# open http://localhost:4200
```

> 📌 Ports **3210** (server) and **4200** (dev SPA) are registered in the LUMINARCH-TITAN port registry (`~/.openclaw/port-registry.md`). tenacitOS runs separately on **4300**.

## 🎮 Controls

| Input | Action |
|-------|--------|
| 🖱️ Drag empty space | Orbit camera |
| 🖱️ Scroll (off ring) | Zoom |
| 🖱️ Click orb | Select agent → chat/voice route to it (E-major chord 🎵) |
| 🖱️ Drag an orb | Spin the ring — release snaps nearest orb to front |
| 🖱️ Scroll over ring | Step to next/prev agent |
| 🖱️ Hover orb | Facet sounds + surface dents (ThreeJS-Ball style) |
| ⌨️ `←` / `→` | Cycle agents |
| ⌨️ `Esc` | Exit cinema mode |
| 🎛️ DATA CENTER → FLEET | Ring/labels/focus toggles, spin/radius/size sliders, agent menu, 💡 ADVISE, 🎙 VOICE, 🎥 CINEMA |
| ♪ AUDIO panel | Play/pause/stop/±10s, scrub bar, music + SFX volume |

## 📐 Spec-Guided Build

This project is built spec-first. The living spec is the source of truth:

- 📄 [`docs/SPEC.md`](docs/SPEC.md) — scope, data contract, visual states, phase plan

If code and spec disagree, the spec wins (or gets amended first). ✍️

## 🧬 Lineage

The orb core is adapted from [**ThreeJS-Ball**](https://github.com/nuwud/threejs-ball) 🏀 — Nuwud's interactive deformable sphere (icosahedron geometry, gradient materials, breathing animation). The full facet-audio engine ports over in Phase 2. 🔊

## 🛣️ Roadmap

- ✅ **Phase 1** — jarvis-ui foundation, gateway protocol 4, rebrand
- ✅ **Phase 2** — agent fleet ring with live state choreography (idle 😌 / running ⚡ / error 🔴), click-to-talk agent routing
- ✅ **Phase 3** — fleet controls, ThreeJS-Ball facet audio + dents, Watermelon ring drag/scroll/snap, 💡 ADVISE revenue coaching, GITS text ring, 🎙 voice loop (local whisper + edge-tts), 🎥 cinema mode, full audio transport
- ✅ **Phase 4** — ClawHub skill packaging (`SKILL.md`), v1.0.0
- 🔮 **Next** — multi-host fleets, premium theme variants, richer per-agent analytics

> 🖥️ The **workspaces/3D-office view** is served by tenacitOS (installed alongside) rather than rebuilt here — see `docs/SPEC.md §2`.

---

Built with 💜 by [Nuwud Multimedia](https://nuwud.com) · Premium Shopify systems, immersive 3D, and AI-powered tools.
