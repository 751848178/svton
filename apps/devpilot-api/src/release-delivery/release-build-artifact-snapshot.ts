import { lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
  copyReleaseBuildArtifactFile,
  inspectReleaseBuildArtifactFile,
} from "./release-build-artifact-inspection";
import {
  artifactFailure,
  assertSafeArtifactPath,
} from "./release-build-artifact-policy";
import type { ReleaseBuildArchiveEntry } from "./release-build-artifact-io";
import { assertReleaseBuildActive } from "./release-build-artifact-io";
import type { ReleaseBuildComponent } from "./release-build.types";

export interface ReleaseBuildArtifactSnapshot {
  entries: ReleaseBuildArchiveEntry[];
  components: Array<{
    key: string;
    outputs: string[];
    entries: ReleaseBuildArchiveEntry[];
    buildEnvironment: Record<string, string>;
  }>;
  contentIndex: Array<{ path: string; digest: string; sizeBytes: number }>;
}

export async function snapshotReleaseBuildArtifacts(input: {
  checkoutRoot: string;
  snapshotRoot: string;
  components: ReleaseBuildComponent[];
  maxBytes: number;
  maxFiles: number;
  signal?: AbortSignal;
}): Promise<ReleaseBuildArtifactSnapshot> {
  const checkoutRoot = await realpath(input.checkoutRoot);
  const source = new Map<string, number>();
  const membership = new Map<string, Set<string>>();
  const owners = new Map<string, string>();
  for (const component of input.components) {
    const paths = new Set<string>();
    for (const output of component.artifactOutputs) {
      for (const entry of await collectOutput(checkoutRoot, output)) {
        source.set(entry.path, entry.sizeBytes);
        paths.add(entry.path);
        const owner = owners.get(entry.path);
        if (owner && owner !== component.key) {
          throw artifactFailure(
            "ARTIFACT_OUTPUT_OVERLAP",
            `制品文件被多个组件声明：${entry.path}`,
          );
        }
        owners.set(entry.path, component.key);
      }
    }
    membership.set(component.key, paths);
  }
  const totalBytes = [...source.values()].reduce((sum, size) => sum + size, 0);
  if (source.size > input.maxFiles) {
    throw artifactFailure(
      "ARTIFACT_FILE_LIMIT",
      `构建制品超过 ${input.maxFiles} 个文件上限`,
    );
  }
  if (totalBytes > input.maxBytes) {
    throw artifactFailure(
      "ARTIFACT_SIZE_LIMIT",
      `构建制品超过 ${input.maxBytes} 字节上限`,
    );
  }
  await mkdir(input.snapshotRoot, { recursive: true, mode: 0o700 });
  const contentIndex: ReleaseBuildArtifactSnapshot["contentIndex"] = [];
  for (const [path, expectedSize] of [...source].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    assertReleaseBuildActive(input.signal);
    const target = join(input.snapshotRoot, path);
    await copyReleaseBuildArtifactFile(join(checkoutRoot, path), target);
    const inspected = await inspectReleaseBuildArtifactFile(
      target,
      input.signal,
    );
    if (inspected.sizeBytes !== expectedSize) {
      throw artifactFailure(
        "ARTIFACT_SOURCE_CHANGED",
        `制品采集期间文件发生变化：${path}`,
      );
    }
    contentIndex.push({ path, ...inspected });
  }
  const entryByPath = new Map(
    contentIndex.map((item) => [
      item.path,
      { path: item.path, sizeBytes: item.sizeBytes },
    ]),
  );
  return {
    entries: [...entryByPath.values()],
    components: input.components.map((component) => ({
      key: component.key,
      outputs: component.artifactOutputs,
      entries: [...(membership.get(component.key) || [])]
        .sort()
        .map((path) => requireEntry(entryByPath, path)),
      buildEnvironment: component.buildEnvironment,
    })),
    contentIndex,
  };
}

function requireEntry(
  entries: Map<string, ReleaseBuildArchiveEntry>,
  path: string,
) {
  const entry = entries.get(path);
  if (!entry)
    throw artifactFailure(
      "ARTIFACT_INDEX_INVALID",
      `制品内容索引缺失：${path}`,
    );
  return entry;
}

async function collectOutput(root: string, output: string) {
  const candidate = resolve(root, output);
  let canonical: string;
  try {
    canonical = await realpath(candidate);
  } catch {
    throw artifactFailure(
      "ARTIFACT_OUTPUT_MISSING",
      `声明的制品输出不存在：${output}`,
    );
  }
  if (canonical !== candidate || outside(root, canonical)) {
    throw artifactFailure(
      "ARTIFACT_UNSAFE_ENTRY",
      `制品输出包含符号链接或越界路径：${output}`,
    );
  }
  return collectTree(root, output);
}

async function collectTree(
  root: string,
  path: string,
): Promise<ReleaseBuildArchiveEntry[]> {
  const stat = await lstat(join(root, path));
  if (stat.isSymbolicLink()) {
    throw artifactFailure(
      "ARTIFACT_UNSAFE_ENTRY",
      `制品输出禁止符号链接：${path}`,
    );
  }
  assertSafeArtifactPath(path, stat.isDirectory());
  if (stat.isFile()) return [{ path, sizeBytes: stat.size }];
  if (!stat.isDirectory()) {
    throw artifactFailure(
      "ARTIFACT_UNSAFE_ENTRY",
      `制品输出禁止特殊文件：${path}`,
    );
  }
  const nested = await Promise.all(
    (await readdir(join(root, path)))
      .sort()
      .map((name) => collectTree(root, join(path, name))),
  );
  return nested.flat();
}

function outside(root: string, candidate: string) {
  const child = relative(root, candidate);
  return child === "" || child.startsWith("..") || child.startsWith("/");
}
