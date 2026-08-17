'use client';

import React from 'react';
import type { AgentConfig } from '@svton/agent-core';
import { useI18n } from '@svton/ui';

export function WebAgentsPanel({ config }: { config: AgentConfig }) {
  const { translate: t } = useI18n();
  const manager = config.capabilities?.agentDefinitionManager;
  const agents = manager?.list() ?? [];
  return (
    <section aria-labelledby="agents-heading" className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <h2 id="agents-heading" className="mb-4 text-lg font-light text-white">{t('web.agents.title')}</h2>
      {!manager ? <p className="text-sm text-gray-500">{t('web.agents.unavailable')}</p> : agents.length === 0 ? (
        <p className="text-sm text-gray-500">{t('web.agents.empty')}</p>
      ) : (
        <div className="space-y-2">{agents.map((agent) => (
          <div key={agent.name} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <span className="text-sm font-medium text-white">{agent.title || agent.name}</span>
            {agent.description && <div className="mt-1 text-xs text-gray-500">{agent.description}</div>}
            {agent.model && <div className="mt-1 text-[10px] text-gray-600">{t('web.agents.modelLabel', { model: agent.model })}</div>}
          </div>
        ))}</div>
      )}
    </section>
  );
}
