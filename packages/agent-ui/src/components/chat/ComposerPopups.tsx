import { cn, useI18n } from '@svton/ui';
import type { MentionItem, SlashCommand } from './composer.types';
import type { ComposerPopupPosition } from './use-composer-popup-position';

export function SlashCommandPopup({ id, itemId, commands, selected, position, onSelect, onHover }: {
  id: string;
  itemId: (index: number) => string;
  commands: SlashCommand[];
  selected: number;
  position: ComposerPopupPosition;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
}) {
  const { translate: t } = useI18n();
  if (!commands.length) return null;
  return (
    <div
      role="listbox"
      id={id}
      aria-label={t('chat.commands')}
      data-popup-placement={position.placement}
      style={{
        position: 'fixed', left: position.left, top: position.top,
        bottom: position.bottom, width: position.width, maxHeight: position.maxHeight, zIndex: 9999,
      }}
      className="overflow-y-auto rounded-xl border border-[#383838] bg-[#2a2a2a] py-1 shadow-xl"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">{t('chat.commands')}</div>
      {commands.map((command, index) => {
        const unsupported = command.capability?.supported === false || (!command.execute && !command.action);
        return (
          <button
            id={itemId(index)}
            role="option"
            aria-selected={index === selected}
            key={command.id ?? command.name}
            type="button"
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(command)}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors',
              index === selected ? 'bg-[#333]' : 'hover:bg-[#303030]',
            )}
          >
            <span className="flex-shrink-0 font-mono text-xs text-cyan-500">/{command.name}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{command.description}</span>
            {unsupported && <span className="text-[10px] text-amber-300">{t('chat.command.unsupported')}</span>}
          </button>
        );
      })}
    </div>
  );
}

type MentionGroup = NonNullable<MentionItem['category']> | 'reference';
const MENTION_GROUP_ORDER: MentionGroup[] = ['reference', 'file', 'folder', 'tool', 'skill'];

const CATEGORY_KEYS = {
  reference: 'chat.attachment.reference', file: 'chat.attachment.file',
  folder: 'chat.attachment.folder', tool: 'chat.attachment.tool', skill: 'chat.attachment.skill',
} as const;

export function MentionPopup({ id, itemId, items, selected, position, onSelect, onHover }: {
  id: string;
  itemId: (index: number) => string;
  items: MentionItem[];
  selected: number;
  position: ComposerPopupPosition;
  onSelect: (item: MentionItem) => void;
  onHover: (index: number) => void;
}) {
  const { translate: t } = useI18n();
  if (!items.length) return null;
  return (
    <div
      role="listbox"
      id={id}
      aria-label={t('chat.attachment.referenceTitle')}
      data-popup-placement={position.placement}
      style={{
        position: 'fixed', left: position.left, top: position.top,
        bottom: position.bottom, width: position.width, maxHeight: position.maxHeight, zIndex: 9999,
      }}
      className="overflow-y-auto rounded-xl border border-[#383838] bg-[#2a2a2a] py-1 shadow-xl"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {groupMentions(items).map(([category, grouped]) => (
        <div key={category} role="group" aria-label={t(CATEGORY_KEYS[category])}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500">{t(CATEGORY_KEYS[category])}</div>
          {grouped.map(({ item, index }) => (
            <button
              id={itemId(index)}
              role="option"
              aria-selected={index === selected}
              key={item.id ?? `legacy:${item.label}:${index}`}
              type="button"
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(item)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                index === selected ? 'bg-[#333]' : 'hover:bg-[#303030]',
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="max-w-[160px] flex-shrink-0 truncate text-xs text-gray-200">{item.label}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-gray-500">{item.path ?? item.description}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupMentions(items: MentionItem[]) {
  return MENTION_GROUP_ORDER.flatMap((category) => {
    const grouped = items.flatMap((item, index) => mentionGroup(item) === category ? [{ item, index }] : []);
    return grouped.length ? [[category, grouped] as const] : [];
  });
}

function mentionGroup(item: MentionItem): MentionGroup {
  return item.id && item.name && item.path && item.category ? item.category : 'reference';
}

export function orderMentionItems(items: MentionItem[]): MentionItem[] {
  return items
    .map((item, index) => ({ item, index, group: mentionGroup(item) }))
    .sort((left, right) => MENTION_GROUP_ORDER.indexOf(left.group) - MENTION_GROUP_ORDER.indexOf(right.group)
      || left.index - right.index)
    .map(({ item }) => item);
}
