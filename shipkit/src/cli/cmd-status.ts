// `ship status` — apps and versions across runtime targets; unknown targets are errors (F29).

import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config.js';
import { api } from '../shared/http.js';
import type { AgentStatus } from '../shared/types.js';
import { createEmitter } from './output.js';
import { CliError } from './errors.js';
import { listTargets } from './targets.js';

export async function cmdStatus(argv: string[]): Promise<number> {
  const args = parseArgs({
    args: argv,
    options: { config: { type: 'string' }, json: { type: 'boolean' }, to: { type: 'string' } },
    allowPositionals: false,
  });
  const em = createEmitter(args.values.json ?? false);
  const config = loadConfig(args.values.config);
  const all = listTargets(config);
  const wantedName = args.values.to;
  const wanted = wantedName && wantedName !== 'all' ? all.filter(([n]) => n === wantedName) : all;
  if (wanted.length === 0) {
    throw new CliError(`unknown runtime target '${wantedName}' (available: ${all.map(([n]) => n).join(', ')})`);
  }

  const results: Array<{ name: string; url: string; ok: boolean; status?: AgentStatus; error?: string }> = [];
  for (const [name, t] of wanted) {
    try {
      const status = await api<AgentStatus>(t.url, t.token, 'GET', '/api/status');
      results.push({ name, url: t.url, ok: true, status });
    } catch (e) {
      results.push({ name, url: t.url, ok: false, error: (e as Error).message });
    }
  }

  em.payload({ targets: results });
  if (!em.json) {
    for (const r of results) {
      if (!r.ok) {
        em.log.error('target unreachable', { target: r.name, url: r.url, error: r.error });
        continue;
      }
      const s = r.status!;
      em.log.info(`target ${r.name} (${r.url})`, { role: s.role, docker: s.docker, version: s.version });
      for (const app of s.apps ?? []) {
        em.log.info(`  app ${app.app}`, {
          current: app.current ?? '-',
          previous: app.previous ?? '-',
          release: app.currentReleaseId ?? '-',
          updatedAt: app.updatedAt ?? '-',
        });
      }
    }
  }
  return results.every((r) => r.ok) ? 0 : 3;
}
