// ── Jurvus Fleet Ring (Phase 2) ──
// One orb per OpenClaw agent, orbiting the central LOC orb.
// Visual language ported from Nuwud's ThreeJS-Ball: dual-layer icosahedron
// (translucent surface + wireframe overlay), breathing/pulse/flash choreography.
// Click an orb to route the chat panel to that agent's session.

import * as THREE from 'three';
import { getScene, getCamera, getControls } from '../core/scene.js';
import { sfxRunning, sfxDone, sfxError, sfxSelect, sfxFacet, sfxChord } from '../core/fleet-audio.js';

const ORB_RADIUS = 0.55;

// ── Adjustable settings (Phase 3), persisted in localStorage ──
const settings = {
  visible: localStorage.getItem('jurvus-fleet-visible') !== '0',
  labels: localStorage.getItem('jurvus-fleet-labels') !== '0',
  spin: parseFloat(localStorage.getItem('jurvus-fleet-spin') ?? '0.02'),
  radius: parseFloat(localStorage.getItem('jurvus-fleet-radius') ?? '6.2'),
  scale: parseFloat(localStorage.getItem('jurvus-fleet-scale') ?? '1'),
  focus: localStorage.getItem('jurvus-fleet-focus') !== '0', // Watermelon-style snap-to-front
  sound: true,
};

// Watermelon-Hydrogen Carousel3DPro convention: deterministic index→angle
// mapping with a camera-relative front anchor (credit: nuwud/Watermelon-Hydrogen).
// Ring-local world angle of an orb = orb.angle - spinAngle (group Y-rotation),
// so "in front" means orb.angle - spin ≈ camera azimuth → target spin follows
// the camera live, wherever the user has orbited it.
let focusOrbId = null; // orb held at front while focus mode is on

function cameraAzimuth() {
  const cam = getCamera();
  if (!cam) return Math.PI / 2;
  return Math.atan2(cam.position.z, cam.position.x);
}

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
  surface.userData.basePositions = surface.geometry.attributes.position.array.slice();

  const label = makeLabel(agent.id.replace(/^nuwud-/, ''), '#' + color.getHexString());
  label.position.y = -ORB_RADIUS - 0.55;

  holder.add(surface, wire, label);
  holder.userData = { agentId: agent.id };
  surface.userData = { agentId: agent.id };
  wire.userData.agentId = agent.id;

  const angle = (index / total) * Math.PI * 2;
  holder.position.set(Math.cos(angle) * settings.radius, Math.sin(angle * 2) * 0.35, Math.sin(angle) * settings.radius);
  pivot.add(holder);

  return {
    id: agent.id, pivot, holder, surface, wire, label, angle, index,
    color, state: 'unknown', errorFlashT: 0, phase: Math.random() * Math.PI * 2,
    dents: [], // ThreeJS-Ball hover dents: { dir: Vector3 (local), t0 }
  };
}

function setState(orb, state) {
  if (orb.state === state) return;
  const prev = orb.state;
  if (state === 'error') orb.errorFlashT = clock.elapsedTime;
  orb.state = state;
  const target = state === 'error' ? ERROR_COLOR : orb.color;
  orb.surface.material.color.copy(target);
  orb.wire.material.color.copy(target);

  // SFX on meaningful transitions (skip initial unknown→x population)
  if (settings.sound && prev !== 'unknown') {
    if (state === 'running') sfxRunning(orb.index);
    else if (state === 'error') sfxError();
    else if (state === 'idle' && prev === 'running') sfxDone(orb.index);
  }

  // Keep the GITS text ring's status text current for the selected orb
  if (orb.id === selectedId && textRingSprite) refreshTextRing(orb);
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
  // Feed the HUD agent menu (fleet-controls.js)
  window.dispatchEvent(new CustomEvent('jurvus-fleet-data', { detail: { agents, selectedId } }));
}

// ── GITS-style curved text ring (Ghost in the Shell UI homage) ──

let textRingSprite = null;

function makeCurvedTextTexture(text, colorHex) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.fillStyle = '#eaffff';
  ctx.shadowColor = colorHex; ctx.shadowBlur = 10;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Repeat the text to fill the full circle, GITS "ONLINE ONLINE" style
  const radius = 218;
  const charW = 19; // approx advance at this font size
  const circumference = 2 * Math.PI * radius;
  const unit = text + ' ● ';
  let full = unit;
  while (full.length * charW < circumference) full += unit;

  const anglePer = charW / radius;
  ctx.translate(size / 2, size / 2);
  for (let i = 0; i < full.length; i++) {
    const a = i * anglePer;
    if (a > Math.PI * 2 - anglePer) break;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -radius);
    ctx.fillText(full[i], 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function refreshTextRing(orb) {
  if (!orb) return;
  const label = `${orb.id.toUpperCase()} · ${orb.state.toUpperCase()} · ONLINE`;
  const tex = makeCurvedTextTexture(label, '#' + orb.color.getHexString());
  if (!textRingSprite) {
    textRingSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.95,
    }));
    const d = ORB_RADIUS * 4.6;
    textRingSprite.scale.set(d, d, 1);
  } else {
    textRingSprite.material.map?.dispose();
    textRingSprite.material.map = tex;
    textRingSprite.material.needsUpdate = true;
  }
  orb.holder.add(textRingSprite);
}

