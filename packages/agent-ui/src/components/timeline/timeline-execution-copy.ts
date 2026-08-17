import type { TranslationKey, Translator } from '@svton/ui';
import type {
  CommandExecutionItemView,
  TimelineCopyTarget,
  ToolExecutionItemView,
} from './timeline.types';
import { timelineStatusKey } from './timeline-status-copy';

const FIELD_KEYS: Record<TimelineCopyTarget, TranslationKey> = {
  result: 'timeline.field.result',
  command: 'timeline.field.command',
  stdout: 'timeline.field.stdout',
  stderr: 'timeline.field.stderr',
  diagnostic: 'timeline.field.diagnostic',
  path: 'timeline.field.path',
  diff: 'timeline.field.diff',
};

export function executionTitle(
  item: ToolExecutionItemView | CommandExecutionItemView,
  translate: Translator,
): string {
  const status = translate(timelineStatusKey(item.status));
  return item.kind === 'commandExecution'
    ? translate('timeline.title.command', { status })
    : translate('timeline.title.tool', { tool: item.toolName, status });
}

export function approvalTitle(toolName: string, translate: Translator): string {
  return translate('timeline.title.approval', { tool: toolName });
}

export function copyTargetLabel(target: TimelineCopyTarget, translate: Translator): string {
  return translate('timeline.action.copyTarget', { target: translate(FIELD_KEYS[target]) });
}

export function durationLabel(
  durationMs: number,
  translate: Translator,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  if (durationMs < 1000) {
    return translate('timeline.field.durationMilliseconds', { value: formatNumber(durationMs) });
  }
  return translate('timeline.field.durationSeconds', {
    value: formatNumber(durationMs / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  });
}
