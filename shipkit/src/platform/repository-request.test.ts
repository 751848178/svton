import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as realRequest, type RequestOptions, type Server } from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { LookupAddress } from 'node:dns';
import type { AddressInfo } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const moduleMock = (mock as unknown as { module(name: string, options: { namedExports: Record<string, unknown> }): unknown }).module.bind(mock);
let certificate: Buffer, directory: string, ipv4: Server, ipv6: Server | undefined;
let addresses: LookupAddress[], dnsCalls: number, dnsDelay: number, transportCalls: number;
let autoSelectFamily: boolean, responseMode: string;
let lookupAll: boolean[], requests: Array<{ host?: string; servername: string | false | undefined }>;
moduleMock('node:dns/promises', { namedExports: { lookup: async (_host: string, options: { all?: boolean }) => {
  dnsCalls++; assert.equal(options.all, true);
  if (dnsDelay) await new Promise(resolve => setTimeout(resolve, dnsDelay));
  return addresses;
} } });
moduleMock('node:https', { namedExports: { request: (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
  transportCalls++; assert.notEqual(options.rejectUnauthorized, false);
  const transport: RequestOptions & { autoSelectFamily: boolean } = { ...options, ca: certificate, autoSelectFamily,
    lookup: (host, requested, done) => { lookupAll.push(requested.all === true); options.lookup!(host, requested, done); },
  };
  return realRequest(url, transport, callback);
} } });
const { repositoryReader } = await import('./repository-request.js');

async function listen(server: Server, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => reject(error);
    server.once('error', failed);
    server.listen(0, host, () => { server.removeListener('error', failed); resolve(); });
  });
}
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'shipkit-repository-tls-'));
  const key = path.join(directory, 'key.pem'), cert = path.join(directory, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=pinned.test', '-addext', 'subjectAltName=DNS:pinned.test', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  certificate = await readFile(cert);
  const tls = { key: await readFile(key), cert: certificate };
  const server = () => createServer(tls, (request, response) => {
    requests.push({ host: request.headers.host, servername: (request.socket as TLSSocket & { servername?: string | false }).servername });
    if (responseMode === 'hang') return;
    if (responseMode === 'redirect') { response.writeHead(302, { location: 'https://unsafe.invalid/metadata' }); response.end(); return; }
    if (responseMode === 'denied') { response.writeHead(403); response.end(); return; }
    response.end(responseMode === 'invalid' ? 'not-json' : JSON.stringify({ pinned: true }));
  });
  ipv4 = server(); await listen(ipv4, '127.0.0.1');
  const candidate = server();
  try { await listen(candidate, '::1'); ipv6 = candidate; }
  catch (error) { if (!['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
});
beforeEach(() => {
  addresses = [{ address: '127.0.0.1', family: 4 }]; dnsCalls = 0; dnsDelay = 0; transportCalls = 0;
  autoSelectFamily = true; responseMode = 'ok'; lookupAll = []; requests = [];
});
after(async () => {
  for (const server of [ipv4, ipv6]) if (server) {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
  if (directory) await rm(directory, { recursive: true, force: true });
  mock.restoreAll();
});
function url(server = ipv4, host = 'pinned.test') {
  return new URL(`https://${host}:${(server.address() as AddressInfo).port}/metadata`);
}
function reader(remaining = 1024, milliseconds = 2000, allowPrivate = true) {
  const budget = { remaining, deadline: Date.now() + milliseconds };
  return { read: repositoryReader({ allowPrivateHosts: allowPrivate ? ['pinned.test', 'wrong.test'] : [] }, budget), budget };
}

test('Node22 all:true lookup reaches real TLS with the pinned IP and original hostname', async () => {
  assert.deepEqual(await reader().read(url(), {}), { pinned: true });
  assert.deepEqual(lookupAll, [true]); assert.equal(dnsCalls, 1); assert.equal(transportCalls, 1);
  assert.equal(requests[0]?.servername, 'pinned.test'); assert.equal(requests[0]?.host, url().host);
});
test('autoSelectFamily:false retains the single-address Node callback', async () => {
  autoSelectFamily = false;
  assert.deepEqual(await reader().read(url(), {}), { pinned: true });
  assert.deepEqual(lookupAll, [false]); assert.equal(dnsCalls, 1);
});
test('IPv6-only approved addresses work with both Node callback shapes', async t => {
  if (!ipv6) { t.skip('Loopback IPv6 is unavailable'); return; }
  addresses = [{ address: '::1', family: 6 }];
  for (const all of [true, false]) {
    autoSelectFamily = all;
    assert.deepEqual(await reader().read(url(ipv6), {}), { pinned: true });
  }
  assert.deepEqual(lookupAll, [true, false]); assert.equal(dnsCalls, 2);
});
test('all DNS answers remain checked before HTTPS, including an unsafe unselected answer', async () => {
  addresses = [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }];
  await assert.rejects(reader(1024, 2000, false).read(url(), {}), /prohibited network address/);
  assert.equal(dnsCalls, 1); assert.equal(transportCalls, 0); assert.equal(requests.length, 0);
});
test('IPv4 preference is preserved when the validated set also contains IPv6', async () => {
  addresses = [{ address: '::1', family: 6 }, { address: '127.0.0.1', family: 4 }];
  assert.deepEqual(await reader().read(url(), {}), { pinned: true });
  assert.equal(dnsCalls, 1); assert.deepEqual(lookupAll, [true]);
});
test('a pinned connection still verifies the TLS certificate hostname', async () => {
  await assert.rejects(reader().read(url(ipv4, 'wrong.test'), {}), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  assert.equal(dnsCalls, 1); assert.equal(requests.length, 0);
});
test('redirects and rejected credentials produce one HTTPS request and no DNS fallback', async () => {
  for (const mode of ['redirect', 'denied']) {
    responseMode = mode;
    await assert.rejects(reader().read(url(), {}), mode === 'redirect' ? /redirects are not followed/ : /credentials were rejected/);
  }
  assert.equal(dnsCalls, 2); assert.equal(transportCalls, 2); assert.equal(requests.length, 2);
});
test('the shared byte budget is enforced across real HTTPS reads', async () => {
  const { read, budget } = reader(20);
  assert.deepEqual(await read(url(), {}), { pinned: true });
  assert.equal(budget.remaining, 5);
  await assert.rejects(read(url(), {}), /configured byte limit/);
  assert(budget.remaining < 0); assert.equal(dnsCalls, 2);
});
test('DNS consumes the deadline without opening a late HTTPS connection', async () => {
  dnsDelay = 80;
  await assert.rejects(reader(1024, 20).read(url(), {}), /timed out/);
  assert.equal(transportCalls, 0);
});
test('a stalled real TLS response respects the request deadline', async () => {
  responseMode = 'hang';
  await assert.rejects(reader(1024, 80).read(url(), {}), /request timed out/);
  assert.equal(transportCalls, 1);
});
test('invalid JSON from a real TLS provider response is refused', async () => {
  responseMode = 'invalid';
  await assert.rejects(reader().read(url(), {}), /invalid metadata/);
  assert.equal(dnsCalls, 1); assert.equal(transportCalls, 1);
});
