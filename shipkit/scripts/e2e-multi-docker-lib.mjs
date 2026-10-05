import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/** pre-run preparation (S05): make sure the build base exists so a legit
 * pull is never counted as residue, then snapshot images (repo:tag) and
 * dangling ids — the post-cleanup delta proves zero NEW residue */
export async function prepareRunBasics(run, baseImage) {
  await run(`docker image inspect ${baseImage}`).catch(() => run(`docker pull ${baseImage}`).catch(() => {}));
  const lines = async (cmd) => {
    try {
      const { stdout } = await run(cmd);
      return String(stdout).split('\n').map((l) => l.trim()).filter(Boolean);
    } catch {
      return [];
    }
  };
  const beforeImages = await lines("docker images --format '{{.Repository}}:{{.Tag}}'");
  if (!beforeImages.length) console.error('  WARN pre-run image snapshot came back empty — residue verification may false-positive');
  return { beforeImages, beforeDangling: await lines("docker images --filter dangling=true --format '{{.ID}}'") };
}

/** tracks every resource this run creates, by exact identity; the image
 * snapshot taken at start proves "zero NEW residue" without ever touching
 * pre-existing or shared images */
export function resourceTracker(group, beforeImages, beforeDangling = []) {
  const networks = new Set();   // docker networks we created (exact names)
  const volumes = new Set();    // docker volumes we created (exact names)
  const imageTags = new Set();  // image repo:tag refs this run BUILT
  const projects = [`ship_${group}_api`, `ship_${group}_web`];
  return {
    networks, volumes, imageTags, projects, beforeImages, beforeDangling,
    addNetwork(n) { networks.add(n); },
    addVolume(v) { volumes.add(v); },
    addImage(tag) { imageTags.add(tag); },
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

/** cleanup via the compiled, unit-tested verifier (S05): exact identities
 * only; failed Docker queries and rmi conflicts FAIL; the before/after image
 * snapshot proves zero NEW residue while pre-existing images stay untouched */
export async function cleanupAndVerify(tracker, keep, extraDirs = []) {
  if (keep) {
    console.log(`keep mode: containers=${tracker.projects.join(',')} networks=${[...tracker.networks].join(',')} volumes=${[...tracker.volumes].join(',')} images=${[...tracker.imageTags].join(',')} dirs=${extraDirs.join(',')}`);
    return;
  }
  const { cleanupAndVerify: verify, snapshotImages } = await import(`${ROOT}/dist/cli/test-support/cleanup-verifier.js`);
  const runFn = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err && err.code === undefined) reject(err);
      else resolve({ code: err ? err.code ?? 1 : 0, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });
  const report = await verify(runFn, {
    projects: tracker.projects,
    networks: [...tracker.networks],
    volumes: [...tracker.volumes],
    imageTags: [...tracker.imageTags],
    beforeImages: tracker.beforeImages ?? [],
    beforeDangling: tracker.beforeDangling ?? [],
  });
  for (const d of extraDirs) await rm(d, { recursive: true, force: true }).catch((e) => report.problems.push(`rm ${d}: ${e.message}`));
  if (report.problems.length) {
    FAIL(`cleanup residue (${report.problems.length}): ${report.problems.join(' | ')}`);
  } else {
    const after = await snapshotImages(runFn);
    OK(`cleanup verified: zero new residue (removed ${report.removed.containers} containers, ${report.removed.networks} networks, ${report.removed.volumes} volumes, ${report.removed.images} images; ${after?.length ?? '?'} pre-existing images untouched)`);
  }
}
