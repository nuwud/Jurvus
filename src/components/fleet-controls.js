// ── Jurvus Fleet Controls (Phase 3) ──
// FLEET tab in DATA CENTER: visibility/label toggles, spin/radius/size sliders,
// live agent menu (state dots, click-to-select), SFX volume/mute, cinema mode.

import {
  selectAgent, getSelectedAgent, getFleetSettings,
  setFleetVisible, setFleetLabels, setFleetSpin, setFleetRadius, setFleetScale,
} from './fleet.js';
import { setSfxVolume, getSfxVolume, setSfxMuted, isSfxMuted } from '../core/fleet-audio.js';
import { getControls } from '../core/scene.js';
import { showNotification } from './notifications.js';

const STATE_DOT = { idle: '#7fd97f', running: '#00e5ff', error: '#ff2244', unknown: '#555a66' };

let latestAgents = [];

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
      </div>`);
    row.addEventListener('click', () => selectAgent(a.id));
    container.appendChild(row);
  }
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
  const muteBtn = toggleBtn(isSfxMuted() ? 'SFX OFF' : 'SFX ON', 'fleet-mute-btn', !isSfxMuted());
  const cineBtn = toggleBtn('🎥 CINEMA', 'fleet-cine-btn', false);
  toggles.append(visBtn, labBtn, muteBtn, cineBtn);
  content.appendChild(toggles);

  // Sliders
  const spin = sliderGroup('RING SPIN', 'fleet-spin', 0, 0.3, 0.01, s.spin);
  const radius = sliderGroup('RING RADIUS', 'fleet-radius', 3, 12, 0.1, s.radius);
  const scale = sliderGroup('ORB SIZE', 'fleet-scale', 0.4, 2.5, 0.1, s.scale);
  const sfxVol = sliderGroup('SFX VOLUME', 'fleet-sfx', 0, 1, 0.05, getSfxVolume());
  content.append(spin, radius, scale, sfxVol);

  // Agent menu
  content.appendChild(el(`<div class="control-row" style="margin-top:8px;"><span class="control-label">AGENTS — CLICK TO TALK</span></div>`));
  const menu = el(`<div id="fleet-agent-menu"></div>`);
  content.appendChild(menu);

  panel.appendChild(content);

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

  cineBtn.addEventListener('click', () => setCinemaMode(!cinema));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cinema) setCinemaMode(false); });

  // Live agent data
  window.addEventListener('jurvus-fleet-data', (e) => {
    latestAgents = e.detail.agents || [];
    renderAgentMenu(menu);
  });
  window.addEventListener('jurvus-agent-selected', () => renderAgentMenu(menu));

  console.log('[FLEET] controls ready');
}
