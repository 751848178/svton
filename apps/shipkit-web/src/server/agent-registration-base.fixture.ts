import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer, type RequestListener } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { AgentRegistrationGatewaySettings } from './agent-registration-settings';

export async function agentGatewayFixture() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'shipkit-gateway-proof-')));
  await chmod(directory, 0o700);
  const edge = randomBytes(32).toString('base64url'), api = randomBytes(32).toString('base64url');
  const edgeFile = path.join(directory, 'edge'), apiFile = path.join(directory, 'api');
  await writeFile(edgeFile, edge + '\n', { mode: 0o600 }); await writeFile(apiFile, api, { mode: 0o600 });
  const env = { SHIPKIT_AGENT_GATEWAY_MODE: 'trusted-edge', SHIPKIT_AGENT_PUBLIC_ORIGIN: 'https://shipkit.fixture',
    SHIPKIT_AGENT_EDGE_PROOF_FILE: edgeFile, SHIPKIT_AGENT_INGRESS_PROOF_FILE: apiFile };
  const machine = `ska_machine_${randomBytes(32).toString('base64url')}`;
  const headers = { host: 'shipkit.fixture', 'content-type': 'application/json', authorization: `Bearer ${machine}`,
    'x-shipkit-agent-edge': edge, 'x-forwarded-proto': 'https', 'x-forwarded-host': 'shipkit.fixture', 'x-forwarded-port': '443' };
  return { directory, edgeFile, apiFile, edge, api, machine, env, headers,
    settings: (extra: Record<string, string | undefined> = {}) => new AgentRegistrationGatewaySettings({ ...env, ...extra }),
    request: (options: RequestInit = {}, route = '/api/agent-registration/session') => new Request(`https://shipkit.fixture${route}`,
      { method: 'POST', headers, body: '{}', ...options }),
    close: () => rm(directory, { recursive: true, force: true }) };
}

export async function agentGatewayUpstream(listener: RequestListener) {
  const server = createServer(listener);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return { port, server, close: () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  }) };
}
