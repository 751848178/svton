/**
 * 发布编排 — 时间格式化纯函数（F383）
 *
 * 单一职责：ISO 字符串 → 人类可读的中文时间/耗时。
 * 输入约定为后端返回的 ISO 8601 UTC 字符串（redact 后的 Date 已转 ISO）。
 */

/** 将 ISO 时间字符串格式化为本地可读时间；非法/空返回 '-'。 */
export function formatIso(dt?: string | null): string {
  if (!dt) return '-';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '-';
  // 用 en-CA 得到 YYYY-MM-DD HH:mm:ss 形式，对中文场景依然清晰可排序。
  const date = d.toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return date;
}

/**
 * 计算起止时间之间的耗时标签。
 * 未结束则按当前时间计算（进行中）。非法/缺省返回 null。
 */
export function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(endMs)) return null;
  const secs = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}
