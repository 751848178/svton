'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner, PageHeader } from '@/components/ui';
import { ConnectRepositoryStep } from './components/connect-repository-step';
import { FinalizeBaselineStep } from './components/finalize-baseline-step';
import { ProjectIntakeStepper } from './components/project-intake-stepper';
import { ReviewAnalysisStep } from './components/review-analysis-step';
import { useProjectIntake } from './hooks/use-project-intake';
import { projectIntakeCredentialReady } from './project-intake-repository-input';

export default function CreateProjectPage() {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const intake = useProjectIntake();
  const credentialReady = projectIntakeCredentialReady(intake.form);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (intake.step === 1) {
      await intake.connectAndAnalyze();
      return;
    }
    if (intake.step === 2) {
      await intake.confirmAnalysis();
      return;
    }
    const result = await intake.finalize();
    if (result) router.push(`/projects/${result.projectId}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('intakeTitle')}
        description={t('intakeDescription')}
        actions={
          <Link
            href="/projects"
            className="link text-sm"
          >
            {t('intakeCancel')}
          </Link>
        }
      />
      <ProjectIntakeStepper step={intake.step} />
      <form
        onSubmit={(event) => void submit(event)}
        className="rounded-lg border bg-card"
      >
        <div className="p-5 sm:p-6">
          {intake.step === 1 ? <ConnectRepositoryStep intake={intake} /> : null}
          {intake.step === 2 ? <ReviewAnalysisStep intake={intake} /> : null}
          {intake.step === 3 ? <FinalizeBaselineStep intake={intake} /> : null}
          {intake.error ? (
            <div
              className="mt-5"
              role="alert"
            >
              <ErrorBanner message={intake.error} />
            </div>
          ) : null}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
          <span className="text-sm text-muted-foreground">
            {t('intakeStepProgress', { step: intake.step })}
          </span>
          <div className="flex gap-3">
            {intake.step > 1 ? (
              <Button
                className="min-h-11"
                type="button"
                variant="outline"
                disabled={intake.mutating}
                onClick={() => intake.setStep(intake.step - 1)}
              >
                {tc('back')}
              </Button>
            ) : null}
            <Button
              className="min-h-11"
              type="submit"
              variant="primary"
              loading={intake.mutating}
              disabled={
                intake.mutating ||
                (intake.step === 1 && (!intake.form.repositoryUrl.trim() || !credentialReady)) ||
                (intake.step === 2 && !intake.reviewReady)
              }
            >
              {intake.step === 1
                ? t('intakeConnectAndAnalyze')
                : intake.step === 2
                  ? t('intakeConfirmRecognition')
                  : t('intakeCreateBaselines')}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
