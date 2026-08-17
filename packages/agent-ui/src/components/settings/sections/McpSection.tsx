import React from 'react';
import { cn, useI18n } from '@svton/ui';
import type { McpSectionProps } from './mcp-section.types';
import { McpConfiguredServers } from './McpConfiguredServers';
import { McpMarketplace } from './McpMarketplace';
import { useMcpSection } from './use-mcp-section';

export function McpSection(props: McpSectionProps) {
  const { translate: t } = useI18n();
  const model = useMcpSection(props);
  return (
    <section aria-labelledby="mcp-settings-heading">
      <h2 id="mcp-settings-heading" className="text-lg font-medium text-white">{t('settings.mcp.title')}</h2>
      <p className="mt-0.5 text-xs text-gray-500">{t('settings.mcp.description')}</p>
      <div role="tablist" aria-label={t('settings.mcp.tabs')} className="mb-4 mt-4 flex border-b border-[#383838]">
        {(['config', 'market'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={model.tab === tab} onClick={() => model.setTab(tab)} className={cn('min-h-11 border-b-2 px-3 text-[12px]', model.tab === tab ? 'border-cyan-500 text-white' : 'border-transparent text-gray-500')}>{t(tab === 'config' ? 'settings.mcp.configured' : 'settings.mcp.market')}</button>)}
      </div>
      {model.tab === 'config' ? <McpConfiguredServers props={props} model={model} /> : <McpMarketplace model={model} />}
    </section>
  );
}
