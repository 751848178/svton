import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, readlink, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { canonicalJson, stableHash } from "../release-orchestration/utils/release-hash.utils";

export type WorkerSourceManifestEntry = {
  path: string;
  mode: "100644" | "100755" | "120000";
  sizeBytes: number;
  sha256: string;
};

export type WorkerSourceManifest = {
  version: 1;
  entries: WorkerSourceManifestEntry[];
  digest: string;
};

export async function createWorkerSourceManifest(
  root: string,
  tracked: Array<{ path: string; mode: string }>,
): Promise<WorkerSourceManifest> {
  const entries = await Promise.all(tracked.map(async (item) => {
    const path = safePath(item.path);
    if (!["100644", "100755", "120000"].includes(item.mode)) {
      throw new Error(`Unsupported Git tree mode ${item.mode}`);
    }
    const target = join(root, path);
    const stat = await lstat(target);
    const actualMode = stat.isSymbolicLink()
      ? "120000"
      : stat.isFile() && (stat.mode & 0o111) ? "100755" : "100644";
    if (actualMode !== item.mode) throw new Error("Source manifest mode drift");
    const content = item.mode === "120000"
      ? Buffer.from(await readlink(target))
      : await readRegular(target, stat.size);
    return {
      path,
      mode: item.mode as WorkerSourceManifestEntry["mode"],
      sizeBytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  }));
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    version: 1,
    entries,
    digest: stableHash({ scope: "release-build-source-manifest-v1", entries }),
  };
}

export async function verifyExtractedWorkerSource(
  root: string,
  expected: WorkerSourceManifest,
) {
  const actualPaths = await collectPaths(root);
  if (canonicalJson(actualPaths) !== canonicalJson(expected.entries.map((item) => item.path))) {
    throw new Error("Extracted source paths differ from the signed manifest");
  }
  const actual = await createWorkerSourceManifest(root, expected.entries);
  if (actual.digest !== expected.digest || canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error("Extracted source content differs from the signed manifest");
  }
}

function safePath(value: string) {
  if (!value || value.includes("\0") || value.startsWith("/") ||
    value.split("/").some((segment) => !segment || segment === "..")) {
    throw new Error("Source manifest path is unsafe");
  }
  return value;
}

async function readRegular(path: string, expectedSize: number) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== expectedSize || stat.size > 100 * 1024 * 1024) {
      throw new Error("Source manifest entry is not a bounded regular file");
    }
    return handle.readFile();
  } finally {
    await handle.close();
  }
}

async function collectPaths(root: string) {
  const output: string[] = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      const path = relative(root, target);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() || entry.isSymbolicLink()) output.push(path);
      else throw new Error("Extracted source contains an unsupported node");
    }
  }
  await visit(root);
  return output.sort();
}
