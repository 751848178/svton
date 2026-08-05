import { realpathSync } from "fs";
import { mkdir, mkdtemp, realpath, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, relative, resolve } from "path";
import type { RepositoryCheckoutWorkspace } from "./repository-analysis.types";

export function canonicalAllowedRoot(value: string) {
  const resolved = resolve(value);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export async function createRepositoryGitWorkspace(
  workspace?: RepositoryCheckoutWorkspace,
) {
  const parent = resolve(workspace?.root || tmpdir());
  const prefix = workspace?.prefix || "devpilot-repository-analysis-";
  if (!/^[A-Za-z0-9_-]+-$/.test(prefix)) {
    throw new Error("Repository checkout workspace prefix is invalid");
  }
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const canonicalParent = await realpath(parent);
  const root = await mkdtemp(join(canonicalParent, prefix));
  return {
    root,
    cleanup: () => cleanupWorkspace(root, canonicalParent, prefix),
  };
}

async function cleanupWorkspace(root: string, parent: string, prefix: string) {
  const child = relative(parent, root);
  if (child.includes("/") || !child.startsWith(prefix)) return;
  await rm(root, { recursive: true, force: true });
}
