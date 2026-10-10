import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import type { HeartbeatRegistrationRequest, EnrollmentRegistrationRequest, SessionRegistrationRequest } from './request-contracts.js';

export const UUID = '12345678-1234-4123-8123-123456789abc';
export const OTHER_UUID = '12345678-1234-4123-8123-123456789abd';
export const ENROLL_SECRET = `ska_enroll_${Buffer.alloc(32, 11).toString('base64url')}`;
export const MACHINE_SECRET = `ska_machine_${Buffer.alloc(32, 12).toString('base64url')}`;
export const STATUS = { reportedRole: 'runtime', version: '0.0.1', docker: true, capabilities: ['runtime'] } as const;
export const ENROLL_RECEIPT = { v: 1, agentId: OTHER_UUID, incarnation: UUID, approvedRole: 'runtime',
  resourceKind: 'persistent', credentialRevision: 1, trustRevision: 1 } as const;
export const SESSION_RECEIPT = { v: 1, epoch: 1, lastSequence: 0, leaseExpiresAt: '2026-10-10T00:01:30.000Z', heartbeatIntervalMs: 15_000 } as const;
export const HEARTBEAT_RECEIPT = { v: 1, epoch: 1, sequence: 1, acceptedAt: '2026-10-10T00:00:00.000Z', leaseExpiresAt: '2026-10-10T00:01:30.000Z' } as const;

function openssl(dir: string, args: string[]): void {
  const result = spawnSync('openssl', args, { cwd: dir, stdio: 'ignore', timeout: 15_000 });
  if (result.status !== 0) throw new Error('TLS test certificate generation failed');
}
export async function createTlsFixture() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'shipkit-registration-tls-')));
  await chmod(dir, 0o700);
  openssl(dir, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '1', '-subj', '/CN=Shipkit Test CA']);
  openssl(dir, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'wrong-ca.key', '-out', 'wrong-ca.pem', '-days', '1', '-subj', '/CN=Untrusted Test CA']);
  for (const [name, san] of [['server', 'IP:127.0.0.1'], ['hostname', 'DNS:invalid.example']] as const) {
    openssl(dir, ['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${name}`]);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, `${name}.ext`), `subjectAltName=${san}\n`, { mode: 0o600 });
    openssl(dir, ['x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', `${name}.pem`, '-days', '1', '-extfile', `${name}.ext`]);
  }
  await chmod(path.join(dir, 'ca.pem'), 0o600); await chmod(path.join(dir, 'wrong-ca.pem'), 0o600);
  const servers: (Server | ReturnType<typeof createTcpServer>)[] = [], sockets = new Set<Duplex>();
  return {
    dir, caFile: path.join(dir, 'ca.pem'), wrongCaFile: path.join(dir, 'wrong-ca.pem'),
    async server(handler: (request: IncomingMessage, response: ServerResponse) => void, wrongHostname = false): Promise<string> {
      const name = wrongHostname ? 'hostname' : 'server';
      const server = createServer({ key: await readFile(path.join(dir, `${name}.key`)), cert: await readFile(path.join(dir, `${name}.pem`)) }, handler);
      server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
      servers.push(server);
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('TLS test address failed');
      return `https://127.0.0.1:${address.port}`;
    },
    async stalledHandshake(): Promise<string> {
      const server = createTcpServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
      servers.push(server);
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('TLS test address failed');
      return `https://127.0.0.1:${address.port}`;
    },
    async close(): Promise<void> {
      for (const socket of sockets) socket.destroy();
      await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
export function enrollment(serverOrigin: string, caFile?: string): EnrollmentRegistrationRequest {
  return { phase: 'enroll', serverOrigin, caFile, credential: ENROLL_SECRET,
    dto: { v: 1, enrollmentId: UUID, attemptId: UUID, incarnation: UUID, machineCredential: MACHINE_SECRET,
      reportedRole: 'runtime', metadata: { version: STATUS.version, docker: STATUS.docker, capabilities: STATUS.capabilities } } };
}
export function session(serverOrigin: string, caFile?: string): SessionRegistrationRequest {
  return { phase: 'session', serverOrigin, caFile, credential: MACHINE_SECRET,
    dto: { v: 1, agentId: OTHER_UUID, incarnation: UUID, bootId: UUID, status: STATUS } };
}
export function heartbeat(serverOrigin: string, caFile?: string): HeartbeatRegistrationRequest {
  return { ...session(serverOrigin, caFile), phase: 'heartbeat', dto: { ...session(serverOrigin).dto, epoch: 1, sequence: 1 } };
}
export function json(response: ServerResponse, value: unknown, status = 201): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value));
}
