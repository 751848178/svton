// Deterministic content digest of a source tree (R10): from-dir releases must
// record a verifiable provenance fact instead of a bare {type: tarball} — and
// must never fabricate a Git SHA. The digest covers exactly what the uploaded
// tarball covers: the SAME exclusion list, evaluated the way tar evaluates it
// (a pattern with a slash matches the full relative path; a bare name matches
// any component), and symlinks contribute their link target the way tar
// archives the link itself. Same tree → same digest, across machines and runs.

import { createHash } from 'node:crypto';
import { readdir, readFile, readlink, stat } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SOURCE_EXCLUDES = ['.git', 'node_modules', '.env', 'deploy.env', '*.pem', 'ship.config.yaml', 'ship.config.yml', 'ship.config.json'];

/** tar-style exclusion: slash-containing patterns match the whole relative
 *  path (and path suffixes); bare names/globs match any single component */
/** shared matcher: the staging copy and the digest both use exactly this */
export function excluded(rel: string, excludes: string[]): boolean {
  const parts = rel.split('/');
  for (const ex of excludes) {
    if (ex.includes('/') || ex.includes('*')) {
      const re = new RegExp(`(^|/)${ex.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
      if (re.test(rel)) return true;
    } else if (parts.includes(ex)) {
      return true;
    }
  }
  return false;
}

export interface SourceDigest {
  /** sha256 over the sorted (path, kind, size/content) stream of included entries */
  digest: string;
  files: number;
  bytes: number;
}

export async function sourceContentDigest(dir: string, extraExcludes: string[] = []): Promise<SourceDigest> {
  const excludes = [...new Set([...DEFAULT_SOURCE_EXCLUDES, ...extraExcludes])].filter(Boolean);
  const hash = createHash('sha256');
  const entries: Array<{ rel: string; abs: string; kind: 'file' | 'link' }> = [];
  const walk = async (rel: string) => {
    const abs = path.join(dir, rel);
    const list = await readdir(abs, { withFileTypes: true }).catch(() => []);
    for (const e of list.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (excluded(childRel, excludes)) continue;
      if (e.isDirectory()) await walk(childRel);
      else if (e.isFile()) entries.push({ rel: childRel, abs: path.join(abs, e.name), kind: 'file' });
      else if (e.isSymbolicLink()) entries.push({ rel: childRel, abs: path.join(abs, e.name), kind: 'link' });
    }
  };
  await walk('');
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  let bytes = 0;
  for (const e of entries) {
    if (e.kind === 'link') {
      const target = await readlink(e.abs);
      hash.update(`${e.rel}\0link\0${target}\n`);
      continue;
    }
    const info = await stat(e.abs);
    bytes += info.size;
    hash.update(`${e.rel}\0${info.size}\0`);
    hash.update(createHash('sha256').update(await readFile(e.abs)).digest('hex'));
    hash.update('\n');
  }
  return { digest: `sha256:${hash.digest('hex')}`, files: entries.length, bytes };
}
