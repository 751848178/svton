import dayjs from 'dayjs';

/**
 * 统一的日期/时间格式化工具。
 *
 * 取代历史上散落在 9 个 feature 目录里各自复制粘贴的 `new Date(x).toLocaleString('zh-CN', {...})`
 * 实现（格式不一致：有的带秒、有的不带、空值处理各异）。
 *
 * 用 dayjs 保证跨浏览器/Node 的确定性输出（Intl.DateTimeFormat 在不同运行时可能产出不同结果）。
 *
 * 约定：
 *  - `formatDateTime`：完整日期时间（带秒），如 `2026-07-04 12:34:56`
 *  - `formatDateTimeMinute`：日期时间（不带秒），如 `2026-07-04 12:34`
 *  - `formatDate`：仅日期，如 `2026-07-04`
 *  - 空值统一返回 `'-'`
 */

const FULL_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const MINUTE_FORMAT = 'YYYY-MM-DD HH:mm';
const DATE_FORMAT = 'YYYY-MM-DD';

function safeFormat(value: string | null | undefined, format: string): string {
  if (!value) return '-';
  const d = dayjs(value);
  if (!d.isValid()) return value;
  return d.format(format);
}

/** 完整日期时间（带秒）。 */
export function formatDateTime(value?: string | null): string {
  return safeFormat(value, FULL_FORMAT);
}

/** 日期时间（不带秒）。 */
export function formatDateTimeMinute(value?: string | null): string {
  return safeFormat(value, MINUTE_FORMAT);
}

/** 仅日期。 */
export function formatDate(value?: string | null): string {
  return safeFormat(value, DATE_FORMAT);
}
