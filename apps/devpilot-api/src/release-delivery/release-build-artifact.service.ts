import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { artifactFailure } from "./release-build-artifact-policy";
import {
  assertReleaseBuildActive,
  hashReleaseBuildArtifact,
} from "./release-build-artifact-io";
import {
  releaseBuildComponentFileKey,
  releaseBuildEnvironmentDescriptor,
  publishReleaseBuildDirectory,
  resolveReleaseBuildBundlePath,
  writeReleaseBuildArtifact,
} from "./release-build-artifact-publish.utils";
import { snapshotReleaseBuildArtifacts } from "./release-build-artifact-snapshot";
import type {
  ReleaseBuildArtifactItem,
  ReleaseBuildComponent,
} from "./release-build.types";

interface ArtifactResult {
  digest: string;
  sizeBytes: number;
  uri: string;
  items: ReleaseBuildArtifactItem[];
  contentIndex: Array<{ path: string; digest: string; sizeBytes: number }>;
}

@Injectable()
export class ReleaseBuildArtifactService {
  private readonly root: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>("RELEASE_BUILD_ARTIFACT_ROOT") ||
        join(process.cwd(), "storage", "release-artifacts"),
    );
    this.maxBytes =
      Number(config.get("RELEASE_BUILD_MAX_ARTIFACT_BYTES")) ||
      250 * 1024 * 1024;
    this.maxFiles =
      Number(config.get("RELEASE_BUILD_MAX_ARTIFACT_FILES")) || 10_000;
  }

  async package(
    input: {
      checkoutRoot: string;
      projectId: string;
      releaseOrderId: string;
      buildRunId: string;
      components: ReleaseBuildComponent[];
    },
    signal?: AbortSignal,
  ): Promise<ArtifactResult> {
    assertReleaseBuildActive(signal);
    const orderRoot = this.orderRoot(input);
    const finalRoot = join(orderRoot, input.buildRunId);
    const temporary = join(
      orderRoot,
      `.${input.buildRunId}-${randomUUID()}.tmp`,
    );
    const snapshotRoot = join(temporary, "snapshot");
    const publishRoot = join(temporary, "publish");
    let published = false;
    await mkdir(publishRoot, { recursive: true, mode: 0o700 });
    try {
      const snapshot = await snapshotReleaseBuildArtifacts({
        checkoutRoot: input.checkoutRoot,
        snapshotRoot,
        components: input.components,
        maxBytes: this.maxBytes,
        maxFiles: this.maxFiles,
        signal,
      });
      const bundle = await writeReleaseBuildArtifact(
        snapshotRoot,
        snapshot.entries,
        join(publishRoot, "bundle.zip"),
        signal,
      );
      const items: ReleaseBuildArtifactItem[] = [];
      const seen = new Set<string>();
      for (const component of snapshot.components) {
        if (seen.has(component.key)) {
          throw artifactFailure(
            "ARTIFACT_COMPONENT_DUPLICATE",
            `制品组件键重复：${component.key}`,
          );
        }
        seen.add(component.key);
        const file = `${releaseBuildComponentFileKey(component.key)}.zip`;
        const artifact = await writeReleaseBuildArtifact(
          snapshotRoot,
          component.entries,
          join(publishRoot, "components", file),
          signal,
        );
        const contentIndex = snapshot.contentIndex.filter((entry) =>
          component.entries.some((item) => item.path === entry.path),
        );
        items.push({
          componentKey: component.key,
          artifactType: "zip",
          digest: artifact.digest,
          sizeBytes: artifact.sizeBytes,
          uri: `release-artifact://${input.buildRunId}/components/${file}`,
          outputs: component.outputs,
          contentIndex,
          environment: releaseBuildEnvironmentDescriptor(
            component.buildEnvironment,
          ),
        });
      }
      await rm(snapshotRoot, { recursive: true, force: true });
      assertReleaseBuildActive(signal);
      await publishReleaseBuildDirectory(publishRoot, finalRoot);
      published = true;
      return {
        ...bundle,
        uri: `release-artifact://${input.buildRunId}/bundle.zip`,
        items,
        contentIndex: snapshot.contentIndex,
      };
    } catch (error) {
      if (published) await rm(finalRoot, { recursive: true, force: true });
      assertReleaseBuildActive(signal);
      throw error;
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  async discard(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
  }) {
    await rm(join(this.orderRoot(input), input.buildRunId), {
      recursive: true,
      force: true,
    });
  }

  async resolveAndVerify(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
    uri: string;
    digest: string;
  }) {
    const expectedUri = `release-artifact://${input.buildRunId}/bundle.zip`;
    if (input.uri !== expectedUri)
      throw new Error("Manifest 制品 URI 与 BuildRun 不匹配");
    const path = await resolveReleaseBuildBundlePath(
      this.orderRoot(input),
      input.buildRunId,
    );
    const stat = await lstat(path);
    if (!stat.isFile()) throw new Error("Manifest 制品文件不存在");
    const digest = `sha256:${await hashReleaseBuildArtifact(path)}`;
    if (digest !== input.digest)
      throw new Error("Manifest 制品 Digest 校验失败");
    return { path, sizeBytes: stat.size };
  }

  private orderRoot(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
  }) {
    for (const value of [
      input.projectId,
      input.releaseOrderId,
      input.buildRunId,
    ]) {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("制品路径标识无效");
    }
    return join(this.root, input.projectId, input.releaseOrderId);
  }
}
