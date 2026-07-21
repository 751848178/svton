export function normalizeEventTriggerName(schedule: string): string {
  return schedule.replace(/^on\s+/, '').replace(/\s+/g, '_');
}
