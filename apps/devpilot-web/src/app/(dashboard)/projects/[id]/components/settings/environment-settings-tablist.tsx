'use client';

import React, { useRef } from 'react';
import { Cube, Crosshair, Heartbeat, Key, LinkSimple, Lock } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { SettingsEnvTab } from '../../utils/project-route.utils';

const ITEMS: Array<{ key: SettingsEnvTab; labelKey: string }> = [
  { key: 'versions', labelKey: 'envTabVersions' },
  { key: 'targets', labelKey: 'envTabTargets' },
  { key: 'resources', labelKey: 'envTabResources' },
  { key: 'variables', labelKey: 'envTabVariables' },
  { key: 'access', labelKey: 'envTabAccess' },
  { key: 'verification', labelKey: 'envTabVerification' },
];

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
        className="hidden gap-1 border-r pr-5 lg:flex lg:flex-col"
      >
        {ITEMS.map(({ key, labelKey }, index) => (
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
                ? 'flex min-h-11 min-w-40 items-center gap-3 rounded-md border-l-2 border-primary bg-primary/10 px-3 text-left text-sm font-medium text-primary'
                : 'flex min-h-11 min-w-40 items-center gap-3 rounded-md border-l-2 border-transparent px-3 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground'
            }
          >
            <TabIcon tab={key} />
            {t(labelKey)}
          </button>
        ))}
      </div>
    </>
  );
}

function TabIcon({ tab }: { tab: SettingsEnvTab }) {
  const props = { size: 18, 'aria-hidden': true } as const;
  switch (tab) {
    case 'versions':
      return <Cube {...props} />;
    case 'targets':
      return <Crosshair {...props} />;
    case 'resources':
      return <LinkSimple {...props} />;
    case 'variables':
      return <Key {...props} />;
    case 'access':
      return <Lock {...props} />;
    case 'verification':
      return <Heartbeat {...props} />;
  }
}
