'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectSecretKey } from '../../types';
import type {
  EnvironmentConfigRevision,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import { defaultSecretTargetKey, upsertSecretReference } from './settings-variable-binding.model';

export function SettingsSecretReferenceEditor({
  secrets,
  references,
  currentRevision,
  onChange,
}: {
  secrets: ProjectSecretKey[];
  references: EnvironmentConfigSecretReference[];
  currentRevision: EnvironmentConfigRevision | null;
  onChange: (next: EnvironmentConfigSecretReference[]) => void;
}) {
  const t = useTranslations('projects');
  const current = new Map((currentRevision?.secretReferences ?? []).map((item) => [
    item.id,
    item.targetEnvKey ?? defaultSecretTargetKey(item.name),
  ]));
  if (secrets.length === 0) return <p className="text-xs text-muted-foreground">{t('configNoSecrets')}</p>;
  return (
    <div className="space-y-2">
      {secrets.map((secret) => {
        const reference = references.find((item) => item.id === secret.id);
        const effective = Boolean(reference) && current.get(secret.id) === reference?.targetEnvKey;
        return (
          <div key={secret.id} className="grid gap-2 rounded-md border p-2 text-xs sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(reference)}
                onChange={(event) => onChange(event.target.checked
                  ? upsertSecretReference(references, {
                    id: secret.id,
                    targetEnvKey: defaultSecretTargetKey(secret.name),
                  })
                  : references.filter((item) => item.id !== secret.id))}
              />
              <span>{secret.name} · {secret.type}</span>
            </label>
            <input
              value={reference?.targetEnvKey ?? ''}
              disabled={!reference}
              onChange={(event) => onChange(upsertSecretReference(references, {
                id: secret.id,
                targetEnvKey: event.target.value,
              }))}
              placeholder={t('configSecretTargetKey')}
              aria-label={`${secret.name} target key`}
              className="rounded-md border bg-background px-2 py-1 font-mono disabled:opacity-50"
            />
            <span className={effective ? 'text-green-700' : 'text-amber-700'}>
              {t(effective ? 'configBindingEffective' : 'configBindingDraft')}
            </span>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">{t('configSecretReferenceHint')}</p>
    </div>
  );
}
