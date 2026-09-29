// `ship doctor` — local + remote readiness checks. Remote checks are AUTHENTICATED and verify
// the expected role + docker (F27); plain-HTTP public targets get a transport warning (F09).

import { parseArgs } from 'node:util';
import { loadConfig, resolveConfigPath } from '../shared/config.js';
import { findSpecPath, loadSpecFile } from '../shared/spec-load.js';
import { api } from '../shared/http.js';
import type { TargetConfig } from '../shared/types.js';
import { createBuilderProvider } from '../providers/registry.js';
import { createEmitter } from './output.js';
import { listTargets } from './targets.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const PRIVATE_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost)/i;

async function checkAgent(checks: Check[], name: string, t: TargetConfig, expectedRole: 'runtime' | 'builder'): Promise<void> {
  try {
    const s = await api<{ role?: string; docker?: boolean; version?: string }>(t.url, t.token, 'GET', '/api/status', undefined, 8000);
    const roleOk = s?.role === expectedRole || s?.role === 'both';
    checks.push({
      name,
      ok: Boolean(roleOk && s?.docker),
      detail: `${t.url} role=${s?.role} (need ${expectedRole}) docker=${s?.docker} v${s?.version ?? '?'}`,
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
        await checkAgent(checks, 'builder', config.builder.static, 'builder');
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
        await checkAgent(checks, `runtime:${name}`, t, 'runtime');
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
