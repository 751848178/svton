import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestRegistration } from './request.js';
import { REGISTRATION_RESPONSE_BYTES } from './request-contracts.js';
import { createTlsFixture, enrollment, json, ENROLL_RECEIPT, ENROLL_SECRET, MACHINE_SECRET } from './request-fixture.js';

test('deadline spans a continuously streaming response and delayed first response', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  const streaming = await fixture.server((_req, res) => {
    res.writeHead(201, { 'content-type': 'application/json' }); res.write(' ');
    const interval = setInterval(() => res.write(' '), 10); res.once('close', () => clearInterval(interval));
  });
  const stalled = await fixture.server((_req, res) => {
    const timer = setTimeout(() => json(res, ENROLL_RECEIPT), 500); res.once('close', () => clearTimeout(timer));
  });
  for (const origin of [streaming, stalled]) {
    const start = performance.now();
    await assert.rejects(requestRegistration({ ...enrollment(origin, fixture.caFile), deadlineMs: 100 }), { code: 'REGISTRATION_REQUEST_TIMEOUT' });
    assert.ok(performance.now() - start < 450);
  }
});
test('response budget rejects a real TLS chunked body', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  const origin = await fixture.server((_req, res) => { res.writeHead(201, { 'content-type': 'application/json' }); res.end(' '.repeat(REGISTRATION_RESPONSE_BYTES + 1)); });
  await assert.rejects(requestRegistration(enrollment(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_LIMIT', statusCode: 201 });
});
test('abort before connection and during streaming stays aborted without late success', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close()); let requests = 0;
  const origin = await fixture.server((_req, res) => {
    requests++; res.writeHead(201, { 'content-type': 'application/json' }); res.write(' ');
    const timer = setTimeout(() => res.end(JSON.stringify(ENROLL_RECEIPT)), 200); res.once('close', () => clearTimeout(timer));
  });
  const before = new AbortController(); before.abort(new Error(ENROLL_SECRET));
  await assert.rejects(requestRegistration({ ...enrollment(origin, fixture.caFile), signal: before.signal }), { code: 'REGISTRATION_REQUEST_ABORTED' });
  assert.equal(requests, 0);
  const during = new AbortController(); const pending = requestRegistration({ ...enrollment(origin, fixture.caFile), signal: during.signal });
  const timer = setTimeout(() => during.abort(new Error(MACHINE_SECRET)), 70);
  await assert.rejects(pending, error => {
    assert.equal((error as { code: string }).code, 'REGISTRATION_REQUEST_ABORTED');
    assert.equal(String(error).includes(MACHINE_SECRET), false); return true;
  });
  clearTimeout(timer); assert.equal(requests, 1);
});
test('deadline and abort also bound the TLS handshake before an HTTP response', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  const origin = await fixture.stalledHandshake();
  await assert.rejects(requestRegistration({ ...enrollment(origin, fixture.caFile), deadlineMs: 100 }), { code: 'REGISTRATION_REQUEST_TIMEOUT' });
  const controller = new AbortController();
  const pending = requestRegistration({ ...enrollment(origin, fixture.caFile), signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 70);
  await assert.rejects(pending, { code: 'REGISTRATION_REQUEST_ABORTED' }); clearTimeout(timer);
});
test('response headers are bounded independently of the JSON body', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  const origin = await fixture.server((_req, res) => {
    res.setHeader('x-hostile-header', 'x'.repeat(4_097)); json(res, ENROLL_RECEIPT);
  });
  await assert.rejects(requestRegistration(enrollment(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_LIMIT' });
});
