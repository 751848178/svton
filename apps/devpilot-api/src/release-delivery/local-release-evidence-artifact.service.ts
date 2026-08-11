import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  ReleaseEvidenceArtifactPort,
  type ReleaseEvidenceArtifactInput,
} from "./release-evidence-artifact.port";

@Injectable()
export class LocalReleaseEvidenceArtifactService extends ReleaseEvidenceArtifactPort {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(
      config.get<string>("RELEASE_BUILD_ARTIFACT_ROOT") ||
        join(process.cwd(), "storage", "release-artifacts"),
      "evidence",
    );
  }

  async publish(input: ReleaseEvidenceArtifactInput) {
    const ids = [
      input.projectId,
      input.releaseOrderId,
      input.buildRunId,
      input.category,
    ];
    if (ids.some((value) => !/^[A-Za-z0-9_-]+$/.test(value))) {
      throw new Error("Evidence artifact path identifier is invalid");
    }
    const serialized = JSON.stringify(input.report);
    if (serialized === undefined) throw new Error("Evidence report is not JSON serializable");
    const content = Buffer.from(serialized);
    if (content.byteLength > 10 * 1024 * 1024) {
      throw new Error("Evidence report exceeds 10 MiB");
    }
    const reportDigest = createHash("sha256").update(content).digest("hex");
    const segments = [input.projectId, input.releaseOrderId, input.buildRunId];
    const directory = join(this.root, ...segments);
    const filename = `${input.category}-${reportDigest}.json`;
    const target = join(directory, filename);
    await ensureSafeDirectory(this.root, segments);
    await assertConfinedDirectory(this.root, directory);
    const temporary = join(directory, `.${filename}-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await link(temporary, target).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      const stat = await lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error("Evidence artifact target is not a regular file");
      }
      const persisted = await readFile(target);
      const persistedDigest = createHash("sha256").update(persisted).digest("hex");
      if (persistedDigest !== reportDigest) {
        throw new Error("Evidence artifact digest collision");
      }
      return {
        evidenceRef: `release-evidence://${input.buildRunId}/${filename}`,
        reportDigest,
        sizeBytes: persisted.byteLength,
      };
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

async function ensureSafeDirectory(root: string, segments: string[]) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  await assertRegularDirectory(root);
  let cursor = root;
  for (const segment of segments) {
    cursor = join(cursor, segment);
    await mkdir(cursor, { mode: 0o700 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      },
    );
    await assertRegularDirectory(cursor);
  }
}

async function assertRegularDirectory(path: string) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Evidence artifact directory escapes configured root");
  }
}

async function assertConfinedDirectory(root: string, directory: string) {
  const canonicalRoot = await realpath(root);
  const canonicalDirectory = await realpath(directory);
  const child = relative(canonicalRoot, canonicalDirectory);
  if (child.startsWith("..") || isAbsolute(child)) {
    throw new Error("Evidence artifact directory escapes configured root");
  }
}
