// ── Jurvus Fleet Ring (Phase 2) ──
// One orb per OpenClaw agent, orbiting the central LOC orb.
// Visual language ported from Nuwud's ThreeJS-Ball: dual-layer icosahedron
// (translucent surface + wireframe overlay), breathing/pulse/flash choreography.
// Click an orb to route the chat panel to that agent's session.

import * as THREE from 'three';
import { getScene, getCamera } from '../core/scene.js';

const RING_RADIUS = 6.2;
const ORB_RADIUS = 0.55;
const RING_SPIN = 0.02; // rad/s — slow drift of the whole ring

const STATE_STYLE = {
  idle:    { opacity: 0.35, wire: 0.9,  breatheHz: 0.25, breatheAmt: 0.03, wobble: 0.00 },
  running: { opacity: 0.65, wire: 1.0,  breatheHz: 1.4,  breatheAmt: 0.09, wobble: 0.16 },
  error:   { opacity: 0.75, wire: 1.0,  breatheHz: 3.0,  breatheAmt: 0.05, wobble: 0.05 },
  unknown: { opacity: 0.12, wire: 0.25, breatheHz: 0.0,  breatheAmt: 0.0,  wobble: 0.00 },
};

const ERROR_COLOR = new THREE.Color('#ff2244');

let group = null;
let orbs = new Map();      // agentId -> orb record
let selectedId = null;
let selectionRing = null;
let clock = new THREE.Clock();

function agentColor(index, total, ui) {
  if (ui?.color) return new THREE.Color(ui.color);
  // Golden-angle hue rotation, anchored on ThreeJS-Ball magenta (300°)
  const hue = ((300 + index * 137.508) % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.95, 0.6);
}

function makeLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 56px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillStyle = '#e8f6ff';
  ctx.fillText(text.toUpperCase(), 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.6, 0.65, 1);
  return sprite;
}

function makeOrb(agent, index, total) {
  const color = agentColor(index, total, agent.ui);
  const pivot = new THREE.Group();
  const holder = new THREE.Group();

  // Dual-layer ThreeJS-Ball look
  const geo = new THREE.IcosahedronGeometry(ORB_RADIUS, 2);
  const surface = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  const wire = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
    color, wireframe: true, transparent: true, opacity: 0.9,
  }));
  wire.userData.basePositions = wire.geometry.attributes.position.array.slice();

  const label = makeLabel(agent.id.replace(/^nuwud-/, ''), '#' + color.getHexString());
  label.position.y = -ORB_RADIUS - 0.55;

  holder.add(surface, wire, label);
  holder.userData = { agentId: agent.id };
  surface.userData = { agentId: agent.id };
  wire.userData.agentId = agent.id;

  const angle = (index / total) * Math.PI * 2;
  holder.position.set(Math.cos(angle) * RING_RADIUS, Math.sin(angle * 2) * 0.35, Math.sin(angle) * RING_RADIUS);
  pivot.add(holder);

  return {
    id: agent.id, pivot, holder, surface, wire, label,
    color, state: 'unknown', errorFlashT: 0, phase: Math.random() * Math.PI * 2,
  };
}

function setState(orb, state) {
  if (orb.state === state) return;
  if (state === 'error') orb.errorFlashT = clock.elapsedTime;
  orb.state = state;
  const target = state === 'error' ? ERROR_COLOR : orb.color;
  orb.surface.material.color.copy(target);
  orb.wire.material.color.copy(target);
}

// ── Public: build / sync from telemetry ──

function syncFleet(agents) {
  if (!group) return;
  const total = agents.length || 1;
  agents.forEach((agent, i) => {
    let orb = orbs.get(agent.id);
    if (!orb) {
      orb = makeOrb(agent, i, total);
      orbs.set(agent.id, orb);
      group.add(orb.pivot);
    }
    setState(orb, agent.state || 'unknown');
  });
}

// ── Selection ──

