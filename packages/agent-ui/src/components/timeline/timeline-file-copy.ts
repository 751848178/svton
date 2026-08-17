import type { TranslationKey, Translator } from '@svton/ui';
import type { FileOutcomeItemView } from './timeline.types';
import { timelineStatusKey } from './timeline-status-copy';

const CHANGE_KEYS: Record<FileOutcomeItemView['changes'][number]['changeType'], TranslationKey> = {
  create: 'block.file_change.create',
  modify: 'block.file_change.modify',
  delete: 'block.file_change.delete',
};

export function fileOutcomeTitle(
  item: FileOutcomeItemView,
  translate: Translator,
  formatNumber: (value: number) => string,
): string {
  const status = translate(timelineStatusKey(item.status));
  const count = item.changes.length;
  return count === 1
    ? translate('timeline.file.title.one', { status })
    : translate('timeline.file.title.many', { count: formatNumber(count), status });
}

export function fileOutcomeSummary(
  item: FileOutcomeItemView,
  translate: Translator,
  formatNumber: (value: number) => string,
): string {
  const first = item.changes[0];
  if (item.changes.length === 1 && first) {
    return translate('timeline.file.summary.one', {
      changeType: translate(CHANGE_KEYS[first.changeType]),
      path: first.path,
    });
  }
  return translate('timeline.file.summary.many', { count: formatNumber(item.changes.length) });
}

export function fileChangeTypeKey(
  changeType: FileOutcomeItemView['changes'][number]['changeType'],
): TranslationKey {
  return CHANGE_KEYS[changeType];
}
