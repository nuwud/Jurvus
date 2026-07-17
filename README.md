# 🤖 Jurvus — Mission Control for Your AI Agents

> **Jurvus** = *Jarvis for Nuwud*. A real-time 3D visualization of the OpenClaw agent fleet running on LUMINARCH-TITAN — orbs, HUD, and workspaces, powered by Three.js.

![Status](https://img.shields.io/badge/status-v1_scaffold-blueviolet) ![Three.js](https://img.shields.io/badge/three.js-WebGL-orange) ![Spec Guided](https://img.shields.io/badge/build-spec--guided-brightgreen)

---

## ✨ What It Does

- 🟣 **Agent Orbs** — one living, breathing orb per OpenClaw agent, orbiting a central gateway core. Color and motion reflect real state: idle 😌, running ⚡, error 🔴.
- 🎛️ **Jarvis HUD** — VRAM gauge, cron countdown ring, event ticker, and channel status dots framing the scene.
- 🖥️ **Workspaces View** — fly the camera down to a room of agent workstations, each desk showing its agent's live status.
- 🔌 **Telemetry Bridge** — a small local Node service that polls OpenClaw, Ollama, and the GPU, then streams clean JSON to the browser. Your gateway token never touches the page.

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
# .env holds GATEWAY_TOKEN (auto-detected from ~/.openclaw/openclaw.json)
npm run dev
# open http://localhost:4200
```

> 📌 Ports **3210** (server) and **4200** (dev SPA) are registered in the LUMINARCH-TITAN port registry (`~/.openclaw/port-registry.md`). tenacitOS runs separately on **4300**.

## 🎮 Controls

| Input | Action |
|-------|--------|
| 🖱️ Drag | Orbit camera |
| 🖱️ Scroll | Zoom |
| 🖱️ Click orb | Open agent detail panel |
| ⌨️ `1` | Orbs + HUD view |
| ⌨️ `2` | Workspaces view |
| ⌨️ `Esc` | Close panel |

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
