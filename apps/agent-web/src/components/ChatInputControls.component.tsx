'use client';

import React from 'react';
import { useI18n } from '@svton/ui';

interface ChatInputControlsProps {
  modelSelector: React.ReactNode;
  sessionSettings: React.ReactNode;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
}

export function ChatInputControls({
  modelSelector,
  sessionSettings,
  plugins,
  onPluginToggle,
}: ChatInputControlsProps) {
  const { translate: t } = useI18n();
  return (
    <>
      {modelSelector}
      {sessionSettings}
      {plugins.length > 0 && (
        <details className="relative flex-shrink-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-[#333] bg-[#222] px-3 text-xs text-gray-400 hover:bg-[#333] hover:text-gray-200">
            {t('web.composer.plugins')}
          </summary>
          <div className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] py-1 shadow-xl">
            {plugins.map((plugin) => (
              <label key={plugin.name} className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs text-gray-400 hover:bg-[#2a2a2a]/60">
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  onChange={(event) => onPluginToggle(plugin.name, event.target.checked)}
                />
                <span className={plugin.enabled ? 'text-gray-200' : 'text-gray-500'}>
                  {plugin.name}
                </span>
              </label>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
