/**
 * 阶段结构化输出解析：哨兵解码、schema 校验、脱敏。
 * 解析失败抛结构化错误，调用方据此将阶段判为 failed。
 */
import type { ReleaseStageOutput } from "../types/release-orchestration.types";
import {
  RELEASE_OUTPUT_MAX_BYTES,
  RELEASE_OUTPUT_SCHEMA_VERSION,
  RELEASE_OUTPUT_SENTINEL,
} from "../types/release-orchestration.types";
import { redactSecretsInObject, redactSecretsInText } from "./release-redact.utils";

export interface ParsedSentinelOutput {
  output: ReleaseStageOutput | null;
  cleanedText: string;
}

const ALLOWED_TOP_KEYS = new Set([
  "schemaVersion",
  "summary",
  "values",
  "metrics",
  "artifacts",
]);

// 从文本中抽取首个 @@DEVPILOT_OUTPUT@@ <base64url(json)> 哨兵行
export function parseOutputSentinel(raw: string): ParsedSentinelOutput {
  if (!raw || !raw.includes(RELEASE_OUTPUT_SENTINEL)) {
    return { output: null, cleanedText: redactSecretsInText(raw) };
  }
  const lines = raw.split(/\r?\n/);
  const remaining: string[] = [];
  let payload: ReleaseStageOutput | null = null;
  for (const line of lines) {
    const idx = line.indexOf(RELEASE_OUTPUT_SENTINEL);
    if (idx >= 0 && !payload) {
      const after = line.slice(idx + RELEASE_OUTPUT_SENTINEL.length).trim();
      payload = decodePayload(after);
      // 不回显原始哨兵行；记录已脱敏摘要
      remaining.push(`[已解析结构化输出]`);
    } else {
      remaining.push(line);
    }
  }
  return {
    output: payload,
    cleanedText: redactSecretsInText(remaining.join("\n")),
  };
}

function decodePayload(token: string): ReleaseStageOutput {
  if (!token) {
    throw new OutputParseError("结构化输出哨兵为空");
  }
  // token 长度早退：base64url token 永远 >= 解码后字节数，先挡一道便宜的检查。
  if (token.length > RELEASE_OUTPUT_MAX_BYTES) {
    throw new OutputParseError(
      `结构化输出超过 ${RELEASE_OUTPUT_MAX_BYTES} 字节上限`,
    );
  }
  let json: unknown;
  try {
    const decoded = Buffer.from(base64UrlToBase64(token), "base64").toString(
      "utf8",
    );
    // 解码后真实字节数上限（防止高压缩比的 base64 解码出超大 JSON）。
    if (Buffer.byteLength(decoded, "utf8") > RELEASE_OUTPUT_MAX_BYTES) {
      throw new OutputParseError(
        `结构化输出解码后超过 ${RELEASE_OUTPUT_MAX_BYTES} 字节上限`,
      );
    }
    json = JSON.parse(decoded);
  } catch (e) {
    if (e instanceof OutputParseError) throw e;
    throw new OutputParseError("结构化输出哨兵解码或 JSON 解析失败");
  }
  return validateOutputShape(json);
}

function base64UrlToBase64(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return padded + pad;
}

export class OutputParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputParseError";
  }
}

// 校验顶层结构；拒绝未知键、函数、Buffer、循环
export function validateOutputShape(input: unknown): ReleaseStageOutput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OutputParseError("结构化输出必须是对象");
  }
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      throw new OutputParseError(`结构化输出包含未知字段：${key}`);
    }
  }
  const schemaVersion = obj.schemaVersion;
  if (schemaVersion !== RELEASE_OUTPUT_SCHEMA_VERSION) {
    throw new OutputParseError(
      `结构化输出 schemaVersion 必须为 ${RELEASE_OUTPUT_SCHEMA_VERSION}`,
    );
  }
  if (obj.summary !== undefined && typeof obj.summary !== "string") {
    throw new OutputParseError("summary 必须是字符串");
  }
  if (obj.values !== undefined && !isPlainJsonSafe(obj.values)) {
    throw new OutputParseError("values 必须是 JSON 安全对象");
  }
  if (obj.metrics !== undefined) {
    if (typeof obj.metrics !== "object" || Array.isArray(obj.metrics)) {
      throw new OutputParseError("metrics 必须是对象");
    }
    for (const [k, v] of Object.entries(obj.metrics as object)) {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new OutputParseError(`metrics.${k} 必须是有限数字`);
      }
    }
  }
  if (obj.artifacts !== undefined) {
    if (!Array.isArray(obj.artifacts)) {
      throw new OutputParseError("artifacts 必须是数组");
    }
    for (const art of obj.artifacts) {
      if (!art || typeof art !== "object" || Array.isArray(art)) {
        throw new OutputParseError("artifacts 元素必须是对象");
      }
      if (typeof (art as { name?: unknown }).name !== "string") {
        throw new OutputParseError("artifacts 元素必须包含 name 字符串");
      }
    }
  }
  return obj as unknown as ReleaseStageOutput;
}

function isPlainJsonSafe(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  try {
    // 限定深度与类型；Buffer/函数会触发异常或被排除
    JSON.stringify(value);
  } catch {
    return false;
  }
  return true;
}

// 适配器返回的结构化输出统一脱敏后再持久化
export function sanitizeOutputForPersistence(
  output: ReleaseStageOutput | null | undefined,
): ReleaseStageOutput | null {
  if (!output) return null;
  const summary = output.summary
    ? redactSecretsInText(output.summary)
    : undefined;
  // values 既要按 key 敏感性脱敏，也要对字符串值内的连接串/PEM 脱敏
  const values = redactSecretsInObject(output.values);
  return {
    schemaVersion: output.schemaVersion,
    summary,
    values: values as Record<string, unknown> | undefined,
    metrics: output.metrics,
    // artifacts（如镜像 ref / 制品 URL）可能内嵌连接串密码，统一脱敏。
    artifacts: Array.isArray(output.artifacts)
      ? output.artifacts.map((a) => redactSecretsInObject(a))
      : output.artifacts,
  };
}
