import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, link, mkdir, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requestRegistration } from './request.js';
import type { RegistrationRequest } from './request-contracts.js';
import { RegistrationRequestError } from './request-errors.js';
import { createTlsFixture, enrollment, session, heartbeat, json, ENROLL_RECEIPT, HEARTBEAT_RECEIPT,
  OTHER_UUID, ENROLL_SECRET, MACHINE_SECRET } from './request-fixture.js';

test('CA file rejects relative, symlink, hardlink, writable, unsafe parent and oversize trust inputs', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close()); let requests = 0;
  const origin = await fixture.server((_req, res) => { requests++; json(res, ENROLL_RECEIPT); });
  const check = async (caFile: string) => assert.rejects(requestRegistration(enrollment(origin, caFile)), { code: 'REGISTRATION_CA_INVALID' });
  await check('ca.pem'); await check(`${fixture.dir}/../${path.basename(fixture.dir)}/ca.pem`);
  const symlinkPath = path.join(fixture.dir, 'linked.pem'); await symlink(fixture.caFile, symlinkPath); await check(symlinkPath);
  const hardlinkPath = path.join(fixture.dir, 'hard.pem'); await link(fixture.caFile, hardlinkPath); await check(hardlinkPath); await check(fixture.caFile); await unlink(hardlinkPath);
  await chmod(fixture.caFile, 0o622); await check(fixture.caFile); await chmod(fixture.caFile, 0o600);
  const unsafeDir = path.join(fixture.dir, 'unsafe'); await mkdir(unsafeDir); await chmod(unsafeDir, 0o777);
  const unsafeCa = path.join(unsafeDir, 'ca.pem'); await writeFile(unsafeCa, 'test', { mode: 0o600 }); await check(unsafeCa);
  const linkedDir = path.join(fixture.dir, 'linked-dir'); await symlink(fixture.dir, linkedDir); await check(path.join(linkedDir, 'ca.pem'));
  const hugeCa = path.join(fixture.dir, 'huge.pem'); await writeFile(hugeCa, 'x'.repeat(65_537), { mode: 0o600 }); await check(hugeCa);
  const emptyCa = path.join(fixture.dir, 'empty.pem'); await writeFile(emptyCa, '', { mode: 0o600 }); await check(emptyCa);
  assert.equal(requests, 0);
});
test('origin, credential, phase and DTO are strict before any network request', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close()); let requests = 0;
  const origin = await fixture.server((_req, res) => { requests++; json(res, ENROLL_RECEIPT); });
  const valid = enrollment(origin, fixture.caFile);
  const invalid: unknown[] = [
    { ...valid, serverOrigin: origin.replace('https:', 'http:') }, { ...valid, serverOrigin: `${origin}/` },
    { ...valid, serverOrigin: `${origin}/capture` }, { ...valid, serverOrigin: `${origin}?secret=${MACHINE_SECRET}` },
    { ...valid, serverOrigin: origin.replace('https://', `https://${ENROLL_SECRET}@`) },
    { ...valid, phase: 'other' }, { ...valid, credential: MACHINE_SECRET }, { ...valid, credential: `${ENROLL_SECRET}\r\nCookie: injected` },
    { ...valid, dto: { ...valid.dto, extra: MACHINE_SECRET } }, { ...valid, deadlineMs: null },
    { ...valid, deadlineMs: 0 }, { ...valid, deadlineMs: 30_001 }, { ...valid, signal: {} },
    { ...valid, dto: { ...valid.dto, metadata: { ...valid.dto.metadata, version: 'x'.repeat(8_193) } } },
  ];
  for (const options of invalid) await assert.rejects(requestRegistration(options as RegistrationRequest), { code: 'REGISTRATION_REQUEST_INVALID' });
  const hostile = { ...valid, get caFile(): string { throw new Error(MACHINE_SECRET); } };
  await assert.rejects(requestRegistration(hostile), { message: 'REGISTRATION_REQUEST_INVALID' });
  assert.equal(requests, 0);
});
test('strict shared receipts reject unknown fields, wrong incarnation and wrong heartbeat correlation', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  let value: unknown = { ...ENROLL_RECEIPT, incarnation: OTHER_UUID };
  const origin = await fixture.server((_req, res) => json(res, value));
  await assert.rejects(requestRegistration(enrollment(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_INVALID' });
  value = { ...ENROLL_RECEIPT, secret: MACHINE_SECRET };
  await assert.rejects(requestRegistration(enrollment(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_INVALID' });
  value = { ...HEARTBEAT_RECEIPT, epoch: 2 };
  await assert.rejects(requestRegistration(heartbeat(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_INVALID' });
  value = { ...HEARTBEAT_RECEIPT, sequence: 2 };
  await assert.rejects(requestRegistration(heartbeat(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_INVALID' });
  await assert.rejects(requestRegistration(session(origin, fixture.caFile)), { code: 'REGISTRATION_RESPONSE_INVALID' });
});
test('safe HTTP error exposes only the allowlisted code/status pair, never echoed body or secret', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  let code: unknown = 'REGISTRATION_UNAUTHORIZED', status = 401;
  const origin = await fixture.server((_req, res) => json(res, { code, message: `${ENROLL_SECRET} ${MACHINE_SECRET}`, hash: 'x'.repeat(64) }, status));
  const check = async (expected?: string) => assert.rejects(requestRegistration(enrollment(origin, fixture.caFile)), error => {
    assert.ok(error instanceof RegistrationRequestError); assert.equal(error.statusCode, status); assert.equal(error.remoteCode, expected);
    assert.equal(error.message, 'REGISTRATION_HTTP_REJECTED');
    for (const secret of [ENROLL_SECRET, MACHINE_SECRET, 'x'.repeat(64)]) assert.equal(JSON.stringify(error).includes(secret), false);
    assert.equal('cause' in error, false); return true;
  });
  await check('REGISTRATION_UNAUTHORIZED'); status = 500; await check();
  status = 401; code = MACHINE_SECRET; await check(); code = ['REGISTRATION_UNAUTHORIZED']; await check();
});
test('request authentication and correlation are captured before asynchronous CA loading', async t => {
  const fixture = await createTlsFixture(); t.after(() => fixture.close());
  const origin = await fixture.server((req, res) => { assert.equal(req.headers.authorization, `Bearer ${ENROLL_SECRET}`); json(res, ENROLL_RECEIPT); });
  const options = structuredClone(enrollment(origin, fixture.caFile));
  const pending = requestRegistration(options);
  (options as { credential: string }).credential = MACHINE_SECRET;
  (options.dto as { incarnation: string }).incarnation = OTHER_UUID;
  assert.deepEqual(await pending, ENROLL_RECEIPT);
});
