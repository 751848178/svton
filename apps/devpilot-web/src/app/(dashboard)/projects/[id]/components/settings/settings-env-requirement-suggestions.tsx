'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectSecretKey } from '../../types';
import type { EnvironmentRequirementSuggestion } from './settings-env-requirements.model';

type Props = {
  suggestions: EnvironmentRequirementSuggestion[];
  plainKeys: Set<string>;
  secrets: ProjectSecretKey[];
  selectedSecretIds: Set<string>;
  onUsePlain: (key: string) => void;
  onUseSecret: (id: string, targetEnvKey: string) => void;
};

export function SettingsEnvRequirementSuggestions(props: Props) {
  const t = useTranslations('projects');
  const [secretChoice, setSecretChoice] = useState<Record<string, string>>({});
  if (props.suggestions.length === 0) return null;
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <div>
        <h4 className="text-xs font-semibold">{t('intakeSuggestions')}</h4>
        <p className="text-[11px] text-muted-foreground">{t('intakeReviewDescription')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5">{t('envVarsTableKey')}</th>
              <th>{t('envVarsTableScope')}</th>
              <th>{t('envVarsTableRequirement')}</th>
              <th>{t('releaseGateEvidenceLabel')}</th>
              <th>{t('envVarsTableSource')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.suggestions.map((suggestion) => {
              const choice = secretChoice[suggestion.key] ?? props.secrets[0]?.id ?? '';
              return (
                <tr key={`${suggestion.serviceId}:${suggestion.key}`}>
                  <td className="py-2 font-mono">{suggestion.key}</td>
                  <td>{suggestion.component}</td>
                  <td>{t(suggestion.required ? 'envVarsRequirementRequired' : 'envVarsRequirementOptional')}</td>
                  <td>{suggestion.evidence.map((item) => item.file).join(', ') || '—'}</td>
                  <td className="space-y-1 py-2">
                    <button
                      type="button"
                      disabled={props.plainKeys.has(suggestion.key)}
                      onClick={() => props.onUsePlain(suggestion.key)}
                      className="rounded border px-2 py-1 disabled:opacity-50"
                    >
                      {t('envVarsSourcePlain')}
                    </button>
                    <div className="flex gap-1">
                      <select
                        value={choice}
                        onChange={(event) => setSecretChoice((current) => ({
                          ...current, [suggestion.key]: event.target.value,
                        }))}
                        className="min-w-0 rounded border bg-background px-1"
                      >
                        {props.secrets.map((secret) => (
                          <option key={secret.id} value={secret.id}>{secret.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!choice || props.selectedSecretIds.has(choice)}
                        onClick={() => props.onUseSecret(choice, suggestion.key)}
                        className="rounded border px-2 py-1 disabled:opacity-50"
                      >
                        {t('envVarsSourceSecret')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