async function selectAgent(agentId) {
  if (selectedId === agentId) return;
  try {
    const r = await fetch('/api/agent/select', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
    if (!r.ok) throw new Error('select failed');
    selectedId = agentId;

    // Selection halo
    const orb = orbs.get(agentId);
    if (orb) {
      if (!selectionRing) {
        selectionRing = new THREE.Mesh(
          new THREE.TorusGeometry(ORB_RADIUS + 0.22, 0.02, 8, 48),
          new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0.85 })
        );
      }
      orb.holder.add(selectionRing);
      selectionRing.material.color.copy(orb.color);
    }

    // Retitle the chat panel + notify the rest of the UI
    const chatLabel = document.querySelector('.terminal-panel.chat-panel .terminal-header span');
    if (chatLabel) chatLabel.textContent = `${agentId.toUpperCase()} CHAT`;
    window.dispatchEvent(new CustomEvent('jurvus-agent-selected', { detail: agentId }));
  } catch (err) {
    console.error('[FLEET] agent select failed:', err);
  }
}

function initPicking() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('click', (e) => {
    if (e.target.tagName !== 'CANVAS') return; // ignore clicks on HUD panels
    const camera = getCamera();
    if (!camera || !group) return;
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(group.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData?.agentId) node = node.parent;
      if (node?.userData?.agentId) { selectAgent(node.userData.agentId); return; }
    }
  });
}

// ── Animation (transform mutation only; render happens in the main loop) ──

function animate() {
  requestAnimationFrame(animate);
  if (!group) return;
  const t = clock.getElapsedTime();
  group.rotation.y = t * RING_SPIN;

  for (const orb of orbs.values()) {
    const style = STATE_STYLE[orb.state] || STATE_STYLE.unknown;

    // Breathing / pulsing scale
    const s = 1 + Math.sin(t * style.breatheHz * Math.PI * 2 + orb.phase) * style.breatheAmt;
    orb.holder.scale.setScalar(s);

    // Opacity targets
    orb.surface.material.opacity += (style.opacity * 0.5 - orb.surface.material.opacity) * 0.1;
    orb.wire.material.opacity += (style.wire - orb.wire.material.opacity) * 0.1;

    // Error flash: 3 sharp blinks after transition
    if (orb.state === 'error') {
      const dt = t - orb.errorFlashT;
      if (dt < 1.6) {
        const blink = Math.abs(Math.sin(dt * Math.PI * 3.75));
        orb.wire.material.opacity = 0.3 + blink * 0.7;
      }
    }

    // Vertex wobble when running (ThreeJS-Ball deformation nod)
    if (style.wobble > 0) {
      const pos = orb.wire.geometry.attributes.position;
      const base = orb.wire.userData.basePositions;
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const nx = base[ix], ny = base[ix + 1], nz = base[ix + 2];
        const w = 1 + Math.sin(t * 6 + nx * 5 + ny * 7 + nz * 3) * style.wobble * 0.12;
        pos.array[ix] = nx * w; pos.array[ix + 1] = ny * w; pos.array[ix + 2] = nz * w;
      }
      pos.needsUpdate = true;
    }

    // Billboard labels are sprites — nothing to do; keep them upright vs ring spin
    orb.holder.rotation.y = -group.rotation.y;
  }
}

// ── Init ──

export function initFleet() {
  const scene = getScene();
  if (!scene) { console.warn('[FLEET] scene not ready'); return; }
  group = new THREE.Group();
  group.name = 'jurvus-fleet';
  scene.add(group);

  // Live updates via SSE
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'fleet' && Array.isArray(msg.agents)) syncFleet(msg.agents);
    } catch {}
  };

  // Seed immediately from snapshot
  fetch('/api/fleet').then(r => r.json()).then(d => {
    if (Array.isArray(d.agents)) syncFleet(d.agents);
  }).catch(() => {});

  initPicking();
  animate();
  console.log('[FLEET] initialized');
}
