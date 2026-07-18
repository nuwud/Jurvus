// ── Jurvus Fleet Controls (Phase 3) ──
// FLEET tab in DATA CENTER: visibility/label toggles, spin/radius/size sliders,
// live agent menu (state dots, click-to-select), SFX volume/mute, cinema mode.

import {
  selectAgent, getSelectedAgent, getFleetSettings,
  setFleetVisible, setFleetLabels, setFleetSpin, setFleetRadius, setFleetScale,
  setFleetFocus,
} from './fleet.js';
import { setSfxVolume, getSfxVolume, setSfxMuted, isSfxMuted } from '../core/fleet-audio.js';
import { toggleVoiceMode, isVoiceActive } from './voice.js';
import { getControls } from '../core/scene.js';
import { showNotification } from './notifications.js';

const STATE_DOT = { idle: '#7fd97f', running: '#00e5ff', error: '#ff2244', unknown: '#555a66' };

let latestAgents = [];

// ── 💡 ADVISE: each agent proactively coaches Patrick on revenue next-steps ──

const AGENT_DOMAINS = {
  'main': 'overall coordination of the Nuwud agent fleet and business priorities',
  'nuwud-revenue': 'offers, pricing, sales pipeline, Stripe/Shopify revenue, GrubGoals and HMoonHydro monetization',
  'nuwud-dev': 'client development work, WatermelonOS, MIDBRO, Shopify apps, and productizable code assets',
  'nuwud-content': 'content marketing that converts — social posts, blog, case studies, email sequences',
  'nuwud-shopify': 'Shopify theme development, premium store builds, and app opportunities',
  'nuwud-ops': 'infrastructure cost efficiency, reliability, and automation that frees up billable time',
  'nuwud-3d': 'immersive Three.js/WebGL experiences and productizing 3D work like ThreeJS-Ball and Watermelon menus',
  'nuwud-patrick': "Patrick's personal brand, positioning as a Founder Systems Architect, and audience growth",
  'nuwud-free': 'low-cost experiments and lead-generation ideas',
};

function advisePrompt(agentId) {
  const domain = AGENT_DOMAINS[agentId] || 'your domain';
  return `ADVISOR MODE — Review your workspace notes and memory first. As the agent responsible for ${domain}, give Patrick Wood the top 3 highest-leverage actions he can take RIGHT NOW to move revenue forward for Nuwud Multimedia LLC. For each: the exact next step, estimated effort, and expected impact. Be concrete and specific to Nuwud — no generic advice. End with exactly one question for Patrick whose answer would most improve your next recommendation.`;
}

export async function adviseAgent(agentId) {
  await selectAgent(agentId); // routes chat + focuses the orb
  window.dispatchEvent(new CustomEvent('terminal-message', {
    detail: { message: `💡 Asking ${agentId.toUpperCase()} for revenue guidance...`, isCommand: true },
  }));
  try {
    await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: advisePrompt(agentId) }),
    });
  } catch (err) {
    console.error('[FLEET] advise failed:', err);
  }
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function sliderGroup(label, id, min, max, step, value) {
  return el(`
    <div class="control-group">
      <div class="control-row">
        <span class="control-label">${label}</span>
        <span class="control-value" id="${id}-value">${value}</span>
      </div>
      <div class="slider-container">
        <input type="range" min="${min}" max="${max}" value="${value}" step="${step}" class="slider" id="${id}-slider">
      </div>
    </div>`);
}

function toggleBtn(label, id, active) {
  return el(`<button class="btn fleet-toggle ${active ? 'active' : ''}" id="${id}">${label}</button>`);
}

// ── Agent menu ──

function renderAgentMenu(container) {
  container.innerHTML = '';
  const selected = getSelectedAgent();
  for (const a of latestAgents) {
    const row = el(`
      <div class="fleet-agent-row ${a.id === selected ? 'selected' : ''}" data-agent="${a.id}" title="model: ${a.model || 'default'} · jobs: ${a.jobs}">
        <span class="fleet-dot" style="background:${STATE_DOT[a.state] || STATE_DOT.unknown}; box-shadow: 0 0 6px ${STATE_DOT[a.state] || 'transparent'}"></span>
        <span class="fleet-agent-name">${a.id.replace(/^nuwud-/, '').toUpperCase()}</span>
        <span class="fleet-agent-state">${a.state.toUpperCase()}</span>
        <button class="fleet-advise-btn" title="Ask ${a.id} for revenue next-steps">💡</button>
      </div>`);
    row.addEventListener('click', () => selectAgent(a.id));
    row.querySelector('.fleet-advise-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      adviseAgent(a.id);
    });
    container.appendChild(row);
  }
}

