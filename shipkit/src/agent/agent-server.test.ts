import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startAgent } from './server.js';

const TOKEN = 'test-token';
const AUTH = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

async function startTestAgent(role = 'both') {
  const workRoot = await mkdtemp(path.join(tmpdir(), 'ship-agent-'));
  return startAgent({ role, token: TOKEN, port: 0, host: '127.0.0.1', workRoot });
}

test('/health is open and reports role', async () => {
  const agent = await startTestAgent();
  try {
    const res = await fetch(`${agent.url}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { role: string };
    assert.equal(body.role, 'both');
  } finally {
    await agent.close();
  }
});

test('api endpoints require a valid bearer token', async () => {
  const agent = await startTestAgent();
  try {
    assert.equal((await fetch(`${agent.url}/api/status`)).status, 401);
    assert.equal((await fetch(`${agent.url}/api/status`, { headers: { authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(`${agent.url}/api/status`, { headers: AUTH })).status, 200);
  } finally {
    await agent.close();
  }
});

test('role gating: runtime agent refuses builder endpoints', async () => {
  const agent = await startTestAgent('runtime');
  try {
    const res = await fetch(`${agent.url}/api/build`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ source: { type: 'git', repo: 'http://x.git' }, spec: { name: 'a' } }),
    });
    assert.equal(res.status, 403);
  } finally {
    await agent.close();
  }
});

test('invalid spec yields 400 invalid_spec', async () => {
  const agent = await startTestAgent();
  try {
    const res = await fetch(`${agent.url}/api/build`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ source: { type: 'git', repo: 'http://x.git' }, spec: { name: 'BAD NAME' } }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'invalid_spec');
  } finally {
    await agent.close();
  }
});

test('valid build request returns 202 + jobId (job fails async on unreachable repo; also tolerates missing docker)', async () => {
  const agent = await startTestAgent();
  try {
    const res = await fetch(`${agent.url}/api/build`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ source: { type: 'git', repo: 'http://127.0.0.1:9/x.git' }, spec: { name: 'demo' } }),
    });
    const body = (await res.json()) as { jobId?: string; error?: { code: string } };
    if (res.status === 503) {
      assert.equal(body.error?.code, 'docker_unavailable');
      return;
    }
    assert.equal(res.status, 202);
    assert.match(body.jobId ?? '', /^[0-9a-f-]{36}$/);
    const jres = await fetch(`${agent.url}/api/jobs/${body.jobId}`, { headers: AUTH });
    assert.equal(jres.status, 200);
  } finally {
    await agent.close();
  }
});

test('unknown routes are 404', async () => {
  const agent = await startTestAgent();
  try {
    assert.equal((await fetch(`${agent.url}/api/nope`, { headers: AUTH })).status, 404);
  } finally {
    await agent.close();
  }
});

test('RA10: gc preview is synchronous, execute is a persistent job', async () => {
  const agent = await startTestAgent();
  try {
    const prev = await fetch(`${agent.url}/api/gc`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(prev.status, 200);
    const plan = (await prev.json()) as { mode: string; candidates: unknown[]; protectedRefs: string[] };
    assert.equal(plan.mode, 'preview');
    assert.deepEqual(plan.candidates, []);
    const exec = await fetch(`${agent.url}/api/gc`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ dryRun: false }),
    });
    assert.equal(exec.status, 202);
    const { jobId } = (await exec.json()) as { jobId: string };
    const job = await fetch(`${agent.url}/api/jobs/${jobId}`, { headers: AUTH });
    assert.equal(job.status, 200);
    // empty ledger → job finishes with zero candidates, no docker mutation
    let status = 'queued';
    for (let i = 0; i < 20 && status !== 'succeeded' && status !== 'failed'; i++) {
      const j = (await (await fetch(`${agent.url}/api/jobs/${jobId}`, { headers: AUTH })).json()) as { status: string };
      status = j.status;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal(status, 'succeeded');
  } finally {
    await agent.close();
  }
});
