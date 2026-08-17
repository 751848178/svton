import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, mkdtemp, open, rm } from "node:fs/promises";
import { join } from "node:path";

export const DEPENDENCY_FETCH_PACKAGE_JSON = Buffer.from(
  '{"name":"devpilot-dependency-fetch","private":true}\n',
);
export const DEPENDENCY_FETCH_PACKAGE_DIGEST = createHash("sha256")
  .update(DEPENDENCY_FETCH_PACKAGE_JSON).digest("hex");

export async function createDependencyFetchWorkspace(input: {
  controlRoot: string; temporaryRoot: string;
  packageDigest: string; lockfileDigest: string;
}) {
  const root = await mkdtemp(join(input.temporaryRoot, "dependency-fetch-"));
  await chmod(root, 0o700);
  try {
    await copyVerified(join(input.controlRoot, "package.json"),
      join(root, "package.json"), input.packageDigest, 64 * 1024);
    await copyVerified(join(input.controlRoot, "pnpm-lock.yaml"),
      join(root, "pnpm-lock.yaml"), input.lockfileDigest, 10 * 1024 * 1024);
    return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export function dependencyFetchArgv(workspace: string) {
  if (!/^\/tmp\/dependency-fetch-[a-zA-Z0-9]{6}$/.test(workspace))
    throw invalid();
  return ["fetch", "--frozen-lockfile", "--ignore-scripts",
    "--store-dir=/output/store", "--config.registry=https://registry.npmjs.org",
    "--config.ignore-scripts=true", `--dir=${workspace}`];
}

async function copyVerified(source: string, destination: string,
  digest: string, limit: number) {
  const bytes = await readRegular(source, limit);
  if (sha256(bytes) !== digest) throw invalid();
  const output = await open(destination, constants.O_WRONLY | constants.O_CREAT |
    constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await output.writeFile(bytes); } finally { await output.close(); }
  if (sha256(await readRegular(destination, limit)) !== digest) throw invalid();
}

async function readRegular(path: string, limit: number) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw invalid();
    return handle.readFile();
  } finally { await handle.close(); }
}
function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
function invalid() { return new Error("Dependency fetch workspace is invalid"); }
