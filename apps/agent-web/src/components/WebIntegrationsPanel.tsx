'use client';

import React from 'react';
import type { AgentConfig } from '@svton/agent-core';
import { useI18n } from '@svton/ui';
import Link from 'next/link';

interface IntegrationSummary { id: string; name: string; description?: string; enabled: boolean }
interface IntegrationCapabilities { integrationManager?: { list?: () => IntegrationSummary[] } }
const manageClass = 'inline-flex min-h-11 items-center rounded text-[11px] text-cyan-500 hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function WebIntegrationsPanel({ config }: { config: AgentConfig }) {
  const { translate: t } = useI18n();
  const manager = (config.capabilities as typeof config.capabilities & IntegrationCapabilities)?.integrationManager;
  const integrations = manager?.list?.() ?? [];
  return (
    <section aria-labelledby="integrations-heading" className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <h2 id="integrations-heading" className="mb-4 text-lg font-light text-white">{t('web.integrations.title')}</h2>
      <p className="mb-4 text-[11px] text-gray-500">{t('web.integrations.description')}</p>
      {!manager ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <p className="text-sm text-gray-400">{t('web.integrations.unavailable')}</p>
          <Link href="/settings" className={manageClass}>{t('web.integrations.openSettings')}</Link>
        </div>
      ) : integrations.length === 0 ? <p className="text-sm text-gray-500">{t('web.integrations.empty')}</p> : (
        <div className="space-y-2">
          {integrations.map((integration) => (
            <div key={integration.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900 p-3">
              <div className="min-w-0"><span className="text-sm font-medium text-white">{integration.name}</span>
                {integration.description && <p className="mt-0.5 text-xs text-gray-500">{integration.description}</p>}
              </div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${integration.enabled ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                {t(integration.enabled ? 'web.integrations.enabled' : 'web.integrations.disabled')}
              </span>
            </div>
          ))}
          <Link href="/settings" className={manageClass}>{t('web.integrations.configure')}</Link>
        </div>
      )}
    </section>
  );
}
