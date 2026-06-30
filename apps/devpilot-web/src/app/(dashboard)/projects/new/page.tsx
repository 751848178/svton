'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { PageHeader } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';
import { download } from '@/lib/api-client/stream';
import { StepBasicInfo } from '@/components/project-wizard/step-basic-info';
import { StepSubProjects } from '@/components/project-wizard/step-sub-projects';
import { StepFeatures } from '@/components/project-wizard/step-features';
import { StepResources } from '@/components/project-wizard/step-resources';
import { StepPreview } from '@/components/project-wizard/step-preview';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'basic', title: '基础信息', component: StepBasicInfo },
  { id: 'subprojects', title: '子项目', component: StepSubProjects },
  { id: 'features', title: '功能选择', component: StepFeatures },
  { id: 'resources', title: '资源配置', component: StepResources },
  { id: 'preview', title: '预览确认', component: StepPreview },
];

export default function NewProjectPage() {
  const router = useRouter();
  const { currentStep, setCurrentStep, config, reset } = useProjectConfigStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = usePersistFn(() => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  });
  const handlePrev = usePersistFn(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  });

  const handleSubmit = usePersistFn(async () => {
    setIsSubmitting(true);
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
      alert('生成项目时发生错误');
    } finally {
      setIsSubmitting(false);
    }
  });

  const StepContent = STEPS[currentStep].component;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="创建新项目"
        description="通过向导配置你的项目，选择需要的功能和资源"
      />

      <StepIndicator
        steps={STEPS}
        current={currentStep}
        onSelect={setCurrentStep}
      />

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
  onSelect,
}: {
  steps: Array<{ id: string; title: string }>;
  current: number;
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
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
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
