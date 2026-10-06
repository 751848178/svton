'use client';

import React, { useRef } from 'react';
import { Crosshair, Database, Key } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { SettingsEnvTab } from '../../utils/project-route.utils';

const ITEMS = [
  { key: 'targets', labelKey: 'envTabTargets', icon: Crosshair },
  { key: 'resources', labelKey: 'envTabResources', icon: Database },
  { key: 'variables', labelKey: 'envTabVariables', icon: Key },
] satisfies Array<{
  key: SettingsEnvTab;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill'; className?: string }>;
}>;

export function EnvironmentSettingsTablist(props: {
  tablistId: string;
  panelId: string;
  selected: SettingsEnvTab;
  onSelect: (tab: SettingsEnvTab) => void;
}) {
  const t = useTranslations('projects');
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const moveTo = (index: number) => {
    const next = ITEMS[index];
    if (!next) return;
    props.onSelect(next.key);
    itemRefs.current[index]?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = ITEMS.length - 1;
    const nextIndex = {
      ArrowRight: (index + 1) % ITEMS.length,
      ArrowDown: (index + 1) % ITEMS.length,
      ArrowLeft: (index - 1 + ITEMS.length) % ITEMS.length,
      ArrowUp: (index - 1 + ITEMS.length) % ITEMS.length,
      Home: 0,
      End: last,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    moveTo(nextIndex);
  };
  return (
    <>
      <label className="block lg:hidden">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('envTabMobileNavigationLabel')}
        </span>
        <select
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={props.selected}
          onChange={(event) => props.onSelect(event.target.value as SettingsEnvTab)}
        >
          {ITEMS.map(({ key, labelKey }) => (
            <option
              key={key}
              value={key}
            >
              {t(labelKey)}
            </option>
          ))}
        </select>
      </label>
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('envTabNavLabel')}
        className="hidden gap-1 lg:flex lg:flex-col"
      >
        {ITEMS.map(({ key, labelKey, icon: Icon }, index) => (
          <button
            key={key}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            id={`${props.tablistId}-${key}-tab`}
            type="button"
            role="tab"
            aria-selected={props.selected === key}
            aria-controls={props.panelId}
            tabIndex={props.selected === key ? 0 : -1}
            onClick={() => props.onSelect(key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={
              props.selected === key
                ? 'flex min-h-[39px] min-w-40 items-center gap-2.5 rounded-lg bg-primary/10 px-3 text-left text-xs font-semibold text-primary'
                : 'flex min-h-[39px] min-w-40 items-center gap-2.5 rounded-lg px-3 text-left text-xs text-foreground hover:bg-muted/50'
            }
          >
            <Icon
              size={16}
              weight={props.selected === key ? 'fill' : 'regular'}
              className="shrink-0"
            />
            {t(labelKey)}
          </button>
        ))}
      </div>
    </>
  );
}
