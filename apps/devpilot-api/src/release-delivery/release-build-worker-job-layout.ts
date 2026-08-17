import { chmod, chown, cp, lstat, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { verifyDependencyStore } from "./release-dependency-store-filesystem";

export async function createBrokerJobLayout(input: {
  root: string;
  buildRunId: string;
  uid: number;
  gid: number;
  externalOci?: boolean;
}) {
  await mkdir(input.root, { recursive: true, mode: 0o711 });
  await chmod(input.root, 0o711);
  const jobRoot = await mkdtemp(join(input.root, `${input.buildRunId}-`));
  await Promise.all([
    mkdir(join(jobRoot, "work"), { mode: 0o700 }),
    mkdir(join(jobRoot, "raw-artifacts"), { mode: 0o700 }),
  ]);
  if (input.externalOci) {
    await Promise.all([
      chown(jobRoot, 0, 0), chmod(jobRoot, 0o711),
      chown(join(jobRoot, "work"), 0, 0), chmod(join(jobRoot, "work"), 0o711),
      chown(join(jobRoot, "raw-artifacts"), input.uid, input.gid),
      chmod(join(jobRoot, "raw-artifacts"), 0o700),
    ]);
  } else {
    await chownTree(jobRoot, input.uid, input.gid);
    await chmod(jobRoot, 0o700);
  }
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
  immutable?: boolean;
}) {
  const target = join(input.workRoot, "source");
  await rename(input.source, target);
  if (input.immutable) await sealSourceTree(target);
  else await chownTree(target, input.uid, input.gid);
  return target;
}

export async function transferDependencyStore(input: {
  source: string; jobRoot: string; combinationHash: string; storeDigest: string;
}) {
  const target = join(input.jobRoot, "dependency-store");
  await verifyDependencyStore(input.source, input);
  await cp(input.source, target, { recursive: true, force: false,
    errorOnExist: true, dereference: false });
  await verifyDependencyStore(target, input);
  await sealSourceTree(target);
  return target;
}

async function sealSourceTree(root: string) {
  const stat = await lstat(root);
  if (stat.isSymbolicLink()) throw new Error("worker source contains symlink");
  await chown(root, 0, 0);
  await chmod(root, stat.isDirectory() ? 0o555 : (stat.mode & 0o111) ? 0o555 : 0o444);
  if (!stat.isDirectory()) return;
  for (const entry of await readdir(root)) await sealSourceTree(join(root, entry));
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
