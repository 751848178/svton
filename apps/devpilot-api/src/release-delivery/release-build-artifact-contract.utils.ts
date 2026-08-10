import { UnprocessableEntityException } from "@nestjs/common";
import { posix } from "node:path";
import {
  containsRepositorySecretText,
  isSecretEnvironmentName,
} from "../repository-analysis/repository-analysis-redact.utils";

const PUBLIC_BUILD_ENVIRONMENT =
  /^(?:NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)[A-Z0-9_]+$/;

export function readArtifactOutputs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new UnprocessableEntityException(
      "构建组件必须显式声明非空 artifactPaths",
    );
  }
  const outputs = value.map((item) => normalizeArtifactOutput(item));
  return [...new Set(outputs)].sort();
}

export function readBuildEnvironment(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnprocessableEntityException("buildEnvironment 必须是对象");
  }
  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const result: Record<string, string> = {};
  for (const [key, item] of entries) {
    if (!PUBLIC_BUILD_ENVIRONMENT.test(key) || isSecretEnvironmentName(key)) {
      throw new UnprocessableEntityException(
        `构建环境变量 ${key} 不是允许烘焙的公开变量`,
      );
    }
    if (typeof item !== "string" || containsRepositorySecretText(item)) {
      throw new UnprocessableEntityException(
        `构建环境变量 ${key} 包含无效值或秘密字面量`,
      );
    }
    result[key] = item;
  }
  return result;
}

function normalizeArtifactOutput(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new UnprocessableEntityException("artifactPaths 只能包含非空路径");
  }
  const raw = value.trim();
  if (
    raw.includes("\\") ||
    raw.includes("\0") ||
    raw.startsWith("/") ||
    /[*?[\]{}!]/.test(raw)
  ) {
    throw new UnprocessableEntityException(`制品输出路径无效：${raw}`);
  }
  const normalized = posix.normalize(raw).replace(/^\.\//, "");
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new UnprocessableEntityException(
      `制品输出必须是仓库内子路径：${raw}`,
    );
  }
  return normalized;
}
