import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

export async function createWritableBrokerWorkspace(
  sourceRoot: string,
  workRoot: string,
  directory = "build",
) {
  const source = await realpath(sourceRoot);
  const work = await realpath(workRoot);
  if (overlaps(source, work))
    throw new Error("Release Build source and writable workspace overlap");
  const build = join(work, directory);
  await mkdir(build, { mode: 0o700 });
  await copyDirectory(source, build);
  return realpath(build);
}

async function copyDirectory(source: string, target: string) {
  for (const entry of (await readdir(source)).sort()) {
    const from = join(source, entry);
    const to = join(target, entry);
    const stat = await lstat(from);
    if (stat.isSymbolicLink()) throw unsupported();
    if (stat.isDirectory()) {
      await mkdir(to, { mode: 0o700 });
      await copyDirectory(from, to);
      continue;
    }
    if (!stat.isFile()) throw unsupported();
    await copyFileNoFollow(from, to, (stat.mode & 0o111) ? 0o700 : 0o600);
  }
}

async function copyFileNoFollow(source: string, target: string, mode: number) {
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  const output = await open(target,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, mode);
  try {
    await output.writeFile(await input.readFile());
    await output.sync();
  } finally {
    await Promise.all([input.close(), output.close()]);
  }
}

function overlaps(left: string, right: string) {
  return contains(left, right) || contains(right, left);
}
function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}
function unsupported() { return new Error("Release Build source entry is unsupported"); }
