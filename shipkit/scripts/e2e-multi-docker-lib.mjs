// Shared helpers for the isolated real-Docker multi-service e2e (R12):
// precise resource tracking (this run's exact identities only), verified
// cleanup with a zero-residue check, agent/CLI spawning, health polling.
// Nothing here deletes by broad name prefixes.

import { exec, spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';

export const run = promisify(exec);
export const OK = (m) => console.log(`  ok  ${m}`);
export const FAIL = (m) => { console.error(`  FAIL ${m}`); process.exitCode = 1; };

export async function must(cmd, what) {
  try {
    return await run(cmd, { timeout: 300_000 });
  } catch (e) {
    FAIL(`${what}: ${String(e.stderr ?? e.message).slice(0, 400)}`);
    throw e;
  }
}

/** tracks every resource this run creates, by exact identity */
export function resourceTracker(group) {
  const networks = new Set();   // docker networks we created (exact names)
  const volumes = new Set();    // docker volumes we created (exact names)
  const images = new Set();     // image IDs this run built (exact digests)
  const projects = [`ship_${group}_api`, `ship_${group}_web`];
  return {
    networks, volumes, images, projects,
    addNetwork(n) { networks.add(n); },
    addVolume(v) { volumes.add(v); },
    addImage(id) { images.add(id); },
  };
}

export async function api(agentUrl, method, p, body) {
  const res = await fetch(`${agentUrl}${p}`, {
    method,
    headers: { authorization: 'Bearer t', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export async function waitJob(agentUrl, jobId, what) {
  for (let i = 0; i < 240; i++) {
    const job = await api(agentUrl, 'GET', `/api/jobs/${jobId}`);
    if (job.status === 'succeeded') return job.result;
    if (job.status === 'failed') throw new Error(`${what} failed: ${job.error}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} timed out`);
}

export async function healthy(port, needle, label) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok && needle.test(await res.text())) { OK(`GET :${port}/${label ?? ''} matches ${needle}`); return true; }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  FAIL(`healthcheck failed for port ${port} (wanted ${needle})`);
  return false;
}

export async function containerSnapshot(group) {
  const out = (await run(`docker ps -a --filter label=com.docker.compose.project --format '{{.ID}}\\t{{.Names}}'`)).stdout;
  const snap = {};
  for (const line of out.split('\n').filter(Boolean)) {
    const [id, name] = line.split('\t');
    const svc = new RegExp(`^ship_${group}_api-api-\\d+$|^ship_${group}_api_api_\\d+$`).test(name) ? 'api'
      : new RegExp(`^ship_${group}_web-web-\\d+$|^ship_${group}_web_web_\\d+$`).test(name) ? 'web' : null;
    if (!svc) continue;
    snap[svc] = { id, started: (await run(`docker inspect --format '{{.State.StartedAt}}' ${id}`)).stdout.trim() };
  }
  return snap;
}

export function spawnShip(ROOT, home, cwd) {
  return (args) => new Promise((resolve) => {
    const p = spawn('node', [`${ROOT}/dist/cli/main.js`, ...args], { env: { ...process.env, HOME: home }, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (d) => { stdout += d; });
    p.stderr.on('data', (d) => { stderr += d; });
    p.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

export async function startAgent(ROOT, workRoot) {
  const agent = spawn('node', [`${ROOT}/dist/agent/server.js`], {
    env: { ...process.env, SHIP_AGENT_ROLE: 'both', SHIP_AGENT_TOKEN: 't', SHIP_WORK_ROOT: workRoot, SHIP_AGENT_HOST: '127.0.0.1', SHIP_AGENT_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const url = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('agent startup line never appeared')), 20_000);
    const onData = (d) => {
      buf += d;
      const m = /listening on (\S+)/.exec(buf);
      if (m) { clearTimeout(timer); resolve(m[1].startsWith('http') ? m[1] : `http://${m[1]}`); }
    };
    agent.stdout.on('data', onData);
    agent.stderr.on('data', onData);
  });
  return { agent, url };
}

/** cleanup by THIS run's exact identities, then verify zero residue — a
 * non-zero exit from any step fails the e2e instead of being assumed away */
export async function cleanupAndVerify(tracker, keep, extraDirs = []) {
  if (keep) {
    console.log(`keep mode: containers=${tracker.projects.join(',')} networks=${[...tracker.networks].join(',')} volumes=${[...tracker.volumes].join(',')} dirs=${extraDirs.join(',')}`);
    return;
  }
  const problems = [];
  // containers: exact project labels (compose labels every container it made)
  for (const project of tracker.projects) {
    const { stdout } = await run(`docker ps -aq --filter label=com.docker.compose.project=${project}`).catch(() => ({ stdout: '' }));
    for (const id of stdout.trim().split('\n').filter(Boolean)) {
      const r = await run(`docker rm -f ${id}`).catch((e) => ({ failed: e }));
      if (r.failed) problems.push(`cannot remove container ${id}: ${String(r.failed.message).slice(0, 120)}`);
    }
  }
  // compose project networks (default networks carry the project label); our
  // own external networks/volumes by EXACT name
  const netIds = new Set();
  for (const project of tracker.projects) {
    const { stdout } = await run(`docker network ls --filter label=com.docker.compose.project=${project} --format '{{.Name}}'`).catch(() => ({ stdout: '' }));
    for (const n of stdout.trim().split('\n').filter(Boolean)) netIds.add(n);
  }
  for (const n of [...netIds, ...tracker.networks]) {
    const r = await run(`docker network rm ${n}`).catch((e) => ({ failed: e }));
    if (r?.failed && !/not found/i.test(String(r.failed.message))) problems.push(`network ${n}: ${String(r.failed.message).slice(0, 120)}`);
  }
  for (const v of tracker.volumes) {
    const r = await run(`docker volume rm ${v}`).catch((e) => ({ failed: e }));
    if (r?.failed && !/not found|in use/i.test(String(r.failed.message))) problems.push(`volume ${v}: ${String(r.failed.message).slice(0, 120)}`);
  }
  for (const img of tracker.images) {
    const r = await run(`docker rmi ${img}`).catch((e) => ({ failed: e }));
    if (r?.failed && !/no such image|conflict/i.test(String(r.failed.message))) problems.push(`image ${img}: ${String(r.failed.message).slice(0, 120)}`);
  }
  for (const d of extraDirs) await rm(d, { recursive: true, force: true }).catch((e) => problems.push(`rm ${d}: ${e.message}`));

  // residue verification: re-query by exact labels/names; anything left fails
  for (const project of tracker.projects) {
    const { stdout } = await run(`docker ps -aq --filter label=com.docker.compose.project=${project}`).catch(() => ({ stdout: '' }));
    if (stdout.trim()) problems.push(`residue containers for ${project}: ${stdout.trim()}`);
    const nets = await run(`docker network ls --filter label=com.docker.compose.project=${project} --format '{{.Name}}'`).catch(() => ({ stdout: '' }));
    if (nets.stdout.trim()) problems.push(`residue networks for ${project}: ${nets.stdout.trim()}`);
  }
  for (const n of tracker.networks) {
    const { stdout } = await run(`docker network ls --format '{{.Name}}'`).catch(() => ({ stdout: '' }));
    if (stdout.split('\n').includes(n)) problems.push(`residue network ${n}`);
  }
  for (const v of tracker.volumes) {
    const { stdout } = await run(`docker volume ls --format '{{.Name}}'`).catch(() => ({ stdout: '' }));
    if (stdout.split('\n').includes(v)) problems.push(`residue volume ${v}`);
  }
  if (tracker.images.size) {
    const { stdout } = await run(`docker images --format '{{.ID}}'`).catch(() => ({ stdout: '' }));
    const present = new Set(stdout.split('\n').filter(Boolean));
    for (const img of tracker.images) {
      if (present.has(img.replace('sha256:', ''))) problems.push(`residue image ${img}`);
    }
  }
  if (problems.length) {
    FAIL(`cleanup residue (${problems.length}): ${problems.join(' | ')}`);
  } else {
    OK(`cleanup verified: zero containers/networks/volumes/images left from this run (${tracker.images.size} images removed)`);
  }
}
