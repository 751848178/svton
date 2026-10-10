import assert from 'node:assert/strict';
import test from 'node:test';
import { readAgentRegistrationBody } from './agent-registration-body';
import { agentRegistrationGateway } from './agent-registration-gateway';
import { agentGatewayFixture, agentGatewayUpstream } from './agent-registration-base.fixture';

test('stream byte budget and JSON/UTF8 validation precede the upstream request', async () => {
  const h = await agentGatewayFixture(); let calls = 0;
  const upstream = await agentGatewayUpstream((_request, response) => { calls++; response.end('{}'); });
  try {
    const settings = h.settings({ SHIPKIT_API_PORT: String(upstream.port) });
    for (const body of ['x', 'null', '[]', '{', new Uint8Array([0xff]), ' '.repeat(8193)]) {
      const response = await agentRegistrationGateway(h.request({ body }), 'session', settings);
      assert.equal(response.status, typeof body === 'string' && body.length > 8192 ? 413 : 400);
    }
    assert.equal(calls, 0);
  } finally { await upstream.close(); await h.close(); }
});

test('admitted request rebuilds only fixed loopback headers and does not expose either proof', async () => {
  const h = await agentGatewayFixture(); let seen: { path?: string; host?: string; headerNames: string[]; bytes: number } | undefined;
  const upstream = await agentGatewayUpstream((request, response) => {
    const chunks: Buffer[] = []; request.on('data', chunk => chunks.push(chunk)); request.on('end', () => {
      assert(request.headers['x-shipkit-agent-ingress'] === h.api);
      assert(request.headers.authorization === `Bearer ${h.machine}`);
      assert.equal(request.headers['x-forwarded-host'], 'shipkit.fixture');
      assert.equal(request.headers['x-forwarded-proto'], 'https'); assert.equal(request.headers['x-forwarded-port'], '443');
      seen = { path: request.url, host: request.headers.host, headerNames: Object.keys(request.headers), bytes: Buffer.concat(chunks).length };
      response.writeHead(201, { 'content-type': 'application/json' }); response.end('{"v":1,"epoch":1}');
    });
  });
  try {
    const response = await agentRegistrationGateway(h.request({ headers: { ...h.headers, 'x-client-noise': 'discard' } }), 'session',
      h.settings({ SHIPKIT_API_PORT: String(upstream.port) }));
    assert.equal(response.status, 201); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { v: 1, epoch: 1 });
    assert.equal(seen!.path, '/api/agent-registration/session'); assert.equal(seen!.host, `127.0.0.1:${upstream.port}`);
    assert.equal(seen!.bytes, 2);
    for (const name of ['cookie', 'x-shipkit-agent-edge', 'x-client-noise', 'x-forwarded-for', 'x-shipkit-local']) assert(!seen!.headerNames.includes(name));
  } finally { await upstream.close(); await h.close(); }
});

test('controlled status/code survives without upstream diagnostics, and redirect is never followed', async () => {
  const h = await agentGatewayFixture(); let calls = 0, status = 409;
  const upstream = await agentGatewayUpstream((_request, response) => {
    calls++; response.writeHead(status, { 'content-type': 'application/json', ...(status === 302 ? { location: '/other' } : {}) });
    response.end(JSON.stringify({ code: 'AGENT_SESSION_EXPIRED', message: h.machine, private: h.api }));
  });
  try {
    const settings = h.settings({ SHIPKIT_API_PORT: String(upstream.port) });
    const rejected = await agentRegistrationGateway(h.request(), 'session', settings);
    assert.equal(rejected.status, 409); const body = await rejected.text();
    assert(body.includes('AGENT_SESSION_EXPIRED')); assert(!body.includes(h.machine)); assert(!body.includes(h.api));
    status = 302;
    const redirected = await agentRegistrationGateway(h.request(), 'session', settings);
    assert.equal(redirected.status, 502); assert.equal(calls, 2);
  } finally { await upstream.close(); await h.close(); }
});

test('oversize actual upstream JSON, non-JSON and response cookies fail closed', async () => {
  const h = await agentGatewayFixture(); let variant = 0;
  const upstream = await agentGatewayUpstream((_request, response) => {
    response.writeHead(200, { 'content-type': variant === 1 ? 'text/plain' : 'application/json', ...(variant === 2 ? { 'set-cookie': 'unsafe=1' } : {}) });
    response.end(variant === 0 ? JSON.stringify({ value: 'x'.repeat(16384) }) : '{}');
  });
  try {
    const settings = h.settings({ SHIPKIT_API_PORT: String(upstream.port) });
    for (variant = 0; variant < 3; variant++) assert.equal((await agentRegistrationGateway(h.request(), 'session', settings)).status, 502);
  } finally { await upstream.close(); await h.close(); }
});

test('one deadline includes stalled request-body reading and cancels its reader', { timeout: 8000 }, async () => {
  const h = await agentGatewayFixture(); let cancelled = false;
  try {
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const request = h.request({ body: stream, duplex: 'half' } as RequestInit);
    const started = Date.now(), response = await agentRegistrationGateway(request, 'session', h.settings());
    assert.equal(response.status, 504); assert(cancelled); assert(Date.now() - started < 6500);
  } finally { await h.close(); }
});

test('client abort cancels a pending loopback request, with no late success', { timeout: 3000 }, async () => {
  const h = await agentGatewayFixture(); let closed = false;
  const upstream = await agentGatewayUpstream((_request, response) => { response.on('close', () => { closed = true; }); });
  try {
    const controller = new AbortController();
    const result = agentRegistrationGateway(h.request({ signal: controller.signal }), 'session', h.settings({ SHIPKIT_API_PORT: String(upstream.port) }));
    setTimeout(() => controller.abort(), 100);
    assert.equal((await result).status, 408);
    await new Promise(resolve => setTimeout(resolve, 50)); assert(closed);
    const already = new AbortController(); already.abort();
    await assert.rejects(readAgentRegistrationBody(h.request(), already.signal));
  } finally { await upstream.close(); await h.close(); }
});

test('the same deadline also bounds stalled upstream response headers', { timeout: 8000 }, async () => {
  const h = await agentGatewayFixture(); let closed = false;
  const upstream = await agentGatewayUpstream((_request, response) => { response.on('close', () => { closed = true; }); });
  try {
    const started = Date.now();
    const response = await agentRegistrationGateway(h.request(), 'session', h.settings({ SHIPKIT_API_PORT: String(upstream.port) }));
    assert.equal(response.status, 504); assert(Date.now() - started < 6500);
    await new Promise(resolve => setTimeout(resolve, 50)); assert(closed);
  } finally { await upstream.close(); await h.close(); }
});
