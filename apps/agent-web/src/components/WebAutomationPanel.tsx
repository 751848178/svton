'use client';

import React from 'react';
import { useI18n } from '@svton/ui';

interface ToolDefinition { name: string; description?: string }

export function WebAutomationPanel({ tools }: { tools: ToolDefinition[] }) {
  const { translate: t } = useI18n();
  return (
    <section aria-labelledby="automation-heading" className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <h2 id="automation-heading" className="mb-4 text-lg font-light text-white">{t('web.automation.title')}</h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center sm:p-8">
        <p className="mb-2 text-sm text-gray-400">{t('web.automation.desktopRequired')}</p>
        <p className="text-xs text-gray-600">{t('web.automation.desktopDescription')}</p>
        <p className="mt-3 text-xs text-gray-500">{t(tools.length === 1 ? 'web.automation.toolCountOne' : 'web.automation.toolCount', { count: tools.length })}</p>
      </div>
    </section>
  );
}
