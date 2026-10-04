// `ship doctor` — local + remote readiness checks. Remote checks are AUTHENTICATED and verify
// the expected role + docker (F27); plain-HTTP public targets get a transport warning (F09).

import { parseArgs } from 'node:util';
import { loadConfig, resolveConfigPath } from '../shared/config.js';
import { findSpecPath, loadSpecFile } from '../shared/spec-load.js';
import { api } from '../shared/http.js';
import type { ResolvedTarget } from '../shared/credentials.js';
import { createBuilderProvider } from '../providers/registry.js';
import { createEmitter } from './output.js';
import { listTargets } from './targets.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { DEPLOYMENT_IDENTITY_CAPABILITY } from '../shared/deployment-identity.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const PRIVATE_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost)/i;

interface StatusBody {
  role?: string;
  docker?: boolean;
  version?: string;
  /** caller's effective role — M2-04: machine role is not a credential permission */
  auth?: { role?: string; capabilities?: string[] };
}

async function checkAgent(checks: Check[], name: string, t: ResolvedTarget, expectedRole: 'runtime' | 'builder'): Promise<void> {
  try {
    const s = await api<StatusBody>(t.url, t.token, 'GET', '/api/status', undefined, 8000, t.caFile ? { caFile: t.caFile } : {});
    const effective = s?.auth?.role;
    const roleOk = effective === expectedRole || effective === 'both';
    const machineOk = s?.role === expectedRole || s?.role === 'both';
    const protocolOk = expectedRole !== 'runtime' || (Array.isArray(s?.auth?.capabilities) && s.auth.capabilities.includes(DEPLOYMENT_IDENTITY_CAPABILITY));
    const why = !s?.auth
      ? 'agent 未上报凭据有效权限（需 ship-agent ≥0.5.0）'
      : !roleOk ? `credential role ${effective ?? '?'} lacks ${expectedRole}`
      : !machineOk ? `machine role ${s?.role ?? '?'} lacks ${expectedRole}`
      : !protocolOk ? '运行端缺少部署身份隔离能力，请升级 ship-agent' : 'ok';
    checks.push({
      name,
      ok: Boolean(roleOk && machineOk && protocolOk && s?.docker && s?.auth),
      detail: `${t.url} credential=${effective ?? 'unreported'} (need ${expectedRole}; machine role=${s?.role}) docker=${s?.docker} v${s?.version ?? '?'} — ${why}`,
    });
  } catch (e) {
    checks.push({ name, ok: false, detail: `${t.url} authenticated check failed: ${(e as Error).message}` });
  }
  if (/^http:\/\//i.test(t.url) && !PRIVATE_RE.test(new URL(t.url).hostname)) {
    checks.push({ name: `${name}:transport`, ok: true, detail: '⚠ WARNING: plain HTTP over a public address — tokens/env travel unencrypted; front the agent with TLS or use a private channel' });
  }
}

export async function cmdDoctor(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: { config: { type: 'string' }, json: { type: 'boolean' } },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const checks: Check[] = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({ name: 'node', ok: nodeMajor >= 20, detail: `v${process.versions.node} (need >=20)` });

  let configPath: string | null = null;
  try {
    configPath = resolveConfigPath(args.values.config);
  } catch {
    configPath = null;
  }
  if (!configPath) {
    checks.push({ name: 'config', ok: false, detail: 'not found — pass --config PATH or create ship.config.yaml' });
  }

  const specPath = findSpecPath();
  if (!specPath) {
    checks.push({ name: 'spec', ok: true, detail: 'no ship.yaml in cwd (only needed for build/deploy)' });
  } else {
    try {
      const spec = loadSpecFile(specPath);
      checks.push({ name: 'spec', ok: true, detail: `${spec.name} (${specPath})` });
    } catch (e) {
      checks.push({ name: 'spec', ok: false, detail: (e as Error).message });
    }
  }

  if (configPath) {
    try {
      const config = loadConfig(args.values.config);
      checks.push({
        name: 'registry',
        ok: Boolean(config.registry),
        detail: config.registry ? `${config.registry.url}/${config.registry.namespace}` : 'not configured (required for push)',
      });
      if (config.builder.mode === 'static' && config.builder.static) {
        await checkAgent(checks, 'builder', await resolveTargetToken(config.builder.static, 'builder.static'), 'builder');
      } else {
        // read-only: doctor must never mutate cloud resources (F20.6); sweeping lives in build/builder commands
        const provider = await createBuilderProvider(config);
        const st = await provider.status();
        checks.push({
          name: 'builder(dynamic)',
          ok: true,
          detail: st.active ? `active: ${st.url}` : 'no active builder — one will be created on next `ship build`',
        });
      }
      for (const [name, t] of listTargets(config)) {
        await checkAgent(checks, `runtime:${name}`, await resolveTargetToken(t, `runtime.targets.${name}`), 'runtime');
      }
    } catch (e) {
      checks.push({ name: 'config', ok: false, detail: (e as Error).message });
    }
  }

  const allOk = checks.every((c) => c.ok);
  em.payload({ checks, allOk });
  if (!em.json) {
    for (const c of checks) {
      if (c.ok) em.log.info(`ok   ${c.name}`, { detail: c.detail });
      else em.log.error(`FAIL ${c.name}`, { detail: c.detail });
    }
  }
  return allOk ? 0 : 1;
}
