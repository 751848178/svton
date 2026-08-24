'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { ResourceBindingPreview } from './settings-resource-binding-preview.model';

export type ComponentOption = { key: string; label: string };

export function SettingsResourceBindingPreview({
  preview,
  components,
  onComponentChange,
  onTargetChange,
  confirmed,
  onConfirm,
}: {
  preview: ResourceBindingPreview;
  components: ComponentOption[];
  onComponentChange: (componentKey: string) => void;
  onTargetChange: (sourceKey: string, targetEnvKey: string) => void;
  confirmed?: boolean;
  onConfirm?: () => void;
}) {
  const t = useTranslations('projects');
  const legacy = preview.status === 'needs_configuration';
  return (
    <div className="space-y-2 rounded-md border bg-background p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{t('envResourceBindingPreview')}</span>
        <span className={preview.status === 'effective' ? 'text-green-700' : 'text-amber-700'}>
          {t(preview.status === 'effective'
            ? 'envResourceBindingEffective'
            : preview.status === 'needs_configuration'
              ? 'envResourceBindingNeedsConfiguration'
              : 'envResourceBindingDraft')}
        </span>
      </div>
      {legacy ? (
        <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
          {t('envResourceLegacyUnassigned')}
        </p>
      ) : null}
      <label className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
        <span className="text-muted-foreground">{t('envResourceSourceComponent')}</span>
        <Select
          value={preview.componentKey ?? ''}
          onChange={(event) => onComponentChange(event.target.value)}
          size="sm"
        >
          <option value="">{t('envResourceSelectComponent')}</option>
          {components.map((component) => (
            <option key={component.key} value={component.key}>{component.label}</option>
          ))}
        </Select>
      </label>
      <div className="space-y-1">
        <span className="text-muted-foreground">{t('envResourceVariableMappings')}</span>
        {preview.envBindings.length === 0 ? (
          <p>{t('envResourceNoTemplateKeys')}</p>
        ) : preview.envBindings.map((binding) => (
          <label
            key={binding.sourceKey}
            className="grid gap-1 sm:grid-cols-[1fr_20px_1fr] sm:items-center"
          >
            <code>{binding.sourceKey}</code>
            <span aria-hidden>→</span>
            <Input
              value={binding.targetEnvKey}
              onChange={(event) => onTargetChange(binding.sourceKey, event.target.value)}
              size="sm"
              className="font-mono"
              aria-label={`${binding.sourceKey} target`}
            />
          </label>
        ))}
      </div>
      {onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={!preview.componentKey || confirmed}
          className="rounded-md border px-2 py-1 disabled:opacity-50"
        >
          {t(confirmed ? 'envResourceMappingsConfirmed' : 'envResourceConfirmMappings')}
        </button>
      ) : null}
    </div>
  );
}