// ── Audio panel injection: SFX + music playback controls where users expect them ──

function injectAudioPanelControls() {
  const host = document.querySelector('.spectrum-analyzer .audio-controls');
  if (!host || document.getElementById('sfx-inline-slider')) return;

  const block = el(`
    <div class="controls-row" style="flex-direction: column; gap: 8px; margin-top: 8px; border-top: 1px solid rgba(var(--accent-rgb), 0.2); padding-top: 8px;">
      <div class="audio-sensitivity" style="width:100%;">
        <div class="audio-sensitivity-label">
          <span>FLEET SFX</span>
          <span class="audio-sensitivity-value" id="sfx-inline-value">${isSfxMuted() ? 'MUTED' : getSfxVolume().toFixed(2)}</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="range" min="0" max="1" value="${getSfxVolume()}" step="0.05" class="slider" id="sfx-inline-slider" style="flex:1;">
          <button class="btn" id="sfx-inline-mute">${isSfxMuted() ? 'UNMUTE' : 'MUTE'}</button>
        </div>
      </div>
      <div class="audio-sensitivity" style="width:100%;">
        <div class="audio-sensitivity-label">
          <span>MUSIC VOLUME</span>
          <span class="audio-sensitivity-value" id="music-inline-value">1.00</span>
        </div>
        <input type="range" min="0" max="1" value="1" step="0.05" class="slider" id="music-inline-slider" style="width:100%;">
      </div>
      <div class="transport-row">
        <button class="transport-btn" id="tp-rw" title="Back 10s">⏪ 10</button>
        <button class="transport-btn" id="tp-play" title="Play / Pause">▶</button>
        <button class="transport-btn" id="tp-stop" title="Stop">⏹</button>
        <button class="transport-btn" id="tp-fw" title="Forward 10s">10 ⏩</button>
        <span class="transport-time" id="tp-time">0:00 / 0:00</span>
      </div>
      <input type="range" min="0" max="1000" value="0" step="1" class="slider" id="tp-scrub" style="width:100%;" title="Scrub">
    </div>`);
  host.appendChild(block);

  // ── Transport wiring ──
  // audio.js REPLACES the #audio-player element when a track loads, so we
  // resolve the live element at action time and rebind listeners on change.
  const getPlayer = () => document.getElementById('audio-player');
  const playBtn = block.querySelector('#tp-play');
  const scrub = block.querySelector('#tp-scrub');
  const timeEl = block.querySelector('#tp-time');
  const fmt = (s) => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
  let scrubbing = false;
  let boundPlayer = null;

  const onTime = () => {
    const p = boundPlayer;
    if (!p) return;
    timeEl.textContent = `${fmt(p.currentTime)} / ${fmt(p.duration)}`;
    if (!scrubbing && isFinite(p.duration) && p.duration > 0) {
      scrub.value = Math.round((p.currentTime / p.duration) * 1000);
    }
  };
  const onPlay = () => { playBtn.textContent = '⏸'; };
  const onPause = () => { playBtn.textContent = '▶'; };

  const bindPlayer = () => {
    const p = getPlayer();
    if (!p || p === boundPlayer) return;
    boundPlayer = p;
    p.addEventListener('timeupdate', onTime);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.volume = parseFloat(block.querySelector('#music-inline-slider').value);
    playBtn.textContent = p.paused ? '▶' : '⏸';
  };
  bindPlayer();
  setInterval(bindPlayer, 1500); // catch element replacement by audio.js

  playBtn.addEventListener('click', () => {
    const p = getPlayer(); if (!p) return;
    if (p.paused) p.play().catch(() => {});
    else p.pause();
  });
  block.querySelector('#tp-stop').addEventListener('click', () => {
    const p = getPlayer();
    if (p) { p.pause(); p.currentTime = 0; }
  });
  block.querySelector('#tp-rw').addEventListener('click', () => {
    const p = getPlayer();
    if (p) p.currentTime = Math.max(0, p.currentTime - 10);
  });
  block.querySelector('#tp-fw').addEventListener('click', () => {
    const p = getPlayer();
    if (p && isFinite(p.duration)) p.currentTime = Math.min(p.duration, p.currentTime + 10);
  });

  scrub.addEventListener('pointerdown', () => { scrubbing = true; });
  scrub.addEventListener('pointerup', () => { scrubbing = false; });
  scrub.addEventListener('input', function () {
    const p = getPlayer();
    if (p && isFinite(p.duration)) p.currentTime = (this.value / 1000) * p.duration;
  });

  const sfxSlider = block.querySelector('#sfx-inline-slider');
  const sfxValue = block.querySelector('#sfx-inline-value');
  const sfxMute = block.querySelector('#sfx-inline-mute');

  sfxSlider.addEventListener('input', function () {
    const v = parseFloat(this.value);
    setSfxVolume(v);
    if (isSfxMuted() && v > 0) { setSfxMuted(false); sfxMute.textContent = 'MUTE'; }
    sfxValue.textContent = v.toFixed(2);
  });
  sfxMute.addEventListener('click', () => {
    const m = !isSfxMuted();
    setSfxMuted(m);
    sfxMute.textContent = m ? 'UNMUTE' : 'MUTE';
    sfxValue.textContent = m ? 'MUTED' : getSfxVolume().toFixed(2);
  });

  block.querySelector('#music-inline-slider').addEventListener('input', function () {
    const v = parseFloat(this.value);
    const p = getPlayer();
    if (p) p.volume = v;
    block.querySelector('#music-inline-value').textContent = v.toFixed(2);
  });
}

