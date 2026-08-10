import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export async function materializeParityHistoryArtifacts(root, compose, ids) {
  const required = [ids.project, ids.orderPrev, ids.buildPrevA, ids.buildPrevB];
  if (required.some((value) => !SAFE_ID.test(value))) {
    throw new Error("parity history artifact identity is unsafe");
  }
  const archiver = createRequire(
    resolve(root, "apps/devpilot-api/package.json"),
  )("archiver");
  const stage = await mkdtemp(join(tmpdir(), "parity-history-artifacts-"));
  try {
    const records = [
      { key: "A", buildId: ids.buildPrevA },
      { key: "B", buildId: ids.buildPrevB },
    ];
    const digests = [];
    for (const record of records) {
      const archivePath = join(stage, `${record.buildId}.zip`);
      await writeBaselineArchive(archiver, archivePath, record);
      const directory = [
        "/var/lib/devpilot/release-build/artifacts",
        ids.project,
        ids.orderPrev,
        record.buildId,
      ].join("/");
      await compose(["exec", "-T", "api", "mkdir", "-p", directory]);
      await compose(["cp", archivePath, `api:${directory}/bundle.zip`]);
      await compose([
        "exec",
        "-T",
        "api",
        "chmod",
        "600",
        `${directory}/bundle.zip`,
      ]);
      digests.push(
        `sha256:${createHash("sha256")
          .update(await readFile(archivePath))
          .digest("hex")}`,
      );
    }
    return digests;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function writeBaselineArchive(archiver, target, record) {
  await new Promise((resolvePromise, reject) => {
    const output = createWriteStream(target, { mode: 0o600 });
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.once("close", resolvePromise);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    archive.append(
      `${JSON.stringify({ schemaVersion: 1, baseline: record.key })}\n`,
      {
        name: "devpilot-baseline.json",
        date: new Date(0),
        mode: 0o644,
      },
    );
    void archive.finalize().catch(reject);
  });
}
