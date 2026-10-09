import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ProjectInput } from './contracts.js';
import type { PrivatePlanOptions } from './private-snapshot.js';
import { loadProjectInput } from './project-load.js';

export async function loadProject(input: ProjectInput, sourceMode: 'git' | 'directory' = 'directory', options: PrivatePlanOptions = {}) {
  return loadProjectInput(input, input.repository ? 'git' : sourceMode, options);
}
export type ProjectContext = Awaited<ReturnType<typeof loadProject>>;

export function publicUrl(raw: string): string {
  const u = new URL(raw);
  u.username = ''; u.password = ''; u.search = ''; u.hash = '';
  return u.toString().replace(/\/$/, '');
}

export function privateValues(context: ProjectContext): string[] {
  const values: string[] = [context.runtime.token, ...context.redactionValues];
  const walk = (value: unknown, key = '') => {
    if (typeof value === 'string' && /token|password|secret|credential/i.test(key)) values.push(value);
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k));
  };
  walk(context.config);
  if (context.snapshot || context.sourceSnapshot) return values.filter(v => v.length >= 3).sort((a, b) => b.length - a.length);
  for (const svc of Object.values(context.spec.services)) {
    if (!svc.envFile) continue;
    try {
      for (const line of readFileSync(path.resolve(context.rootPath, svc.envFile), 'utf8').split('\n')) {
        const match = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=(.*)$/.exec(line.trim());
        if (match?.[1]) values.push(match[1].replace(/^['"]|['"]$/g, ''));
      }
    } catch { /* absent env is validated before starting build */ }
  }
  return values.filter((v) => v.length >= 3).sort((a, b) => b.length - a.length);
}

export function redactText(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) out = out.split(secret).join('[redacted]');
  return out.replace(/(Bearer\s+)[\w.-]+/gi, '$1[redacted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/((?:token|password|secret(?:key)?)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[redacted]');
}
