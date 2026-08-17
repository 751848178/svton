import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export async function assertSafeArtifactTree(root: string) {
  let count = 0;
  const queue = [root];
  while (queue.length) {
    const current = queue.pop()!;
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
      throw new Error("broker output contains unsafe entry");
    if (++count > 20_000) throw new Error("broker output entry limit exceeded");
    if (stat.isDirectory()) {
      for (const entry of await readdir(current)) queue.push(join(current, entry));
    }
  }
}

export async function mergeArtifactTree(source: string, target: string) {
  await assertSafeArtifactTree(source);
  await mkdir(target, { recursive: true, mode: 0o700 });
  for (const name of await readdir(source)) {
    const from = join(source, name);
    const to = join(target, name);
    const stat = await lstat(from);
    if (stat.isDirectory()) {
      const targetStat = await optionalStat(to);
      if (targetStat && !targetStat.isDirectory()) throw conflict(name);
      await mergeArtifactTree(from, to);
    } else {
      try { await copyFileNoFollow(from, to, stat.mode & 0o777); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const targetStat = await lstat(to);
        if (!targetStat.isFile() || await fileDigest(from) !== await fileDigest(to))
          throw conflict(name);
      }
    }
  }
}

async function copyFileNoFollow(source: string, target: string, mode: number) {
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  let output: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const metadata = await input.stat();
    if (!metadata.isFile()) throw new Error("broker output contains unsafe entry");
    output = await open(target, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, mode);
    await output.writeFile(await input.readFile());
    await output.sync();
  } finally {
    await output?.close();
    await input.close();
  }
}

export async function artifactTreeDigest(root: string) {
  await assertSafeArtifactTree(root);
  const hash = createHash("sha256");
  const visit = async (directory: string) => {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name);
      const stat = await lstat(path);
      const key = relative(root, path);
      const mode = stat.mode & 0o777;
      hash.update(stat.isDirectory() ? `d:${key}:${mode}\0` :
        `f:${key}:${stat.size}:${mode}\0`);
      if (stat.isDirectory()) await visit(path);
      else hash.update(await readFileNoFollow(path));
    }
  };
  await visit(root);
  return hash.digest("hex");
}

async function fileDigest(path: string) {
  return createHash("sha256").update(await readFileNoFollow(path)).digest("hex");
}
async function readFileNoFollow(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return await handle.readFile(); } finally { await handle.close(); }
}
async function optionalStat(path: string) {
  try { return await lstat(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
function conflict(name: string) { return new Error(`broker evidence conflicts: ${name}`); }
