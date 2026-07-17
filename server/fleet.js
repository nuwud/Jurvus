// ── Jurvus Fleet Telemetry (Phase 2) ──
// Polls the OpenClaw gateway + host for per-agent state and GPU stats,
// broadcasts over SSE as { type: 'fleet', agents, gpu, cron, ts }.

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gwRequest } from './gateway.js';
import { broadcastFleet } from './sse.js';

const OC_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const POLL_MS = 5000;

let latest = { ts: 0, agents: [], cron: [], gpu: null, collectors: {} };
let cronRpcBroken = false; // fall back to CLI exec if the RPC method is unavailable

export function getFleetSnapshot() { return latest; }

function execP(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function stripBom(s) {
  return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

// ── Collectors ──

async function readAgentRoster() {
  const raw = JSON.parse(stripBom(await readFile(OC_CONFIG, 'utf8')));
  const list = raw?.agents?.list || [];
  return list.map(a => ({
    id: a.id,
    model: a.model?.primary || null,
    ui: a.ui || null,
  }));
}

async function readCronJobs() {
  if (!cronRpcBroken) {
    try {
      const res = await gwRequest('cron.list', {});
      const jobs = res?.jobs || res || [];
      if (Array.isArray(jobs)) return jobs;
      cronRpcBroken = true;
    } catch (err) {
      if (/unknown method|invalid method|not found/i.test(err?.message || '')) cronRpcBroken = true;
      else throw err;
    }
  }
  // CLI fallback
  const out = await execP('openclaw', ['cron', 'list', '--json'], 30000).catch(async () => {
    // Windows: openclaw may resolve via .ps1/.cmd shim — retry through cmd
    return execP('cmd', ['/c', 'openclaw cron list --json'], 30000);
  });
  const parsed = JSON.parse(stripBom(out.trim()));
  return parsed?.jobs || parsed || [];
}

async function readGpu() {
  const out = await execP('nvidia-smi', [
    '--query-gpu=name,memory.used,memory.total,utilization.gpu',
    '--format=csv,noheader,nounits',
  ], 10000);
  const [name, used, total, util] = out.trim().split('\n')[0].split(',').map(s => s.trim());
  return { name, usedMiB: Number(used), totalMiB: Number(total), utilPct: Number(util) };
}

// ── State derivation (per SPEC §2.2) ──

function deriveAgents(roster, cronJobs) {
  const byAgent = new Map();
  for (const job of cronJobs) {
    const agentId = job.agentId || job.agent || null;
    if (!agentId) continue;
    if (!byAgent.has(agentId)) byAgent.set(agentId, []);
    byAgent.get(agentId).push(job);
  }

  return roster.map(a => {
    const jobs = byAgent.get(a.id) || [];
    let state = 'unknown';
    let lastStatus = null;
    let lastRunTs = 0;
    let nextRunTs = null;

    if (jobs.length) {
      const statuses = jobs.map(j => (j.state?.lastStatus || j.lastStatus || j.status || '').toLowerCase());
      let newest = null;
      for (const j of jobs) {
        const ts = j.state?.lastRunAtMs || j.lastRunAtMs || 0;
        if (ts > (newest?.ts || 0)) newest = { ts, status: (j.state?.lastStatus || j.lastStatus || j.status || '').toLowerCase() };
        const next = j.state?.nextRunAtMs || j.nextRunAtMs || null;
        if (next && (!nextRunTs || next < nextRunTs)) nextRunTs = next;
      }
      lastRunTs = newest?.ts || 0;
      lastStatus = newest?.status || null;
      if (statuses.includes('running')) state = 'running';
      else if (newest?.status === 'error') state = 'error';
      else state = 'idle';
    }

    return { id: a.id, model: a.model, ui: a.ui, state, lastStatus, lastRunTs, nextRunTs, jobs: jobs.length };
  });
}

// ── Poll loop ──

async function poll() {
  const collectors = {};
  let roster = [];
  let cronJobs = [];
  let gpu = latest.gpu;

  try { roster = await readAgentRoster(); collectors.roster = 'ok'; }
  catch (e) { collectors.roster = 'stale'; roster = latest._roster || []; }

  try { cronJobs = await readCronJobs(); collectors.cron = 'ok'; }
  catch (e) { collectors.cron = 'stale'; cronJobs = latest._cron || []; }

  try { gpu = await readGpu(); collectors.gpu = 'ok'; }
  catch (e) { collectors.gpu = 'stale'; }

  const agents = deriveAgents(roster, cronJobs);
  const cron = cronJobs.map(j => ({
    id: j.id,
    name: j.name,
    agentId: j.agentId || j.agent || null,
    schedule: j.scheduleText || j.schedule || null,
    nextRunTs: j.state?.nextRunAtMs || j.nextRunAtMs || null,
    lastStatus: (j.state?.lastStatus || j.lastStatus || j.status || null),
  }));

  latest = { ts: Date.now(), agents, cron, gpu, collectors, _roster: roster, _cron: cronJobs };
  const { _roster, _cron, ...pub } = latest;
  broadcastFleet(pub);
}

export function startFleetMonitor() {
  // First poll is delayed so the gateway handshake can finish
  setTimeout(() => {
    poll().catch(() => {});
    setInterval(() => poll().catch(() => {}), POLL_MS);
  }, 4000);
  console.log('[FLEET] monitor started (poll every', POLL_MS / 1000, 's)');
}