// ── Selection ──

export async function selectAgent(agentId) {
  if (selectedId === agentId) return;
  if (settings.sound) sfxSelect();
  try {
    const r = await fetch('/api/agent/select', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
    if (!r.ok) throw new Error('select failed');
    selectedId = agentId;

    // Selection halo + GITS curved text ring
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
      refreshTextRing(orb);
    }

    // Watermelon-style focus: ease the ring so the chosen orb faces the camera
    if (settings.focus && orb) focusOrbId = agentId;

    // Retitle the chat panel + notify the rest of the UI
    const chatLabel = document.querySelector('.terminal-panel.chat-panel .terminal-header span');
    if (chatLabel) chatLabel.textContent = `${agentId.toUpperCase()} CHAT`;
    window.dispatchEvent(new CustomEvent('jurvus-agent-selected', { detail: agentId }));
  } catch (err) {
    console.error('[FLEET] agent select failed:', err);
  }
}

function castAt(e, raycaster, mouse) {
  const camera = getCamera();
  if (!camera || !group) return null;
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(group.children, true);
  for (const hit of hits) {
    let node = hit.object;
    while (node && !node.userData?.agentId) node = node.parent;
    if (node?.userData?.agentId) return { hit, agentId: node.userData.agentId };
  }
  return null;
}

// Watermelon Carousel3DPro-style ring drag: grab an orb, drag to spin the ring,
// release snaps the nearest orb to front and selects it.
let dragging = false;
let dragMoved = false;

function nearestFrontOrb() {
  const camA = cameraAzimuth();
  let best = null, bestDiff = Infinity;
  for (const orb of orbs.values()) {
    const world = orb.angle - spinAngle; // ring-local → world azimuth
    const diff = Math.abs(((camA - world + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    if (diff < bestDiff) { bestDiff = diff; best = orb; }
  }
  return best;
}

function initPicking() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('click', (e) => {
    if (e.target.tagName !== 'CANVAS') return; // ignore clicks on HUD panels
    if (dragMoved) { dragMoved = false; return; } // drag release ≠ click
    const found = castAt(e, raycaster, mouse);
    if (found) {
      if (settings.sound) sfxChord('click'); // ThreeJS-Ball E-major click
      selectAgent(found.agentId);
    }
  });

  // ── Ring drag (Watermelon methodology) ──
  let startX = 0, startSpin = 0, controlsWereEnabled = null;

  window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName !== 'CANVAS' || e.button !== 0) return;
    const found = castAt(e, raycaster, mouse);
    if (!found) return;
    dragging = true; dragMoved = false;
    startX = e.clientX; startSpin = spinAngle;
    const controls = getControls?.();
    if (controls) { controlsWereEnabled = controls.enabled; controls.enabled = false; }
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) dragMoved = true;
    if (dragMoved) {
      focusOrbId = null; // manual control overrides focus hold
      spinAngle = startSpin + dx * 0.006;
    }
  });

  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    const controls = getControls?.();
    if (controls && controlsWereEnabled !== null) { controls.enabled = controlsWereEnabled; controlsWereEnabled = null; }
    if (dragMoved) {
      const orb = nearestFrontOrb();
      if (orb) {
        focusOrbId = orb.id; // snap to camera-front
        selectAgent(orb.id);
      }
    }
  });

  // ── Scroll wheel over the ring: step to next/prev agent (Watermelon style).
  // Wheel elsewhere on canvas still zooms via OrbitControls.
  let wheelAccum = 0, wheelCooldown = 0;
  window.addEventListener('wheel', (e) => {
    if (e.target.tagName !== 'CANVAS') return;
    const found = castAt(e, raycaster, mouse);
    if (!found) return; // not over the ring → let OrbitControls zoom
    e.preventDefault(); e.stopImmediatePropagation();

    const now = performance.now();
    if (now < wheelCooldown) return;
    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) < 40) return; // one notch per step
    const dir = wheelAccum > 0 ? 1 : -1;
    wheelAccum = 0; wheelCooldown = now + 180;

    const ids = [...orbs.values()].sort((a, b) => a.index - b.index).map(o => o.id);
    if (!ids.length) return;
    const current = nearestFrontOrb();
    const next = ids[((ids.indexOf(current?.id) < 0 ? 0 : ids.indexOf(current.id) + dir) + ids.length) % ids.length];
    const orb = orbs.get(next);
    if (orb) {
      focusOrbId = orb.id;
      selectAgent(orb.id);
    }
  }, { passive: false, capture: true });

  // ThreeJS-Ball hover: facet sounds + surface dents
  let lastFacet = -1, lastAgent = null, lastHoverT = 0;
  window.addEventListener('pointermove', (e) => {
    if (e.target.tagName !== 'CANVAS') return;
    const now = performance.now();
    if (now - lastHoverT < 50) return; // throttle raycasts
    lastHoverT = now;

    const found = castAt(e, raycaster, mouse);
    if (!found) { lastFacet = -1; lastAgent = null; return; }

    const orb = orbs.get(found.agentId);
    if (!orb) return;
    const facet = found.hit.faceIndex ?? 0;

    if (facet !== lastFacet || found.agentId !== lastAgent) {
      lastFacet = facet; lastAgent = found.agentId;
      if (settings.sound) {
        const u = 0.5 + (found.hit.face?.normal?.x || 0) * 0.5;
        sfxFacet(facet, u);
      }
      // Dent at the hit point (local space), springs back in animate()
      const local = orb.wire.worldToLocal(found.hit.point.clone()).normalize();
      orb.dents.push({ dir: local, t0: clock.getElapsedTime() });
      if (orb.dents.length > 6) orb.dents.shift();
    }
  });
}

