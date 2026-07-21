export function normalizeScheduleHour(hour: number, suffix?: string): number {
  if (suffix === 'pm' && hour < 12) return hour + 12;
  if (suffix === 'am' && hour === 12) return 0;
  return hour;
}
