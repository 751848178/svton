import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { isIP } from 'node:net';
import type { MachineRequest } from './machine-request.js';
import { MACHINE_INGRESS_PROOF_HEADER, MachineIngressSettings } from './machine-ingress.settings.js';

const denied = () => new ForbiddenException('机器请求入口不符合要求');
const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i;
const loopbackPeers = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Raw duplicates are rejected before Node's merged header view is trusted. */
export function machineHeader(request: MachineRequest, name: string): string | undefined {
  const values: string[] = [];
  if (request.rawHeaders.length % 2) throw denied();
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    if (request.rawHeaders[i]?.toLowerCase() === name) values.push(request.rawHeaders[i + 1]!);
  }
  if (values.length > 1 || values.some(value => typeof value !== 'string' || value.length > 8192)) throw denied();
  return values[0];
}

/** A proxy proof, never client forwarded headers alone, authorizes the ingress hop. */
export function assertMachineIngress(request: MachineRequest, settings: MachineIngressSettings): void {
  if (settings.mode === 'disabled') throw new ServiceUnavailableException('机器登记入口未启用');
  const names = ['host', 'authorization', 'cookie', 'content-type', MACHINE_INGRESS_PROOF_HEADER,
    'forwarded', 'x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-for'];
  const values = Object.fromEntries(names.map(name => [name, machineHeader(request, name)]));
  if (request.rawHeaders.some((value, i) => i % 2 === 0 && value.toLowerCase().startsWith('x-forwarded-')
    && !names.includes(value.toLowerCase()))) throw denied();
  if (values.cookie !== undefined || values.forwarded !== undefined || !request.is('application/json')) throw denied();
  const forwarded = names.filter(name => name.startsWith('x-forwarded-'));
  if (forwarded.some(name => values[name]?.includes(','))) throw denied();
  if (settings.mode === 'local-development') {
    if (!loopbackHost.test(values.host ?? '') || !loopbackPeers.has(request.socket.remoteAddress ?? '')
      || values[MACHINE_INGRESS_PROOF_HEADER] !== undefined || forwarded.some(name => values[name] !== undefined)) throw denied();
    const origin = machineHeader(request, 'origin');
    if (origin !== undefined) {
      try { const url = new URL(origin); if (url.origin !== origin || url.protocol !== 'http:' || !loopbackHost.test(url.host)) throw denied(); }
      catch { throw denied(); }
    }
    return;
  }
  settings.assertProof(values[MACHINE_INGRESS_PROOF_HEADER]);
  const origin = settings.publicOrigin!;
  if (!loopbackHost.test(values.host ?? '') || !loopbackPeers.has(request.socket.remoteAddress ?? '')) throw denied();
  if (values['x-forwarded-proto'] !== 'https' || values['x-forwarded-host'] !== origin.host
    || values['x-forwarded-port'] !== (origin.port || '443')) throw denied();
  const peer = values['x-forwarded-for'];
  if (peer !== undefined && !isIP(peer)) throw denied();
  const suppliedOrigin = machineHeader(request, 'origin');
  if (suppliedOrigin !== undefined && suppliedOrigin !== origin.origin) throw denied();
}
