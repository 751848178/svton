// Frozen source artifacts (S01/S03): a from-dir release must build ONE
// immutable snapshot of the tree — exclusions applied by OUR code with LITERAL
// envFile paths (never tar globs: `prod[1].env` as a glob wrongly excludes
// `prod1.env` and ships the secret itself), then the tarball is created from
// that staging copy with NO per-file excludes, and the content digest is taken
// over the SAME staging content. Capability checks and machine preparation
// happen AFTER the freeze and can never change what gets uploaded or hashed.

import { copyFile, mkdir, mkdtemp, readlink, readdir, realpath, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import { DEFAULT_SOURCE_EXCLUDES, excluded, sourceContentDigest } from './source-digest.js';

/** './config/a.env' → 'config/a.env' (spec already rejects absolute/.. paths) */
export function normalizeLiteralPath(p: string): string {
  return p.replace(/^\.\//, '').split('/').filter((seg) => seg && seg !== '.').join('/');
}

function literalExcluded(rel: string, literalPaths: Set<string>): boolean {
  // case-insensitive: on case-insensitive filesystems (macOS/APFS) a declared
  // 'Config/Prod.env' reads the on-disk 'config/prod.env' at deploy time, so
  // the freeze must exclude that same file (worst case it also excludes a
  // distinct case-variant source file — conservative in the safe direction)
  const lower = normalizeLiteralPath(rel).toLowerCase();
  return literalPaths.has(lower);
}

interface EnvExclusions { paths: Set<string>; identities: Set<string> }
const identity = (s: { dev: number; ino: number }) => `${s.dev}:${s.ino}`;
const defaultExcluded = (rel: string) => excluded(rel.toLowerCase(), DEFAULT_SOURCE_EXCLUDES);

/** Discover default secret files before copying so their other names cannot
 * bypass exclusion; excluded heavy directories remain pruned. */
async function defaultSecretFiles(src: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (rel: string) => {
    for (const e of await readdir(path.join(src, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (defaultExcluded(child)) {
        if (!e.isDirectory()) files.push(path.join(src, child));
      } else if (e.isDirectory()) await walk(child);
    }
  };
  await walk('');
  return files;
}

function relativeInside(root: string, absolute: string): string | null {
  const rel = path.relative(root, absolute);
  return rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel) ? rel : null;
}

/** Env paths are relative to the controller cwd, not necessarily from-dir.
 * Exclude both the declaration and its resolved file (including hardlinks),
 * without excluding public siblings of a symlinked directory. */
async function envExclusions(src: string, envFiles: string[], envBaseDir: string): Promise<EnvExclusions> {
  const root = await realpath(src);
  const base = await realpath(envBaseDir);
  const paths = new Set<string>();
  const identities = new Set<string>();
  const addPath = (absolute: string) => {
    const rel = relativeInside(root, absolute);
    if (rel) paths.add(normalizeLiteralPath(rel).toLowerCase());
  };
  const secrets = [...envFiles.map((f) => path.resolve(base, f)), ...await defaultSecretFiles(root)];
  for (const absolute of secrets) {
    addPath(absolute);
    try {
      const physical = await realpath(absolute);
      const info = await stat(physical);
      if (info.isFile()) {
        addPath(physical);
        identities.add(identity(info));
      }
    } catch (e) {
      // Missing env files are valid for keep-env; permission/I/O errors are not.
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  return { paths, identities };
}

/** copy the tree applying OUR matcher + literal envFiles; symlinks copied as links */
async function copyTreeFiltered(src: string, dest: string, secrets: EnvExclusions): Promise<void> {
  const walk = async (rel: string) => {
    const abs = path.join(src, rel);
    const out = path.join(dest, rel);
    const entries = await readdir(abs, { withFileTypes: true });
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (defaultExcluded(childRel) || literalExcluded(childRel, secrets.paths)) continue;
      const childAbs = path.join(abs, e.name);
      const childOut = path.join(out, e.name);
      if (e.isDirectory()) {
        await mkdir(childOut, { recursive: true });
        await walk(childRel);
      } else if (e.isSymbolicLink()) {
        await mkdir(out, { recursive: true });
        await symlink(await readlink(childAbs), childOut);
      } else if (e.isFile()) {
        if (secrets.identities.has(identity(await stat(childAbs)))) continue;
        await mkdir(out, { recursive: true });
        await copyFile(childAbs, childOut);
      }
    }
  };
  await walk('');
}

export interface FrozenSource {
  /** the immutable tarball that WILL be uploaded (caller uploads exactly this file) */
  tarball: string;
  /** deterministic digest over exactly the frozen (uploaded) content */
  contentDigest: string;
  files: number;
  bytes: number;
  stagingDir: string;
  cleanup(): Promise<void>;
}

/** freeze the tree ONCE: staging copy (our exclusions, literal envFiles) →
 *  tarball (no excludes) → digest over the staging content */
export async function freezeSourceDir(fromDir: string, envFiles: string[], envBaseDir = fromDir): Promise<FrozenSource> {
  const staging = await mkdtemp(path.join(tmpdir(), 'ship-srcfrozen-'));
  const tarball = `${staging}.tgz`;
  try {
    await copyTreeFiltered(fromDir, staging, await envExclusions(fromDir, envFiles, envBaseDir));
    const digest = await sourceContentDigest(staging, []);
    const r = await exec('tar', ['czf', tarball, '-C', staging, '.'], { timeoutMs: 10 * 60_000 });
    if (r.code !== 0) throw new Error(`freezing source dir failed: ${r.stderr.slice(0, 300)}`);
    return {
      tarball,
      contentDigest: digest.digest,
      files: digest.files,
      bytes: digest.bytes,
      stagingDir: staging,
      cleanup: async () => {
        await rm(staging, { recursive: true, force: true });
        await rm(tarball, { force: true });
      },
    };
  } catch (e) {
    // a failed freeze leaves neither the staging dir nor a partial tarball
    await rm(staging, { recursive: true, force: true }).catch(() => {});
    await rm(tarball, { force: true }).catch(() => {});
    throw e;
  }
}
