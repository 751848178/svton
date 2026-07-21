'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';
import { download } from '@/lib/api-client/stream';
import { StepBasicInfo } from '@/components/project-wizard/step-basic-info';
import { StepSubProjects } from '@/components/project-wizard/step-sub-projects';
import { StepFeatures } from '@/components/project-wizard/step-features';
import { StepResources } from '@/components/project-wizard/step-resources';
import { StepPreview } from '@/components/project-wizard/step-preview';
import { isValidPackageName } from '@/components/project-wizard/package-name';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'basic', titleKey: 'stepBasicInfo', component: StepBasicInfo },
  { id: 'subprojects', titleKey: 'stepSubProjects', component: StepSubProjects },
  { id: 'features', titleKey: 'stepFeatures', component: StepFeatures },
  { id: 'resources', titleKey: 'stepResources', component: StepResources },
  { id: 'preview', titleKey: 'stepPreview', component: StepPreview },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const t = useTranslations('projects');
  const { currentStep, setCurrentStep, config, reset } = useProjectConfigStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleNext = usePersistFn(() => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  });
  const handlePrev = usePersistFn(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  });

  // 跳步门：只允许回退到已完成步骤，或前进到当前步骤的下一步；
  // 基础信息（包名/项目名）校验通过前不允许进入第 2-5 步。
  const basicInfoValid = isValidPackageName(config.basicInfo.name);
  const maxSelectableStep = basicInfoValid
    ? Math.min(currentStep + 1, STEPS.length - 1)
    : currentStep;
  const handleSelectStep = usePersistFn((index: number) => {
    if (index <= maxSelectableStep) setCurrentStep(index);
  });

  const handleSubmit = usePersistFn(async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      // generate 返回二进制 ZIP，已由后端 excludePaths 排除信封，用 download 直连
      const response = await download('/projects/generate', {
        method: 'POST',
        body: config,
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.basicInfo.name || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const projectId = response.headers.get('X-Project-Id');
      reset();
      router.push(projectId ? `/projects/${projectId}` : '/projects');
    } catch (error) {
      console.error('Error generating project:', error);
      setSubmitError(t('generateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  });

  const StepContent = STEPS[currentStep].component;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('createNew')}
        description={t('createNewDescription')}
        actions={
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('backToProjects')}
          </Link>
        }
      />

      <StepIndicator
        steps={STEPS.map(({ id, titleKey }) => ({ id, title: t(titleKey) }))}
        current={currentStep}
        maxSelectable={maxSelectableStep}
        onSelect={handleSelectStep}
      />

      {submitError ? (
        <ErrorBanner
          message={submitError}
          className="mb-4"
        />
      ) : null}

      <div className="rounded-lg border bg-card p-6">
        <StepContent
          onNext={handleNext}
          onPrev={handlePrev}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}

function StepIndicator({
  steps,
  current,
  maxSelectable,
  onSelect,
}: {
  steps: Array<{ id: string; title: string }>;
  current: number;
  maxSelectable: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex items-center"
          >
            <button
              onClick={() => onSelect(index)}
              disabled={index > maxSelectable}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                index === current
                  ? 'bg-primary text-primary-foreground'
                  : index < current
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {index + 1}
            </button>
            <span
              className={cn(
                'ml-2 text-sm font-medium',
                index === current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.title}
            </span>
            {index < steps.length - 1 ? (
              <div className={cn('mx-4 h-0.5 w-12', index < current ? 'bg-primary' : 'bg-muted')} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
