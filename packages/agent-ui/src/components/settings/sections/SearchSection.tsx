import React from 'react';
import { useI18n } from '@svton/ui';
import { Card, FieldLabel, INPUT_CLS } from '../settings-ui';

export function SearchSection({ endpoint, onChange, onSave, apiKey, onApiKeyChange, onSaveApiKey }: {
  endpoint: string;
  onChange: (value: string) => void;
  onSave: () => void;
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
  onSaveApiKey?: () => void;
}) {
  const { translate: t } = useI18n();
  return (
    <section aria-labelledby="search-settings-heading">
      <h2 id="search-settings-heading" className="text-lg font-medium text-white">{t('settings.search.title')}</h2><p className="mb-6 mt-1 text-xs text-gray-500">{t('settings.search.description')}</p>
      {onApiKeyChange && onSaveApiKey && <Card className="mb-4"><FieldLabel htmlFor="tavily-key">{t('settings.search.tavilyKey')}</FieldLabel><input id="tavily-key" type="password" value={apiKey ?? ''} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="tvly-..." className={INPUT_CLS} /><p className="mt-2 text-[10px] text-gray-600">{t('settings.search.keyHelp')} <a href="https://tavily.com" target="_blank" rel="noreferrer" className="text-cyan-500 hover:underline">tavily.com</a></p><button onClick={onSaveApiKey} className="mt-3 min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white">{t('settings.search.saveKey')}</button></Card>}
      <Card><FieldLabel htmlFor="search-endpoint">{t('settings.search.endpoint')}</FieldLabel><input id="search-endpoint" type="url" value={endpoint} onChange={(event) => onChange(event.target.value)} placeholder="https://your-searxng-instance.com/search?format=json" className={INPUT_CLS} /><p className="mt-2 text-[10px] text-gray-600">{t('settings.search.endpointHelp')}</p><button onClick={onSave} className="mt-3 min-h-11 rounded-lg bg-cyan-600 px-3 text-[11px] font-medium text-white">{t('settings.search.saveEndpoint')}</button></Card>
    </section>
  );
}
