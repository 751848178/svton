import { realpathSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../shared/config.js';
import { loadSpecAnyAt } from '../shared/spec-load.js';
import { resolveTarget } from '../cli/targets.js';
import { resolveProjectId } from '../cli/project-id.js';
import { resolveTargetToken } from '../shared/credentials.js';
import type { ProjectInput } from './contracts.js';

export async function loadProject(input: ProjectInput, sourceMode: 'git' | 'directory' = 'directory') {
  if (!path.isAbsolute(input.rootPath) || !path.isAbsolute(input.configPath)) {
    throw new Error('Project directory and config reference must be absolute paths');
  }
  const rootPath = realpathSync(input.rootPath);
  const configPath = realpathSync(input.configPath);
  const config = (() => { try { return loadConfig(configPath); }
    catch { throw new Error('Configuration reference is invalid; run ship doctor locally to inspect it'); } })();
  const loaded = (() => { try { return loadSpecAnyAt(rootPath); }
    catch { throw new Error('Project specification is invalid; validate ship.yaml locally'); } })();
  if (loaded.version !== 2) throw new Error('Platform projects require a schemaVersion: 2 ship.yaml; single-app CLI remains available');
  const spec = loaded.spec;
  const target = resolveTarget(config, input.targetKey);
  const runtime = await resolveTargetToken(target.target, `runtime.targets.${target.name}`);
  const identity = await resolveProjectId(rootPath, config, sourceMode === 'directory' ? rootPath : undefined);
  return { rootPath, configPath, config, spec, targetKey: target.name, runtime, identity };
}
export type ProjectContext = Awaited<ReturnType<typeof loadProject>>;

export function publicUrl(raw: string): string {
  const u = new URL(raw);
  u.username = ''; u.password = ''; u.search = ''; u.hash = '';
  return u.toString().replace(/\/$/, '');
}

export function privateValues(context: ProjectContext): string[] {
  const values: string[] = [context.runtime.token];
  const walk = (value: unknown, key = '') => {
    if (typeof value === 'string' && /token|password|secret|credential/i.test(key)) values.push(value);
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k));
  };
  walk(context.config);
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
