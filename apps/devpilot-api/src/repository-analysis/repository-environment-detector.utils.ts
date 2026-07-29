import { load } from 'js-yaml';
import { basename } from 'path';
import { isSecretEnvironmentName } from './repository-analysis-redact.utils';
import {
  DetectedEnvironmentVariable,
  RepositoryInventory,
} from './repository-parser.types';

const PROCESS_ENV = /process\.env\.([A-Z][A-Z0-9_]*)/g;
const CONFIG_ENV = /(?:getOrThrow|get)\s*(?:<[^>]+>)?\s*\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g;
const INTERPOLATED_ENV = /\$\{([A-Z][A-Z0-9_]*)(?::?[-?][^}]*)?\}/g;
const SAMPLE_ENV = /^([A-Z][A-Z0-9_]*)\s*=(.*)$/gm;

export function detectEnvironmentVariables(
  inventory: RepositoryInventory,
  scope: string,
): DetectedEnvironmentVariable[] {
  const found = new Map<string, {
    required: boolean;
    files: Set<string>;
  }>();
  for (const [file, content] of Object.entries(inventory.manifests)) {
    if (!inScope(file, scope) && !isCompose(file)) continue;
    const scopedContent = isCompose(file) ? composeScope(content, scope) : content;
    if (!scopedContent) continue;
    collect(found, file, scopedContent, PROCESS_ENV, false);
    collect(found, file, scopedContent, CONFIG_ENV, scopedContent.includes('getOrThrow'));
    collect(found, file, scopedContent, INTERPOLATED_ENV, false);
    if (/\/\.env\.(?:example|sample|template|defaults)$|^\.env\.(?:example|sample|template|defaults)$/i.test(file)) {
      for (const match of content.matchAll(SAMPLE_ENV)) {
        const name = match[1];
        const required = match[2].trim() === '';
        merge(found, name, file, required);
      }
    }
  }
  return [...found.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, item]) => ({
      name,
      required: item.required,
      secret: isSecretEnvironmentName(name),
      evidence: [...item.files].slice(0, 5).map((file) => ({
        file,
        kind: 'environment_variable',
        detail: `变量名 ${name}`,
        confidence: 'high' as const,
      })),
    }));
}

function collect(
  target: Map<string, { required: boolean; files: Set<string> }>,
  file: string,
  content: string,
  pattern: RegExp,
  required: boolean,
): void {
  pattern.lastIndex = 0;
  for (const match of content.matchAll(pattern)) {
    merge(target, match[1], file, required);
  }
}

function merge(
  target: Map<string, { required: boolean; files: Set<string> }>,
  name: string,
  file: string,
  required: boolean,
): void {
  const current = target.get(name) || { required: false, files: new Set<string>() };
  current.required ||= required;
  current.files.add(file);
  target.set(name, current);
}

function inScope(file: string, scope: string): boolean {
  return scope === '.' || file === scope || file.startsWith(`${scope}/`);
}

function isCompose(file: string): boolean {
  return /(^|\/)(?:docker-)?compose(?:\.[^/]+)?\.ya?ml$|(^|\/)docker-compose(?:\.[^/]+)?\.ya?ml$/i.test(file);
}

function composeScope(content: string, scope: string): string {
  if (scope === '.') return content;
  try {
    const document = load(content) as {
      services?: Record<string, {
        build?: string | { context?: string; dockerfile?: string };
        [key: string]: unknown;
      }>;
    };
    const name = basename(scope);
    const selected = Object.entries(document?.services || {})
      .filter(([serviceName, service]) => {
        if (serviceName === name || serviceName.endsWith(`-${name}`)) return true;
        if (typeof service.build === 'string') return service.build === scope;
        const dockerfile = service.build?.dockerfile || '';
        return service.build?.context === scope || dockerfile.startsWith(`${scope}/`);
      })
      .map(([, service]) => service);
    return JSON.stringify(selected);
  } catch {
    return '';
  }
}
