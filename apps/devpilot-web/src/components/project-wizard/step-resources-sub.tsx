/** 项目向导资源步骤子组件。 */
'use client';

import { useTranslations } from 'next-intl';

import { Button, Input, Select } from '@/components/ui';
import type { DatabaseEngine, ResourceConfigMode } from '@/store/hooks';
import type {
  RegistryResourceType,
  StoredResource,
  ResourceInstance,
  ResourcePool,
} from './step-resources-types';

type WizardTranslator = ReturnType<typeof useTranslations<'projectWizard'>>;

export const modeLabelKeys: Record<string, string> = {
  manual: 'modeManual',
  credential: 'modeCredential',
  instance: 'modeInstance',
  pool: 'modePool',
  skipped: 'modeSkipped',
};

export const databaseEngines: DatabaseEngine[] = ['mysql', 'postgresql', 'sqlite'];

export function getDatabaseOptions(t: WizardTranslator) {
  return [
    { engine: 'mysql' as const, label: 'MySQL', description: t('dbMysqlDesc') },
    { engine: 'postgresql' as const, label: 'PostgreSQL', description: t('dbPostgresqlDesc') },
    { engine: 'sqlite' as const, label: 'SQLite', description: t('dbSqliteDesc') },
  ];
}

function DatabaseEngineSelector({
  value,
  onChange,
}: {
  value: DatabaseEngine;
  onChange: (engine: DatabaseEngine) => void;
}) {
  const t = useTranslations('projectWizard');
  const options = getDatabaseOptions(t);
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">{t('databaseEngine')}</label>
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <button
            key={option.engine}
            type="button"
            onClick={() => onChange(option.engine)}
            className={`rounded-lg border p-4 text-left transition-colors ${value === option.engine ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
          >
            <div className="font-medium">{option.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResourceConfigCard({
  resource,
  mode,
  storedResources,
  instances,
  pools,
  manualValues,
  credentialId,
  instanceId,
  poolId,
  onModeChange,
  onFieldChange,
  onCredentialChange,
  onInstanceChange,
  onPoolChange,
}: {
  resource: RegistryResourceType;
  mode: ResourceConfigMode;
  storedResources: StoredResource[];
  instances: ResourceInstance[];
  pools: ResourcePool[];
  manualValues: Record<string, string>;
  credentialId: string;
  instanceId: string;
  poolId: string;
  onModeChange: (mode: ResourceConfigMode) => void;
  onFieldChange: (field: string, value: string) => void;
  onCredentialChange: (id: string) => void;
  onInstanceChange: (id: string) => void;
  onPoolChange: (id: string) => void;
}) {
  const t = useTranslations('projectWizard');
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{resource.name}</h3>
          {resource.description && (
            <p className="text-sm text-muted-foreground">{resource.description}</p>
          )}
        </div>
        <Select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as ResourceConfigMode)}
          className="w-auto py-1.5 text-sm"
        >
          <option value="skipped">{t('modeSkipped')}</option>
          <option value="manual">{t('modeManual')}</option>
          <option value="credential">{t('modeCredential')}</option>
          <option value="instance">{t('modeInstance')}</option>
          <option value="pool">{t('modePool')}</option>
        </Select>
      </div>
      {mode === 'manual' && (
        <div className="mt-3 space-y-2">
          {resource.fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <Input
                type={field.type || 'text'}
                value={manualValues[field.key] ?? ''}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={field.default?.toString()}
              />
            </div>
          ))}
        </div>
      )}
      {mode === 'credential' && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">{t('selectCredential')}</label>
          <Select
            value={credentialId}
            onChange={(e) => onCredentialChange(e.target.value)}
          >
            <option value="">{t('pleaseSelect')}</option>
            {storedResources.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {mode === 'instance' && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">{t('selectInstance')}</label>
          <Select
            value={instanceId}
            onChange={(e) => onInstanceChange(e.target.value)}
          >
            <option value="">{t('pleaseSelect')}</option>
            {instances.map((i) => (
              <option
                key={i.id}
                value={i.id}
              >
                {i.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {mode === 'pool' && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">{t('selectPool')}</label>
          <Select
            value={poolId}
            onChange={(e) => onPoolChange(e.target.value)}
          >
            <option value="">{t('pleaseSelect')}</option>
            {pools.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {t('poolOption', { name: p.name, available: p.available })}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
          >
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function WizardActions({
  onPrev,
  onNext,
  nextDisabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  const t = useTranslations('projectWizard');
  return (
    <div className="flex justify-between pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onPrev}
      >
        {t('prev')}
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={onNext}
        disabled={nextDisabled}
      >
        {t('next')}
      </Button>
    </div>
  );
}

export { DatabaseEngineSelector, ResourceConfigCard, SelectField, WizardActions };
