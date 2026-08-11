import { chmod, chown, lstat, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

export async function createBrokerJobLayout(input: {
  root: string;
  buildRunId: string;
  uid: number;
  gid: number;
}) {
  await mkdir(input.root, { recursive: true, mode: 0o711 });
  await chmod(input.root, 0o711);
  const jobRoot = await mkdtemp(join(input.root, `${input.buildRunId}-`));
  await Promise.all([
    mkdir(join(jobRoot, "work"), { mode: 0o700 }),
    mkdir(join(jobRoot, "raw-artifacts"), { mode: 0o700 }),
  ]);
  await chownTree(jobRoot, input.uid, input.gid);
  await chmod(jobRoot, 0o700);
  return {
    jobRoot,
    workRoot: join(jobRoot, "work"),
    artifactRoot: join(jobRoot, "raw-artifacts"),
    cleanup: () => rm(jobRoot, { recursive: true, force: true }),
  };
}

export async function transferBuildWorkspace(input: {
  source: string;
  workRoot: string;
  uid: number;
  gid: number;
}) {
  const target = join(input.workRoot, "source");
  await rename(input.source, target);
  await chownTree(target, input.uid, input.gid);
  return target;
}

async function chownTree(root: string, uid: number, gid: number) {
  const stat = await lstat(root);
  if (stat.isSymbolicLink()) throw new Error("worker job contains symlink");
  await chown(root, uid, gid);
  if (!stat.isDirectory()) return;
  for (const entry of await readdir(root)) {
    await chownTree(join(root, entry), uid, gid);
  }
}
