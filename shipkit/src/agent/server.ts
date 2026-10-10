// Agent entry point: validated options, registration ownership and process shutdown.

import { mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createLogger } from '../shared/log.js';
import { SHIP_VERSION, type AgentRole } from '../shared/types.js';
import { dockerAvailable } from './docker.js';
import { runPairCli } from './pair-cli.js';
import { readRegistrationConfig } from './registration/config.js';
import type { RegistrationConfig } from './registration/identity-contracts.js';
import { withAgentRegistration } from './registration/lifecycle.js';
import { startAgentHttp, type AgentHandle } from './server-http.js';
export type { AgentHandle } from './server-http.js';

export interface AgentOptions {
  role?: string;
  token?: string;
  port?: number;
  host?: string;
  workRoot?: string;
  registration?: RegistrationConfig;
}

const ROLES: AgentRole[] = ['builder', 'runtime', 'both'];

export async function startAgent(opts: AgentOptions = {}): Promise<AgentHandle> {
  const log = createLogger(false);
  const roleRaw = opts.role ?? process.env.SHIP_AGENT_ROLE ?? 'both';
  if (!ROLES.includes(roleRaw as AgentRole)) throw new Error(`SHIP_AGENT_ROLE must be one of ${ROLES.join('|')}, got '${roleRaw}'`);
  const role = roleRaw as AgentRole;
  const token = opts.token ?? process.env.SHIP_AGENT_TOKEN ?? '';
  const port = opts.port ?? Number(process.env.SHIP_AGENT_PORT ?? 7410);
  const host = opts.host ?? process.env.SHIP_AGENT_HOST ?? '0.0.0.0';
  const workRoot = opts.workRoot ?? process.env.SHIP_WORK_ROOT ?? '/opt/shipkit-data';
  if (!token) throw new Error('SHIP_AGENT_TOKEN is required — the agent refuses to start unauthenticated');
  const registration = opts.registration ?? readRegistrationConfig();

  await mkdir(workRoot, { recursive: true });
  // docker probe cache with TTL: recovers automatically after docker comes back (F26)
  let dockerCache: { at: number; ok: boolean } | null = null;
  const dockerOk = async (): Promise<boolean> => {
    if (!dockerCache || Date.now() - dockerCache.at > 60_000) {
      dockerCache = { at: Date.now(), ok: await dockerAvailable() };
    }
    return dockerCache.ok;
  };
  return withAgentRegistration({ workRoot, config: registration,
    status: async () => ({ reportedRole: role, version: SHIP_VERSION, docker: await dockerOk(),
      capabilities: role === 'both' ? ['builder', 'runtime', 'registration-heartbeat-v1'] : [role, 'registration-heartbeat-v1'] }),
    onStatus: status => log.info('Agent registration', { ...status }),
    start: () => startAgentHttp({ role, token, host, port, workRoot, dockerOk, log, drainOnClose: registration.mode === 'persistent' }) });
}

// realpath both sides: on macOS a /tmp path differs from import.meta.url (/private/tmp) by symlink
const argv1 = process.argv[1];
const invokedDirectly = argv1 && import.meta.url === pathToFileURL(realpathSync(argv1)).href;
if (invokedDirectly) {
  if (process.argv.includes('--pair')) {
    const workRoot = process.env.SHIP_WORK_ROOT ?? '/opt/shipkit-data';
    const agentRole = process.env.SHIP_AGENT_ROLE ?? 'both';
    runPairCli(process.argv.slice(2), workRoot, agentRole)
      .then((code) => process.exit(code))
      .catch((e: unknown) => {
        console.error(`ship-agent --pair failed: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(2);
      });
  } else {
    startAgent()
    .then((agent) => {
      const shutdown = () => {
        void agent.close().then(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((e: unknown) => {
      console.error(`ship-agent failed to start: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
  }
}
