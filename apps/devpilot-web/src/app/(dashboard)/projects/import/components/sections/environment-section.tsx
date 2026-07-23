/**
 * 环境分区
 *
 * 单一职责：渲染环境多选（至少保留 1 个）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { ENVIRONMENT_OPTIONS } from '../../types';
import { SectionShell, type SectionProps } from './import-section-primitives';

export function EnvironmentSection({
  form,
  onToggleEnvironment,
}: SectionProps) {
  const tw = useTranslations('projectWizard');
  const tp = useTranslations('projects');
  const atMinimum = form.environments.length <= 1;
  const minHint = tp('keepAtLeastOneEnvironment');
  return (
    <SectionShell
      id="environment"
      title={tw('environmentSectionTitle')}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {ENVIRONMENT_OPTIONS.map((environment) => {
          const checked = form.environments.includes(environment.id);
          const blocked = atMinimum && checked;
          return (
            <label
              key={environment.id}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'hover:bg-accent'} ${blocked ? 'opacity-60' : ''}`}
              title={blocked ? minHint : undefined}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleEnvironment(environment.id)}
                disabled={blocked}
                className="h-4 w-4"
              />
              <span className="text-sm">{environment.label}</span>
            </label>
          );
        })}
      </div>
      {atMinimum ? (
        <p className="mt-3 text-xs text-muted-foreground">{minHint}</p>
      ) : null}
    </SectionShell>
  );
}
