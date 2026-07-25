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
 *  - `formatRelative`：相对时间，如 `刚刚` / `3 分钟前` / `2 小时前` / `5 天前`；
 *    超过 30 天回退绝对日期 `YYYY-MM-DD`
 *  - 空值统一返回 `'-'`
 */

const FULL_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const MINUTE_FORMAT = 'YYYY-MM-DD HH:mm';
const DATE_FORMAT = 'YYYY-MM-DD';

/** 相对时间回退为绝对日期的阈值（天）。 */
const RELATIVE_FALLBACK_DAYS = 30;

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

/** 相对时间分桶结果，供 UI 层按 i18n 翻译（避免工具层硬编码语言）。 */
export type RelativeTimeBucket =
  | { key: 'justNow' }
  | { key: 'minutes'; value: number }
  | { key: 'hours'; value: number }
  | { key: 'days'; value: number }
  | { key: 'date'; value: string };

/**
 * 把时间戳归入相对时间分桶（`刚刚` / `N 分钟前` / `N 小时前` / `N 天前` / 绝对日期）。
 *
 * 工具层只算分桶与数值，文案由 UI 层按 i18n key 翻译，保证 zh/en 同构。
 * 列表卡片「最近部署」场景用：一眼看出活跃度，无需精读绝对时间。
 * 超过 30 天回退为绝对日期（避免「365 天前」这类无意义文案）。
 * 空值返回 `null`（UI 自行决定回退文案）。
 */
export function formatRelative(value?: string | null): RelativeTimeBucket | null {
  if (!value) return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;

  const now = dayjs();
  const diffSeconds = now.diff(d, 'second');
  if (diffSeconds < 60) return { key: 'justNow' };

  const diffMinutes = now.diff(d, 'minute');
  if (diffMinutes < 60) return { key: 'minutes', value: diffMinutes };

  const diffHours = now.diff(d, 'hour');
  if (diffHours < 24) return { key: 'hours', value: diffHours };

  const diffDays = now.diff(d, 'day');
  if (diffDays < RELATIVE_FALLBACK_DAYS) return { key: 'days', value: diffDays };

  return { key: 'date', value: d.format(DATE_FORMAT) };
}
