import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';

const CHOICES = {
  type: ['frontend_site', 'backend_service', 'worker', 'shared_package', 'service'],
  buildOutput: ['oci_image', 'static_bundle', 'runtime_bundle', 'none'],
  runMethod: ['container', 'static_site', 'process', 'worker'],
} as const;

export function RepositoryIntakeComponents({ intake }: { intake: ProjectIntakeHook }) {
  const t = useTranslations('projects');
  return (
    <section className="space-y-3" aria-labelledby="intake-components-title">
      <div><h3 id="intake-components-title" className="font-semibold">{t('intakeComponentsTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('intakeComponentsHint')}</p></div>
      {intake.contract?.components.map((component) => {
        const review = intake.reviewItems.find((item) => item.suggestionId === component.suggestionId);
        const display = { ...component.value, ...review?.overrides };
        return (
          <article key={component.suggestionId} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{display.name}</strong>
              <Select
                disabled={intake.reviewLocked}
                className="w-36"
                value={review?.decision ?? component.decision ?? 'accept'}
                onChange={(event) => intake.updateReviewDecision(component.suggestionId, event.target.value as 'accept' | 'edit' | 'reject')}
                options={['accept', 'edit', 'reject'].map((value) => ({ label: t(`intakeDecision${capitalize(value)}`), value }))}
              />
            </div>
            {(review?.decision ?? component.decision) === 'reject' ? <p className="text-sm text-muted-foreground">{t('intakeComponentRejected')}</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <TextField disabled={intake.reviewLocked} label={t('intakeComponentName')} value={display.name} onChange={(value) => intake.updateReviewOverride(component.suggestionId, 'name', value)} />
                <TextField disabled={intake.reviewLocked} label={t('intakeComponentPath')} value={display.path} onChange={(value) => intake.updateReviewOverride(component.suggestionId, 'path', value)} />
                {(Object.keys(CHOICES) as Array<keyof typeof CHOICES>).map((field) => (
                  <label key={field} className="space-y-1 text-sm font-medium"><span>{t(`intakeComponent${capitalize(field)}`)}</span>
                    <Select disabled={intake.reviewLocked} value={String(display[field])} onChange={(event) => intake.updateReviewOverride(component.suggestionId, field, event.target.value)}
                      options={CHOICES[field].map((value) => ({ label: t(`intakeValue${pascal(value)}`), value }))} />
                  </label>
                ))}
              </div>
            )}
            {component.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
          </article>
        );
      })}
    </section>
  );
}

function TextField(props: { disabled: boolean; label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-sm font-medium"><span>{props.label}</span><Input disabled={props.disabled} value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}
function capitalize(value: string) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function pascal(value: string) { return value.split('_').map(capitalize).join(''); }
