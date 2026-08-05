import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lstat, mkdir, readdir, readlink, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  assertReleaseBuildActive,
  hashReleaseBuildArtifact,
  ReleaseBuildArchiveEntry,
  writeReleaseBuildArchive,
} from "./release-build-artifact-io";

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
      config.get<string>("RELEASE_BUILD_ARTIFACT_ROOT") ||
        join(process.cwd(), "storage", "release-artifacts"),
    );
    this.maxBytes =
      Number(config.get("RELEASE_BUILD_MAX_ARTIFACT_BYTES")) ||
      250 * 1024 * 1024;
  }

  async package(
    input: {
      checkoutRoot: string;
      projectId: string;
      releaseOrderId: string;
      buildRunId: string;
    },
    signal?: AbortSignal,
  ): Promise<ArtifactResult> {
    assertReleaseBuildActive(signal);
    const entries = await collectEntries(input.checkoutRoot, "", signal);
    const totalBytes = entries.reduce(
      (total, item) => total + item.sizeBytes,
      0,
    );
    if (totalBytes > this.maxBytes) {
      throw new Error(`构建制品超过 ${this.maxBytes} 字节上限`);
    }
    const directory = join(this.root, input.projectId, input.releaseOrderId);
    const target = join(directory, `${input.buildRunId}.zip`);
    const temporary = `${target}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      await writeReleaseBuildArchive(
        input.checkoutRoot,
        entries,
        temporary,
        signal,
      );
      assertReleaseBuildActive(signal);
      await rename(temporary, target);
      const digest = await hashReleaseBuildArtifact(target, signal);
      assertReleaseBuildActive(signal);
      const sizeBytes = (await lstat(target)).size;
      return {
        digest: `sha256:${digest}`,
        sizeBytes,
        uri: `release-artifact://${input.buildRunId}/bundle.zip`,
      };
    } catch (error) {
      await rm(temporary, { force: true });
      await rm(target, { force: true });
      throw error;
    }
  }

  async resolveAndVerify(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
    uri: string;
    digest: string;
  }) {
    for (const segment of [
      input.projectId,
      input.releaseOrderId,
      input.buildRunId,
    ]) {
      if (!/^[A-Za-z0-9_-]+$/.test(segment))
        throw new Error("制品路径标识无效");
    }
    const expectedUri = `release-artifact://${input.buildRunId}/bundle.zip`;
    if (input.uri !== expectedUri)
      throw new Error("Manifest 制品 URI 与 BuildRun 不匹配");
    const path = join(
      this.root,
      input.projectId,
      input.releaseOrderId,
      `${input.buildRunId}.zip`,
    );
    const stat = await lstat(path);
    if (!stat.isFile()) throw new Error("Manifest 制品文件不存在");
    const digest = `sha256:${await hashReleaseBuildArtifact(path)}`;
    if (digest !== input.digest)
      throw new Error("Manifest 制品 Digest 校验失败");
    return { path, sizeBytes: stat.size };
  }
}

async function collectEntries(
  root: string,
  scope = "",
  signal?: AbortSignal,
): Promise<ReleaseBuildArchiveEntry[]> {
  assertReleaseBuildActive(signal);
  const result: ReleaseBuildArchiveEntry[] = [];
  const names = (await readdir(join(root, scope))).sort();
  for (const name of names) {
    assertReleaseBuildActive(signal);
    const path = scope ? join(scope, name) : name;
    if (excluded(path, name)) continue;
    const stat = await lstat(join(root, path));
    if (stat.isDirectory())
      result.push(...(await collectEntries(root, path, signal)));
    else if (stat.isSymbolicLink()) {
      result.push({
        path,
        sizeBytes: 0,
        symlink: await readlink(join(root, path)),
      });
    } else if (stat.isFile()) result.push({ path, sizeBytes: stat.size });
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function excluded(path: string, name: string) {
  if (path === ".git" || path.startsWith(`.git/`)) return true;
  if (path === "node_modules" || path.includes("/node_modules/")) return true;
  if (
    path === ".devpilot-build-home" ||
    path.startsWith(".devpilot-build-home/")
  )
    return true;
  return /^\.env(?:\.|$)/.test(name) && !/^\.env\.example$/.test(name);
}