// ── Cinema mode 🎥 ──

let cinema = false;
let savedAutoRotate = null;

export function setCinemaMode(on) {
  cinema = !!on;
  document.body.classList.toggle('cinema-mode', cinema);
  const controls = getControls?.();
  if (controls) {
    if (cinema) {
      savedAutoRotate = { auto: controls.autoRotate, speed: controls.autoRotateSpeed };
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
    } else if (savedAutoRotate) {
      controls.autoRotate = savedAutoRotate.auto;
      controls.autoRotateSpeed = savedAutoRotate.speed;
    }
  }
  if (cinema) showNotification('CINEMA MODE — press ESC to exit');
}

// ── Init ──

export function initFleetControls() {
  const tabBar = document.querySelector('.info-center .tab-bar');
  const panel = document.querySelector('.info-center');
  if (!tabBar || !panel) return;

  // Tab button (added after initTabs ran, so it wires its own switch handler)
  const btn = el(`<button class="tab-btn-r" data-rtab="fleet">FLEET</button>`);
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn-r').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.rtab-content').forEach((c) => c.classList.remove('active'));
    document.getElementById('rtab-fleet')?.classList.add('active');
  });
  tabBar.appendChild(btn);

  // Tab content
  const s = getFleetSettings();
  const content = el(`<div class="rtab-content" id="rtab-fleet"></div>`);

  // Toggles
  const toggles = el(`<div class="buttons" style="margin-bottom:10px;"></div>`);
  const visBtn = toggleBtn('RING', 'fleet-vis-btn', s.visible);
  const labBtn = toggleBtn('LABELS', 'fleet-lab-btn', s.labels);
  const focusBtn = toggleBtn('FOCUS', 'fleet-focus-btn', s.focus);
  const muteBtn = toggleBtn(isSfxMuted() ? 'SFX OFF' : 'SFX ON', 'fleet-mute-btn', !isSfxMuted());
  const cineBtn = toggleBtn('🎥 CINEMA', 'fleet-cine-btn', false);
  const voiceBtn = toggleBtn('🎙 VOICE', 'fleet-voice-btn', false);
  toggles.append(visBtn, labBtn, focusBtn, muteBtn, cineBtn, voiceBtn);
  content.appendChild(toggles);

  // Sliders
  const spin = sliderGroup('RING SPIN', 'fleet-spin', 0, 0.3, 0.01, s.spin);
  const radius = sliderGroup('RING RADIUS', 'fleet-radius', 3, 12, 0.1, s.radius);
  const scale = sliderGroup('ORB SIZE', 'fleet-scale', 0.4, 2.5, 0.1, s.scale);
  const sfxVol = sliderGroup('SFX VOLUME', 'fleet-sfx', 0, 1, 0.05, getSfxVolume());
  content.append(spin, radius, scale, sfxVol);

  // Agent menu
  content.appendChild(el(`<div class="control-row" style="margin-top:8px;"><span class="control-label">AGENTS — CLICK TO TALK · 💡 TO GET ADVICE</span></div>`));
  const menu = el(`<div id="fleet-agent-menu"></div>`);
  content.appendChild(menu);

  // Big advise button for the currently selected agent
  const adviseBig = el(`<button class="btn" id="fleet-advise-selected" style="width:100%; margin-top:8px;">💡 WHAT SHOULD I DO NEXT?</button>`);
  adviseBig.addEventListener('click', () => {
    const target = getSelectedAgent() || 'nuwud-revenue';
    adviseAgent(target);
  });
  content.appendChild(adviseBig);

  panel.appendChild(content);

  // SFX + music controls inside the ♪ AUDIO panel (discoverability)
  injectAudioPanelControls();

  // ── Wire events ──
  const bindSlider = (id, fmt, fn) => {
    const input = content.querySelector(`#${id}-slider`);
    const label = content.querySelector(`#${id}-value`);
    input?.addEventListener('input', function () {
      const v = parseFloat(this.value);
      label.textContent = fmt(v);
      fn(v);
    });
  };
  bindSlider('fleet-spin', v => v.toFixed(2), setFleetSpin);
  bindSlider('fleet-radius', v => v.toFixed(1), setFleetRadius);
  bindSlider('fleet-scale', v => v.toFixed(1), setFleetScale);
  bindSlider('fleet-sfx', v => v.toFixed(2), v => { setSfxVolume(v); if (v > 0 && isSfxMuted()) toggleMute(); });

  const setToggleState = (b, on) => b.classList.toggle('active', on);
  visBtn.addEventListener('click', () => { const on = !getFleetSettings().visible; setFleetVisible(on); setToggleState(visBtn, on); });
  labBtn.addEventListener('click', () => { const on = !getFleetSettings().labels; setFleetLabels(on); setToggleState(labBtn, on); });

  function toggleMute() {
    const nowMuted = !isSfxMuted();
    setSfxMuted(nowMuted);
    muteBtn.textContent = nowMuted ? 'SFX OFF' : 'SFX ON';
    setToggleState(muteBtn, !nowMuted);
  }
  muteBtn.addEventListener('click', toggleMute);

  focusBtn.addEventListener('click', () => { const on = !getFleetSettings().focus; setFleetFocus(on); setToggleState(focusBtn, on); });

  // 🎙 Hands-free voice loop: mic (VAD) → whisper → selected agent → TTS
  voiceBtn.addEventListener('click', async () => {
    try {
      await toggleVoiceMode();
      const on = isVoiceActive();
      setToggleState(voiceBtn, on);
      showNotification(on ? '🎙 VOICE MODE ON — just speak' : 'VOICE MODE OFF');
    } catch (err) {
      console.error('[VOICE] toggle failed:', err);
      showNotification('VOICE MODE FAILED — mic permission?');
    }
  });

  cineBtn.addEventListener('click', () => setCinemaMode(!cinema));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cinema) setCinemaMode(false); });

  // ⌨️ Arrow keys cycle through agents (Watermelon carousel navigation)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (!latestAgents.length) return;
    const ids = latestAgents.map(a => a.id);
    const cur = ids.indexOf(getSelectedAgent());
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = ids[((cur < 0 ? 0 : cur + dir) + ids.length) % ids.length];
    selectAgent(next);
  });

  // Live agent data
  window.addEventListener('jurvus-fleet-data', (e) => {
    latestAgents = e.detail.agents || [];
    renderAgentMenu(menu);
  });
  window.addEventListener('jurvus-agent-selected', () => renderAgentMenu(menu));

  console.log('[FLEET] controls ready');
}
