'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Button, LinkButton, PageHeader, ErrorBanner } from '@/components/ui';
import { useImportProject } from './hooks/use-import-project';
import {
  ScopeSection,
  BasicInfoSection,
  RepoStackSection,
  DeploySection,
  EnvironmentSection,
} from './components/import-form-sections';
import { ImportFlowProgress, IMPORT_STEP_COUNT } from './components/import-flow-progress.component';
import { ImportReview } from './components/import-review.component';

export default function ImportProjectPage() {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const { form, setForm, submitting, error, toggleEnvironment, submit } = useImportProject();
  const [step, setStep] = useState(0);

  const handleSubmit = usePersistFn(async (event: React.FormEvent<HTMLFormElement>) => {
    if (step < IMPORT_STEP_COUNT - 1) {
      event.preventDefault();
      if (canContinue(step, form)) setStep((current) => current + 1);
      return;
    }
    const projectId = await submit(event);
    if (projectId) router.push(`/projects/${projectId}`);
  });
  const continueDisabled = !canContinue(step, form);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t('importProjectTitle')}
        description={t('importProjectDescription')}
        actions={
          <Link
            href="/projects"
            className="link text-sm"
          >
            {t('backToProjects')}
          </Link>
        }
      />

      <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-4">
        <p className="font-medium">{t('importManualTruthTitle')}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t('importManualTruthDescription')}
        </p>
      </div>
      <ImportFlowProgress step={step} />

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {step === 0 ? (
          <>
            <ScopeSection
              form={form}
              onChange={setForm}
              onToggleEnvironment={toggleEnvironment}
            />
            <BasicInfoSection
              form={form}
              onChange={setForm}
              onToggleEnvironment={toggleEnvironment}
            />
          </>
        ) : null}
        {step === 1 ? (
          <RepoStackSection
            form={form}
            onChange={setForm}
            onToggleEnvironment={toggleEnvironment}
          />
        ) : null}
        {step === 2 ? (
          form.managementScope !== 'resources' ? (
            <DeploySection
              form={form}
              onChange={setForm}
              onToggleEnvironment={toggleEnvironment}
            />
          ) : (
            <div className="rounded-lg border p-5 text-sm text-muted-foreground">
              {t('importDeploySkippedForResources')}
            </div>
          )
        ) : null}
        {step === 3 ? (
          <EnvironmentSection
            form={form}
            onChange={setForm}
            onToggleEnvironment={toggleEnvironment}
          />
        ) : null}
        {step === 4 ? <ImportReview form={form} /> : null}

        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex justify-end gap-3">
          {step === 0 ? (
            <LinkButton
              href="/projects"
              variant="outline"
            >
              {tc('cancel')}
            </LinkButton>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((value) => value - 1)}
            >
              {tc('back')}
            </Button>
          )}
          <Button
            type={step === IMPORT_STEP_COUNT - 1 ? 'submit' : 'button'}
            variant="primary"
            loading={submitting}
            disabled={continueDisabled}
            onClick={
              step === IMPORT_STEP_COUNT - 1
                ? undefined
                : () => setStep((value) => Math.min(value + 1, IMPORT_STEP_COUNT - 1))
            }
          >
            {step === IMPORT_STEP_COUNT - 1
              ? submitting
                ? t('importing')
                : t('finishImport')
              : tc('next')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function canContinue(step: number, form: ReturnType<typeof useImportProject>['form']) {
  if (step === 0) return Boolean(form.name.trim());
  if (step === 1 && form.managementScope !== 'resources') return Boolean(form.gitRepo.trim());
  return true;
}
