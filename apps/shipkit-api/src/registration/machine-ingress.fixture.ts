import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { MachineRequest } from './machine-request.js';
import { MachineIngressSettings, type MachineIngressMode } from './machine-ingress.settings.js';

const names = ['SHIPKIT_AGENT_INGRESS_MODE', 'SHIPKIT_AGENT_PUBLIC_ORIGIN', 'SHIPKIT_AGENT_INGRESS_PROOF_FILE'];
export function machineSettings(mode?: MachineIngressMode | string, extra: Record<string, string> = {}) {
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    if (mode) process.env.SHIPKIT_AGENT_INGRESS_MODE = mode;
    Object.assign(process.env, extra);
    return new MachineIngressSettings();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
}
export async function machineProofFixture() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'shipkit-machine-proof-')));
  await chmod(directory, 0o700);
  const file = path.join(directory, 'proof'), value = randomBytes(32).toString('base64url');
  await writeFile(file, value + '\n', { mode: 0o600 });
  return { directory, file, value, settings: () => machineSettings('trusted-proxy', {
    SHIPKIT_AGENT_PUBLIC_ORIGIN: 'https://shipkit.example', SHIPKIT_AGENT_INGRESS_PROOF_FILE: file,
  }), close: () => rm(directory, { recursive: true, force: true }) };
}
export function ingressRequest(headers: string[] = [], peer = '127.0.0.1'): MachineRequest {
  return { method: 'POST', path: '/api/agent-registration/session', socket: { remoteAddress: peer },
    rawHeaders: ['Host', '127.0.0.1:8770', 'Content-Type', 'application/json', ...headers],
    is: (type: string) => type === 'application/json' ? type : false } as unknown as MachineRequest;
}
