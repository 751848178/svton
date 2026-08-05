import * as archiver from "archiver";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { join, relative } from "node:path";

export interface ReleaseBuildArchiveEntry {
  path: string;
  sizeBytes: number;
  symlink?: string;
}

export async function writeReleaseBuildArchive(
  root: string,
  entries: ReleaseBuildArchiveEntry[],
  target: string,
  signal?: AbortSignal,
) {
  assertReleaseBuildActive(signal);
  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(target, { mode: 0o600 });
    const archive = archiver("zip", { zlib: { level: 9 } });
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolvePromise();
    };
    const abort = () => {
      output.destroy(signalError(signal));
      void archive.abort();
    };
    output.once("close", () => settle());
    output.once("error", settle);
    archive.once("error", settle);
    signal?.addEventListener("abort", abort, { once: true });
    archive.pipe(output);
    for (const entry of entries) {
      if (entry.symlink !== undefined)
        archive.symlink(entry.path, entry.symlink);
      else
        archive.append(createReadStream(join(root, entry.path)), {
          name: relative(root, join(root, entry.path)),
          date: new Date(0),
          mode: 0o644,
        });
    }
    void archive.finalize().catch(settle);
  });
}

export async function hashReleaseBuildArtifact(
  path: string,
  signal?: AbortSignal,
) {
  assertReleaseBuildActive(signal);
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path, signal ? { signal } : undefined);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolvePromise);
    stream.once("error", reject);
  });
  return hash.digest("hex");
}

export function assertReleaseBuildActive(signal?: AbortSignal) {
  if (signal?.aborted) throw signalError(signal);
}

function signalError(signal?: AbortSignal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error("Release build artifact packaging aborted");
}