// ── Animation (transform mutation only; render happens in the main loop) ──

let spinAngle = 0;
let lastT = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!group) return;
  const t = clock.getElapsedTime();
  const dt = Math.min(t - lastT, 0.1); lastT = t;

  const focusOrb = (!dragging && settings.focus && focusOrbId) ? orbs.get(focusOrbId) : null;
  if (focusOrb) {
    // Ease toward camera-front, tracking the camera live as the user orbits it.
    // Target: orb.angle - spin = cameraAzimuth → spin = orb.angle - camAzimuth
    const target = focusOrb.angle - cameraAzimuth();
    const diff = ((target - spinAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(diff) > 0.0005) spinAngle += diff * Math.min(1, dt * 4);
  } else if (!dragging) {
    spinAngle += dt * settings.spin;
  }
  group.rotation.y = spinAngle;
  group.visible = settings.visible;

  for (const orb of orbs.values()) {
    const style = STATE_STYLE[orb.state] || STATE_STYLE.unknown;

    // Breathing / pulsing scale
    const s = (1 + Math.sin(t * style.breatheHz * Math.PI * 2 + orb.phase) * style.breatheAmt) * settings.scale;
    orb.holder.scale.setScalar(s);
    orb.label.visible = settings.labels;

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

    // Vertex deformation: running wobble + ThreeJS-Ball hover dents (spring back ~0.6s)
    orb.dents = orb.dents.filter(d => t - d.t0 < 0.6);
    const deforming = style.wobble > 0 || orb.dents.length > 0;
    if (deforming || orb.geoDirty) {
      for (const mesh of [orb.wire, orb.surface]) {
        const pos = mesh.geometry.attributes.position;
        const base = mesh.userData.basePositions;
        for (let i = 0; i < pos.count; i++) {
          const ix = i * 3;
          const nx = base[ix], ny = base[ix + 1], nz = base[ix + 2];
          let w = 1;
          if (style.wobble > 0) w += Math.sin(t * 6 + nx * 5 + ny * 7 + nz * 3) * style.wobble * 0.12;
          if (orb.dents.length) {
            const len = Math.hypot(nx, ny, nz) || 1;
            const vx = nx / len, vy = ny / len, vz = nz / len;
            for (const d of orb.dents) {
              const align = vx * d.dir.x + vy * d.dir.y + vz * d.dir.z; // 1 at dent center
              if (align > 0.6) {
                const decay = 1 - (t - d.t0) / 0.6;
                w -= Math.pow((align - 0.6) / 0.4, 2) * 0.22 * decay;
              }
            }
          }
          pos.array[ix] = nx * w; pos.array[ix + 1] = ny * w; pos.array[ix + 2] = nz * w;
        }
        pos.needsUpdate = true;
      }
      orb.geoDirty = deforming; // one restore pass after deformation ends
    }

    // Billboard labels are sprites — nothing to do; keep them upright vs ring spin
    orb.holder.rotation.y = -group.rotation.y;
  }

  // GITS text ring: slow continuous rotation (screen-space, like the anime HUD)
  if (textRingSprite) textRingSprite.material.rotation -= dt * 0.35;
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

// ── Phase 3: control setters (persisted) ──

function persist(key, val) { localStorage.setItem(key, String(val)); }

export function setFleetVisible(v) { settings.visible = !!v; persist('jurvus-fleet-visible', v ? '1' : '0'); }
export function setFleetLabels(v) { settings.labels = !!v; persist('jurvus-fleet-labels', v ? '1' : '0'); }
export function setFleetSpin(v) { settings.spin = v; persist('jurvus-fleet-spin', v); }
export function setFleetScale(v) { settings.scale = v; persist('jurvus-fleet-scale', v); }

export function setFleetRadius(v) {
  settings.radius = v;
  persist('jurvus-fleet-radius', v);
  for (const orb of orbs.values()) {
    orb.holder.position.set(Math.cos(orb.angle) * v, Math.sin(orb.angle * 2) * 0.35, Math.sin(orb.angle) * v);
  }
}

export function setFleetFocus(v) {
  settings.focus = !!v;
  persist('jurvus-fleet-focus', v ? '1' : '0');
  focusOrbId = v && selectedId ? selectedId : null;
}

export function getFleetSettings() { return { ...settings }; }
export function getSelectedAgent() { return selectedId; }
export function getFleetAgentIds() { return [...orbs.keys()]; }
