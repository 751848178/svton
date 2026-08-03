import { BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";
import {
  RESOURCE_REFERENCE_KINDS,
  type EnvironmentConfigSnapshot,
  type ReferenceRisk,
  type ResourceReferenceInput,
} from "./environment-config-revision.types";

const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const RISKS = new Set<ReferenceRisk>(["low", "medium", "high"]);

export function normalizePlainVariables(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("普通变量必须是 KEY=VALUE 对象");
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!ENV_KEY_PATTERN.test(key) || typeof entry !== "string") {
      throw new BadRequestException(`普通变量 ${key} 不符合命名或值类型约束`);
    }
    result[key] = entry;
  }
  return result;
}

export function normalizeResourceReferences(value: unknown) {
  if (!Array.isArray(value)) throw new BadRequestException("资源引用必须是数组");
  // Nest's implicit-conversion runtime may wrap record entries once when the
  // DTO carries Array<Record<...>> metadata. Flatten that transport-only layer
  // before applying the strict domain validation below.
  const entries = value.flatMap((entry) => Array.isArray(entry) ? entry : [entry]);
  return entries.map((entry, index): ResourceReferenceInput => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BadRequestException(`资源引用 ${index + 1} 格式无效`);
    }
    const item = entry as Record<string, unknown>;
    const kind = item.kind;
    const risk = item.risk;
    const ids = item.sharedEnvironmentIds;
    if (!RESOURCE_REFERENCE_KINDS.includes(kind as never)) {
      throw new BadRequestException(`资源引用 ${index + 1} 类型无效`);
    }
    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new BadRequestException(`资源引用 ${index + 1} 缺少 id`);
    }
    if (!RISKS.has(risk as ReferenceRisk)) {
      throw new BadRequestException(`资源引用 ${index + 1} 风险无效`);
    }
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
      throw new BadRequestException(`资源引用 ${index + 1} 缺少共享环境集合`);
    }
    if (typeof item.impact !== "string" || !item.impact.trim()) {
      throw new BadRequestException(`资源引用 ${index + 1} 缺少影响说明`);
    }
    return {
      kind: kind as ResourceReferenceInput["kind"],
      id: item.id,
      sharedEnvironmentIds: [...new Set(ids as string[])].sort(),
      risk: risk as ReferenceRisk,
      impact: item.impact.trim(),
    };
  });
}

export function normalizeRouteSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("域名与入口快照必须是对象");
  }
  const route = value as Record<string, unknown>;
  const domains = route.domains ?? [];
  if (!Array.isArray(domains) || !domains.every((item) => typeof item === "string")) {
    throw new BadRequestException("域名列表格式无效");
  }
  for (const key of ["dnsProvider", "proxyTarget"]) {
    if (route[key] !== undefined && typeof route[key] !== "string") {
      throw new BadRequestException(`${key} 必须是字符串`);
    }
  }
  if (route.tlsRequired !== undefined && typeof route.tlsRequired !== "boolean") {
    throw new BadRequestException("tlsRequired 必须是布尔值");
  }
  return {
    domains: [...new Set(domains.map((item) => item.trim()).filter(Boolean))].sort(),
    dnsProvider: route.dnsProvider ?? null,
    tlsRequired: route.tlsRequired ?? false,
    proxyTarget: route.proxyTarget ?? null,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function hashEnvironmentConfigSnapshot(snapshot: EnvironmentConfigSnapshot) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(snapshot)))
    .digest("hex");
}
