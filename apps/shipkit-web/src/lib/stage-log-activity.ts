import type { Stage, StageKey, TaskDetail, TaskEvent } from './contracts';

export function inLogScope(value: { stageKey?: StageKey | null; serviceKey?: string | null }, stage: StageKey, service: string): boolean {
  return value.stageKey === stage && (!service || !value.serviceKey || value.serviceKey === service);
}

export function logStages(detail: TaskDetail, stage: StageKey, service: string): Stage[] {
  return detail.stages.filter(value => inLogScope(value, stage, service));
}

export function latestLogStages(stages: Stage[]): Stage[] {
  const latest = new Map<string, Stage>();
  for (const stage of stages) {
    const key = stage.serviceKey || '';
    if ((stage.attempt ?? 1) >= (latest.get(key)?.attempt ?? 0)) latest.set(key, stage);
  }
  const values = [...latest.values()];
  return values.some(value => value.serviceKey) ? values.filter(value => value.serviceKey) : values;
}

// Cursor updates and polling snapshots are evidence, not additional log messages.
export function activityMessages(events: TaskEvent[]): Array<TaskEvent & { occurrences: number }> {
  const messages = new Map<string, TaskEvent & { occurrences: number }>();
  for (const event of events) {
    if (!event.message?.trim() || ['log', 'remote-job', 'remote-event', 'remote-intent', 'stage'].includes(event.type)) continue;
    const key = JSON.stringify([event.type, event.serviceKey, event.status, event.message.trim()]);
    const previous = messages.get(key);
    messages.set(key, { ...event, occurrences: (previous?.occurrences ?? 0) + 1 });
  }
  return [...messages.values()].sort((a, b) => a.seq - b.seq);
}
