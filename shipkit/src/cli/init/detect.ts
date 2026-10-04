// Project detection for `ship init`: Dockerfile candidates, EXPOSE ports, name candidates,
// and existing ship.yaml / ship.config.yaml. Every detected value carries its source so the
// wizard can show evidence and never silently guess.

import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILENAMES } from '../../shared/config.js';
import { SPEC_FILENAMES } from '../../shared/spec-load.js';
import { NAME_RE } from '../../shared/spec-schema.js';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.ship', 'coverage', '.pnpm-store']);
const DOCKERFILE_RE = /^(Dockerfile(\..+)?)$/;
const DOCKERFILE_SUFFIX_RE = /\.Dockerfile$/;

export interface Detection {
  cwd: string;
  /** preferred first; source describes where the value came from */
  nameCandidates: { value: string; source: string }[];
  /** repo-relative Dockerfile paths, shallowest first */
  dockerfiles: string[];
  /** TCP ports from EXPOSE in the given Dockerfile, in declaration order */
  portsFor(dockerfile: string): number[];
  existingSpecPath: string | null;
  existingConfigPath: string | null;
}

function walkDockerfiles(dir: string, depth: number, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    // hidden entries are skipped except .docker (build-context convention)
    if (e.name.startsWith('.') && e.name !== '.docker') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !SKIP_DIRS.has(e.name)) walkDockerfiles(full, depth - 1, out);
    } else if (e.isFile() && (DOCKERFILE_RE.test(e.name) || DOCKERFILE_SUFFIX_RE.test(e.name))) {
      out.push(full);
    }
  }
}

function sanitizeName(raw: string): string | null {
  const v = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return NAME_RE.test(v) ? v : null;
}

function nameCandidates(cwd: string): { value: string; source: string }[] {
  const out: { value: string; source: string }[] = [];
  const pkgPath = path.join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
      const base = pkg.name ? pkg.name.split('/').pop() ?? '' : '';
      const v = base ? sanitizeName(base) : null;
      if (v) out.push({ value: v, source: 'package.json 的 name 字段' });
    } catch {
      // unparsable package.json contributes no candidate
    }
  }
  const dirName = sanitizeName(path.basename(cwd));
  if (dirName) out.push({ value: dirName, source: '当前目录名' });
  return out;
}

function exposedPorts(file: string): number[] {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const ports: number[] = [];
  for (const line of text.split('\n')) {
    const m = /^EXPOSE\s+(.+)$/i.exec(line.trim());
    if (!m) continue;
    for (const part of m[1]!.split(/\s+/)) {
      const [num, proto] = part.split('/');
      const n = Number(num);
      if (Number.isInteger(n) && n >= 1 && n <= 65535 && (!proto || proto.toLowerCase() === 'tcp') && !ports.includes(n)) {
        ports.push(n);
      }
    }
  }
  return ports;
}

export function detectProject(cwd = process.cwd()): Detection {
  const abs: string[] = [];
  walkDockerfiles(cwd, 3, abs);
  const dockerfiles = abs
    .map((p) => path.relative(cwd, p) || '.')
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return {
    cwd,
    nameCandidates: nameCandidates(cwd),
    dockerfiles,
    portsFor: (dockerfile: string) => exposedPorts(path.join(cwd, dockerfile)),
    existingSpecPath: SPEC_FILENAMES.map((f) => path.join(cwd, f)).find((p) => existsSync(p)) ?? null,
    existingConfigPath: CONFIG_FILENAMES.map((f) => path.join(cwd, f)).find((p) => existsSync(p)) ?? null,
  };
}
