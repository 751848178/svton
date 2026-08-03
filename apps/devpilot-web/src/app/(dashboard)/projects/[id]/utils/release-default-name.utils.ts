/**
 * 发布默认名称。
 *
 * 单一职责：用浏览器本地时间生成稳定、可读且不含时区歧义的发布名称。
 */
export function buildReleaseDefaultName(now = new Date()): string {
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  return `release-${year}-${month}-${day}-${hour}${minute}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
