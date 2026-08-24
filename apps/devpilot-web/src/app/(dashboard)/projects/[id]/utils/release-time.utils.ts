/**
 * 发布编排 — 时间格式化纯函数（F383）
 *
 * 单一职责：ISO 字符串 → 人类可读的中文时间/耗时。
 * 输入约定为后端返回的 ISO 8601 UTC 字符串（redact 后的 Date 已转 ISO）。
 *
 * PX-11：全站统一 `YYYY-MM-DD HH:mm:ss`（详情）/ `YYYY-MM-DD HH:mm`（列表摘要），
 * 不再经由 toLocaleString 产出 `2026-08-10, 18:05:41`（带逗号）或 `2026/8/24 12:58:58`（斜杠不补零）。
 */

/** 将 ISO 时间字符串格式化为本地可读时间；非法/空返回 '-'。 */
export function formatIso(dt?: string | null): string {
  return formatWith(dt, 'YYYY-MM-DD HH:mm:ss');
}

/** 列表/摘要用分钟精度时间；非法/空返回 '-'。 */
export function formatIsoMinute(dt?: string | null): string {
  return formatWith(dt, 'YYYY-MM-DD HH:mm');
}

function formatWith(
  dt: string | null | undefined,
  pattern: 'YYYY-MM-DD HH:mm:ss' | 'YYYY-MM-DD HH:mm',
) {
  if (!dt) return '-';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}${
    pattern.endsWith(':ss') ? `:${pad(d.getSeconds())}` : ''
  }`;
  return `${date} ${time}`;
}

/**
 * 计算起止时间之间的耗时标签。
 * 未结束则按当前时间计算（进行中）。非法/缺省返回 null。
 * PX-36：起止相同（0 秒）显示 `<1s`，避免「0s」违反直觉。
 */
export function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(endMs)) return null;
  const secs = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (secs === 0) return '<1s';
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}
