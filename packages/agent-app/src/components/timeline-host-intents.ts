import type {
  TimelineHostIntent,
  TimelineHostIntentHandler,
  TimelineHostIntentResult,
} from '@svton/agent-ui';

type IntentOf<Type extends TimelineHostIntent['type']> = Extract<
  TimelineHostIntent,
  { type: Type }
>;

type TimelineHostActionResult =
  | void
  | TimelineHostIntentResult
  | Promise<void | TimelineHostIntentResult>;

export interface TimelineHostActions {
  copy?: (intent: IntentOf<'copy'>) => TimelineHostActionResult;
  retry?: (intent: IntentOf<'retry'>) => TimelineHostActionResult;
  open?: (intent: IntentOf<'open'>) => TimelineHostActionResult;
  openTerminal?: (intent: IntentOf<'openTerminal'>) => TimelineHostActionResult;
}

export function createTimelineHostIntentHandler(
  actions: TimelineHostActions,
): TimelineHostIntentHandler {
  return async (intent): Promise<TimelineHostIntentResult> => {
    const handler = actions[intent.type] as (
      (value: typeof intent) => TimelineHostActionResult
    ) | undefined;
    if (!handler) {
      return { status: 'unavailable' };
    }
    return await handler(intent) ?? { status: 'handled' };
  };
}
