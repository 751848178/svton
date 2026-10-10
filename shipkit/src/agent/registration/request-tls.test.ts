import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestRegistration } from './request.js';
import { RegistrationRequestError } from './request-errors.js';
import { createTlsFixture, enrollment, session, heartbeat, json, ENROLL_RECEIPT,
  SESSION_RECEIPT, HEARTBEAT_RECEIPT, ENROLL_SECRET, MACHINE_SECRET } from './request-fixture.js';

test('real TLS accepts pinned CA and only fixed authenticated POST paths', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  const seen: string[] = [];
  const origin = await fixture.server((req, res) => {
    assert.equal(req.method, 'POST'); assert.equal(req.headers.cookie, undefined);
    for (const header of ['forwarded', 'x-forwarded-for', 'x-forwarded-proto', 'x-shipkit-ingress-proof']) assert.equal(req.headers[header], undefined);
    const phase = req.url?.split('/').at(-1); seen.push(req.url!);
    assert.equal(req.headers.authorization, `Bearer ${phase === 'enroll' ? ENROLL_SECRET : MACHINE_SECRET}`);
    json(res, phase === 'enroll' ? ENROLL_RECEIPT : phase === 'session' ? SESSION_RECEIPT : HEARTBEAT_RECEIPT);
  });
  const oldProxy = process.env.HTTPS_PROXY; process.env.HTTPS_PROXY = 'http://127.0.0.1:1';
  t.after(() => { if (oldProxy === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = oldProxy; });
  assert.deepEqual(await requestRegistration(enrollment(origin, fixture.caFile)), ENROLL_RECEIPT);
  assert.deepEqual(await requestRegistration(session(origin, fixture.caFile)), SESSION_RECEIPT);
  assert.deepEqual(await requestRegistration(heartbeat(origin, fixture.caFile)), HEARTBEAT_RECEIPT);
  assert.deepEqual(seen, ['/api/agent-registration/enroll', '/api/agent-registration/session', '/api/agent-registration/heartbeat']);
});
test('real TLS rejects wrong CA, untrusted system roots and hostname mismatch without unsafe error detail', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  let received = 0;
  const handler = (_req: unknown, res: Parameters<typeof json>[0]) => { received++; json(res, ENROLL_RECEIPT); };
  const origin = await fixture.server(handler), wrongHostname = await fixture.server(handler, true);
  for (const options of [enrollment(origin, fixture.wrongCaFile), enrollment(origin), enrollment(wrongHostname, fixture.caFile)]) {
    await assert.rejects(requestRegistration(options), error => {
      assert.ok(error instanceof RegistrationRequestError); assert.equal(error.code, 'REGISTRATION_TLS_FAILED');
      assert.equal(error.message, error.code); assert.equal('cause' in error, false);
      assert.equal(JSON.stringify(error).includes(ENROLL_SECRET), false); return true;
    });
  }
  assert.equal(received, 0);
});
test('redirect is rejected and bearer never reaches its destination', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close()); let destinationHits = 0;
  const destination = await fixture.server((_req, res) => { destinationHits++; json(res, ENROLL_RECEIPT); });
  const origin = await fixture.server((_req, res) => { res.writeHead(307, { location: `${destination}/capture` }); res.end(); });
  await assert.rejects(requestRegistration(enrollment(origin, fixture.caFile)), { code: 'REGISTRATION_REDIRECT_REJECTED', statusCode: 307 });
  assert.equal(destinationHits, 0);
});
