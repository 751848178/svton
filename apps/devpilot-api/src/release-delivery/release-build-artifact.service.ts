import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as archiver from "archiver";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  lstat,
  mkdir,
  readdir,
  readlink,
  rename,
  rm,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";

interface ArtifactResult {
  digest: string;
  sizeBytes: number;
  uri: string;
}

@Injectable()
export class ReleaseBuildArtifactService {
  private readonly root: string;
  private readonly maxBytes: number;

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>("RELEASE_BUILD_ARTIFACT_ROOT")
        || join(process.cwd(), "storage", "release-artifacts"),
    );
    this.maxBytes = Number(config.get("RELEASE_BUILD_MAX_ARTIFACT_BYTES"))
      || 250 * 1024 * 1024;
  }

  async package(input: {
    checkoutRoot: string;
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
  }): Promise<ArtifactResult> {
    const entries = await collectEntries(input.checkoutRoot);
    const totalBytes = entries.reduce((total, item) => total + item.sizeBytes, 0);
    if (totalBytes > this.maxBytes) {
      throw new Error(`构建制品超过 ${this.maxBytes} 字节上限`);
    }
    const directory = join(this.root, input.projectId, input.releaseOrderId);
    const target = join(directory, `${input.buildRunId}.zip`);
    const temporary = `${target}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      await writeArchive(input.checkoutRoot, entries, temporary);
      await rename(temporary, target);
      const digest = await hashFile(target);
      const sizeBytes = (await lstat(target)).size;
      return {
        digest: `sha256:${digest}`,
        sizeBytes,
        uri: `release-artifact://${input.buildRunId}/bundle.zip`,
      };
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}

interface ArchiveEntry {
  path: string;
  sizeBytes: number;
  symlink?: string;
}

async function collectEntries(root: string, scope = ""): Promise<ArchiveEntry[]> {
  const result: ArchiveEntry[] = [];
  const names = (await readdir(join(root, scope))).sort();
  for (const name of names) {
    const path = scope ? join(scope, name) : name;
    if (excluded(path, name)) continue;
    const stat = await lstat(join(root, path));
    if (stat.isDirectory()) result.push(...await collectEntries(root, path));
    else if (stat.isSymbolicLink()) {
      result.push({ path, sizeBytes: 0, symlink: await readlink(join(root, path)) });
    } else if (stat.isFile()) result.push({ path, sizeBytes: stat.size });
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function excluded(path: string, name: string) {
  if (path === ".git" || path.startsWith(`.git/`)) return true;
  if (path === "node_modules" || path.includes("/node_modules/")) return true;
  if (path === ".devpilot-build-home" || path.startsWith(".devpilot-build-home/")) return true;
  return /^\.env(?:\.|$)/.test(name) && !/^\.env\.example$/.test(name);
}

async function writeArchive(root: string, entries: ArchiveEntry[], target: string) {
  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(target, { mode: 0o600 });
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.once("close", resolvePromise);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    for (const entry of entries) {
      if (entry.symlink !== undefined) archive.symlink(entry.path, entry.symlink);
      else archive.append(createReadStream(join(root, entry.path)), {
        name: relative(root, join(root, entry.path)),
        date: new Date(0),
        mode: 0o644,
      });
    }
    void archive.finalize();
  });
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolvePromise);
    stream.once("error", reject);
  });
  return hash.digest("hex");
}
