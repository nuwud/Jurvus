---
name: jurvus
description: Jurvus — mission-control HUD for an OpenClaw agent FLEET. One living Three.js orb per agent with real-time state (idle/running/error), click/drag/scroll a Watermelon-style ring to pick who you talk to, per-agent revenue ADVISE coaching, hands-free voice loop (local whisper STT + edge-tts), facet audio, GITS-style HUD, cinema mode for filming. Use when you run multiple OpenClaw agents and want one visual command center.
metadata: {"openclaw":{"emoji":"🤖","version":"1.0.0","requires":{"bins":["node","npm"]},"homepage":"https://github.com/nuwud/Jurvus"}}
---

# 🤖 Jurvus — Agent Fleet Mission Control

Jarvis for Nuwud — a 3D HUD where every OpenClaw agent is a living orb.

## Install

```bash
git clone https://github.com/nuwud/Jurvus.git
cd Jurvus
npm install
./setup.sh   # auto-detects Gateway token → .env (or set GATEWAY_TOKEN manually)
npm run build
node --env-file=.env server/index.js
```

Open `http://localhost:3210`

Agents are auto-discovered from `~/.openclaw/openclaw.json` — zero fleet configuration.

## Customize

Copy and edit `config.local.json` (overrides `config.json`):

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Page title | Jurvus |
| `agent.name` | Default agent display name | LOC |
| `agent.sessionKey` | Default OpenClaw session | agent:main:main |
| `server.port` | Server port | 3210 |
| `server.gatewayUrl` | Gateway WebSocket | ws://127.0.0.1:3100 |
| `tts.edgeVoice` | Edge TTS voice | en-US-GuyNeural |
| `theme.accentPrimary` | Accent color | #8800FF |

## Features

- 🟣 **Fleet ring** — one deformable orb per agent, real state from cron telemetry (breathe/pulse/flash), GPU + gateway health collectors
- 🖱️ **Watermelon ring control** — drag to spin, scroll to step, click to select, snap-to-camera-front, ←/→ keys
- 💬 **Click-to-talk** — selecting an orb routes chat (and voice) to that agent's session
- 💡 **ADVISE** — per-agent revenue coaching prompts: top-3 next actions in that agent's domain
- 🎙 **Voice loop** — VAD mic → local whisper.cpp STT → agent → edge-tts reply, interruptible
- 🔊 **Facet audio** — per-facet synth timbres + hover dents ported from ThreeJS-Ball
- 🌀 **GITS text ring** — rotating curved status text around the active orb
- 🎥 **Cinema mode** — HUD-free auto-orbit for recording
- 🎛️ Full audio transport — play/pause/stop/seek/scrub, SFX + music volume

## Voice requirements (optional)

- `pip install edge-tts` (TTS)
- whisper.cpp binary + model; set in `.env`:
  ```
  JURVUS_WHISPER_BIN=C:\path\to\whisper-cli.exe
  JURVUS_WHISPER_MODEL=C:\Users\you\.whisper-models\ggml-base.bin
  JURVUS_VOICE_LANG=en
  ```

## Requirements

- Node.js 20+ · OpenClaw Gateway (protocol 4, 2026.7.x)

## Credits

Foundation forked from [openclaw-jarvis-ui](https://github.com/jincocodev/openclaw-jarvis-ui) (ISC) by Jincoco; orb visual concept by [Filip Zrnzevic](https://codepen.io/filipz). Orb DNA and ring methodology from Nuwud's [ThreeJS-Ball](https://github.com/nuwud/threejs-ball) and [Watermelon-Hydrogen](https://github.com/nuwud/Watermelon-Hydrogen).
