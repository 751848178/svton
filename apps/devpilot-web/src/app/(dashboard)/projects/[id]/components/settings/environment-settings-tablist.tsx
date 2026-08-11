'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { SettingsEnvTab } from '../../utils/project-route.utils';

const ENV_TAB_KEYS: Array<{ key: SettingsEnvTab; labelKey: string }> = [
  { key: 'targets', labelKey: 'envTabTargets' },
  { key: 'resources', labelKey: 'envTabResources' },
  { key: 'variables', labelKey: 'envTabVariables' },
  { key: 'routes', labelKey: 'envTabRoutes' },
  { key: 'protection', labelKey: 'envTabProtection' },
];

export function EnvironmentSettingsTablist(props: {
  tablistId: string;
  panelId: string;
  selected: SettingsEnvTab;
  onSelect: (tab: SettingsEnvTab) => void;
}) {
  const t = useTranslations('projects');
  const selectFromKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const nextIndex = keyboardTarget(event.key, index, ENV_TAB_KEYS.length);
    if (nextIndex === null) return;
    event.preventDefault();
    const next = ENV_TAB_KEYS[nextIndex];
    if (!next) return;
    props.onSelect(next.key);
    document.getElementById(`${props.tablistId}-${next.key}-tab`)?.focus();
  };
  return (
    <div role="tablist" aria-label={t('envTabNavLabel')} className="flex flex-wrap gap-1 border-b">
      {ENV_TAB_KEYS.map(({ key, labelKey }, index) => (
        <button
          key={key}
          id={`${props.tablistId}-${key}-tab`}
          type="button"
          role="tab"
          tabIndex={props.selected === key ? 0 : -1}
          aria-selected={props.selected === key}
          aria-controls={props.panelId}
          onClick={() => props.onSelect(key)}
          onKeyDown={(event) => selectFromKeyboard(event, index)}
          className={
            props.selected === key
              ? 'border-b-2 border-primary px-3 py-1.5 text-xs font-medium text-primary'
              : 'px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground'
          }
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}

function keyboardTarget(key: string, index: number, length: number) {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length;
  return null;
}
