import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";

export async function readSignedPnpmLock(
  root: string,
  manifest: WorkerSourceManifest,
) {
  const entries = manifest.entries.filter((entry) =>
    entry.path.split("/").at(-1)?.toLowerCase() === "pnpm-lock.yaml");
  if (entries.length !== 1) return Buffer.alloc(0);
  const handle = await open(join(root, entries[0].path),
    constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== entries[0].sizeBytes ||
      stat.size > 10 * 1024 * 1024) return Buffer.alloc(0);
    return handle.readFile();
  } finally {
    await handle.close();
  }
}
