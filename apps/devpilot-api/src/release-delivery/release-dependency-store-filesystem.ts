import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { chmod, chown, lstat, mkdir, open, readdir, rename, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { canonicalJson } from "../release-orchestration/utils/release-hash.utils";
import { dependencyStoreManifest, validDependencyStoreManifest,
  type ReleaseDependencyStoreManifest } from "./release-dependency-store-manifest.policy";

export async function createDependencyStoreManifest(input: Omit<
  ReleaseDependencyStoreManifest, "schemaVersion" | "storeDigest" | "files"
> & { pendingRoot: string }) {
  const { pendingRoot, ...identity } = input;
  return dependencyStoreManifest({ ...identity,
    files: await collectStoreFiles(join(pendingRoot, "store")) });
}

export async function promoteDependencyStore(input: {
  cacheRoot: string; pendingRoot: string; manifest: ReleaseDependencyStoreManifest;
}) {
  await mkdir(input.cacheRoot, { recursive: true, mode: 0o700 });
  const descriptor = await open(join(input.pendingRoot, "manifest.json"),
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o400);
  try { await descriptor.writeFile(canonicalJson(input.manifest)); }
  finally { await descriptor.close(); }
  await seal(join(input.pendingRoot, "store"));
  const target = join(input.cacheRoot, input.manifest.combinationHash);
  try {
    await rename(input.pendingRoot, target);
  } catch (error) {
    if (!["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code || ""))
      throw error;
    await verifyDependencyStore(target, input.manifest);
    await rm(input.pendingRoot, { recursive: true, force: true });
  }
  await chmod(target, 0o500);
  return target;
}

export async function verifyDependencyStore(
  root: string,
  expected: Pick<ReleaseDependencyStoreManifest, "combinationHash" | "storeDigest">,
) {
  const handle = await open(join(root, "manifest.json"),
    constants.O_RDONLY | constants.O_NOFOLLOW);
  let manifest: ReleaseDependencyStoreManifest;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw invalid();
    manifest = JSON.parse(await handle.readFile("utf8"));
  } finally { await handle.close(); }
  if (!validDependencyStoreManifest(manifest) ||
    manifest.combinationHash !== expected.combinationHash ||
    manifest.storeDigest !== expected.storeDigest) throw invalid();
  const files = await collectStoreFiles(join(root, "store"));
  if (canonicalJson(files) !== canonicalJson(manifest.files)) throw invalid();
  return manifest;
}

async function collectStoreFiles(root: string) {
  const output: Array<{ path: string; sizeBytes: number; sha256: string }> = [];
  let total = 0;
  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = join(directory, entry.name);
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) throw invalid();
      if (stat.isDirectory()) await visit(target);
      else if (stat.isFile()) {
        total += stat.size;
        if (stat.size > 512 * 1024 * 1024 || total > 2 * 1024 * 1024 * 1024)
          throw invalid();
        const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { output.push({ path: relative(root, target), sizeBytes: stat.size,
          sha256: createHash("sha256").update(await handle.readFile()).digest("hex") }); }
        finally { await handle.close(); }
      } else throw invalid();
    }
  }
  await visit(root);
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

async function seal(root: string) {
  const stat = await lstat(root);
  if (stat.isSymbolicLink()) throw invalid();
  await chown(root, 0, 0);
  if (stat.isDirectory()) {
    for (const child of await readdir(root)) await seal(join(root, child));
    await chmod(root, 0o500);
  } else if (stat.isFile()) await chmod(root, stat.mode & 0o111 ? 0o500 : 0o400);
  else throw invalid();
}
function invalid() { return new Error("Dependency store manifest is invalid"); }
