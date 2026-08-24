/**
 * 发布详情 — 后端原文清洗/技术标识折叠纯函数。
 *
 * - ROD-5：门禁 reason 文案由后端拼接，可能内嵌 raw ISO 时间戳
 *   （如「证据已于 2026-08-17T09:11:21.126Z 过期」）。展示前统一替换为
 *   本地 `YYYY-MM-DD HH:mm`，防回归锚点即该原文。
 * - PX-3：evidenceRef 等证据串内嵌 25 位 cuid，展示层折叠为前 8 位 + …，
 *   完整值保留在 title / 原始证据里。
 * - PX-32：构建 errorCode 枚举映射为中文标题；超长字节数（≥1MB）人性化。
 */

import { formatIsoMinute } from './release-time.utils';

const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/g;
/** cuid 形态：固定 25 位小写字母数字混杂（c 开头），避免误伤普通单词。 */
const CUID = /\bc[a-z0-9]{24}\b/g;
/** 字节数文案：如「超过 262144000 字节上限」。 */
const BYTES = /(\d{7,})\s*字节/g;

/** ROD-5：把文案里的 raw ISO 时间戳替换为本地分钟精度时间；其余原文保留。 */
export function humanizeGateReason(text: string): string {
  return text.replace(ISO_TIMESTAMP, (match) => formatIsoMinute(match));
}

/** PX-3：把证据/描述串里的 25 位 cuid 折叠为前 8 位 + …。 */
export function foldTechnicalIds(text: string): string {
  return text.replace(CUID, (id) => `${id.slice(0, 8)}…`);
}

/** 组合清洗：时间戳本地化 + cuid 折叠 + 字节数人性化。 */
export function humanizeEvidenceText(text: string): string {
  return humanizeGateReason(foldTechnicalIds(humanizeByteCounts(text)));
}

/** PX-32 附带：错误文案中的原始大字节数转 MB/GB（≥1MB 才转）。 */
export function humanizeByteCounts(text: string): string {
  return text.replace(BYTES, (match, digits: string) => {
    const bytes = Number(digits);
    if (!Number.isFinite(bytes) || bytes < 1_000_000) return match;
    const mb = bytes / (1024 * 1024);
    return `${mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`}（${digits} 字节）`;
  });
}

/** PX-3：单值短 ID（cuid/长哈希折为前 8 位 + …，短值原样）。 */
export function shortTechnicalId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

/** PX-4：sha256 摘要统一 12 位短哈希（含前缀）。 */
export function shortDigest(digest: string | null | undefined): string {
  if (!digest) return '—';
  return digest.length > 19 ? `${digest.slice(0, 19)}…` : digest;
}

/** PX-32：构建 errorCode → 中文标题；未知枚举返回 null（调用方回退原文）。 */
export function buildErrorCodeTitle(code: string | null | undefined): string | null {
  const titles: Record<string, string> = {
    ARTIFACT_SECRET_CONTENT: '制品含疑似秘密内容',
    ARTIFACT_SECRET_FILE: '制品含敏感文件',
    ARTIFACT_UNSAFE_ENTRY: '制品含禁止条目',
    ARTIFACT_SIZE_LIMIT: '制品超出大小上限',
    BUILD_COMMAND_FAILED: '构建命令失败',
    BUILD_COMMAND_TIMEOUT: '构建命令超时',
    BUILD_COMMAND_CANCELED: '构建命令已取消',
    BUILD_COMMAND_OUTPUT_LIMIT: '构建输出超出上限',
  };
  if (!code) return null;
  return titles[code] ?? null;
}

/** PX-32：错误展示文案 = 中文标题 + 消息（字节数人性化）；未知枚举回退 `code: message`。 */
export function buildErrorText(
  code: string | null | undefined,
  message: string | null | undefined,
  fallback: string,
): string {
  const text = message || fallback;
  const title = buildErrorCodeTitle(code);
  return title ? `${title}：${humanizeByteCounts(text)}` : `${code}: ${text}`;
}

/** PX-3 附带：Provider/执行器 raw key 去版本后缀（local-filesystem-v1 → local-filesystem）。 */
export function providerKeyLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return key.replace(/-v\d+$/, '');
}
