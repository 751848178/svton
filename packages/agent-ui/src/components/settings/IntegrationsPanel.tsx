import React, { useEffect, useRef, useState } from 'react';
import { EyeIcon, EyeOffIcon, useI18n } from '@svton/ui';
import { SettingsSwitch } from './SettingsSwitch';
import { Badge, FieldLabel, INPUT_CLS } from './settings-ui';

export interface IntegrationAuthField { key: string; label: string; secret: boolean; placeholder?: string }
export interface IntegrationCardData {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  authFields: IntegrationAuthField[];
  credentials: Record<string, string>;
}
export interface IntegrationsPanelProps {
  integrations: IntegrationCardData[];
  onToggle: (id: string, enabled: boolean) => void;
  onCredentialChange: (id: string, key: string, value: string) => void;
}

export function IntegrationsPanel({ integrations, onToggle, onCredentialChange }: IntegrationsPanelProps) {
  const { translate: t } = useI18n();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const test = (id: string) => {
    setTestingId(id);
    timer.current = setTimeout(() => setTestingId(null), 1200);
  };
  return (
    <section aria-labelledby="integrations-heading">
      <h2 id="integrations-heading" className="text-lg font-medium text-white">{t('settings.integration.title')}</h2>
      <p className="mb-6 mt-1 text-xs text-gray-500">{t('settings.integration.description')}</p>
      {integrations.length === 0 ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] px-5 py-12 text-center text-sm text-gray-500"><p>{t('settings.integration.empty')}</p><p className="mt-1 text-xs">{t('settings.integration.emptyDescription')}</p></div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {integrations.map((integration) => <IntegrationCard key={integration.id} integration={integration} testing={testingId === integration.id} showSecrets={showSecrets} setShowSecrets={setShowSecrets} onToggle={onToggle} onCredentialChange={onCredentialChange} onTest={test} />)}
        </div>
      )}
    </section>
  );
}

function IntegrationCard({ integration, testing, showSecrets, setShowSecrets, onToggle, onCredentialChange, onTest }: {
  integration: IntegrationCardData;
  testing: boolean;
  showSecrets: Record<string, boolean>;
  setShowSecrets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onToggle: IntegrationsPanelProps['onToggle'];
  onCredentialChange: IntegrationsPanelProps['onCredentialChange'];
  onTest: (id: string) => void;
}) {
  const { translate: t } = useI18n();
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-[15px] font-semibold text-white">{integration.name}</h3><Badge color={integration.enabled ? 'green' : 'gray'}>{t(integration.enabled ? 'settings.integration.enabled' : 'settings.integration.disabled')}</Badge></div><SettingsSwitch checked={integration.enabled} onCheckedChange={(enabled) => onToggle(integration.id, enabled)} label={integration.name} /></div>
      <p className="mb-4 text-xs leading-5 text-gray-500">{integration.description}</p>
      {integration.authFields.map((field) => {
        const visibilityKey = `${integration.id}:${field.key}`;
        const visible = showSecrets[visibilityKey] ?? false;
        const inputId = `integration-${integration.id}-${field.key}`;
        return <div key={field.key} className="mb-3"><FieldLabel htmlFor={inputId}>{field.label}</FieldLabel><div className="relative"><input id={inputId} type={field.secret && !visible ? 'password' : 'text'} value={integration.credentials[field.key] ?? ''} placeholder={field.placeholder ?? ''} onChange={(event) => onCredentialChange(integration.id, field.key, event.target.value)} className={`${INPUT_CLS} ${field.secret ? 'pr-12' : ''}`} disabled={!integration.enabled} />{field.secret && <button type="button" aria-label={t(visible ? 'settings.integration.hideSecret' : 'settings.integration.showSecret', { label: field.label })} aria-pressed={visible} onClick={() => setShowSecrets((current) => ({ ...current, [visibilityKey]: !current[visibilityKey] }))} className="absolute right-0 top-0 inline-flex size-11 items-center justify-center text-gray-500 hover:text-gray-300">{visible ? <EyeOffIcon size={15} aria-hidden="true" /> : <EyeIcon size={15} aria-hidden="true" />}</button>}</div></div>;
      })}
      <button type="button" onClick={() => onTest(integration.id)} disabled={testing || !integration.enabled} className="mt-auto min-h-11 self-start rounded-lg border border-cyan-700 px-3 text-[11px] font-semibold text-cyan-400 disabled:opacity-50">{t(testing ? 'settings.integration.testing' : 'settings.integration.test')}</button>
    </article>
  );
}

export default IntegrationsPanel;
