'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectConfigStore } from '@/store/project-config';
import { StepBasicInfo } from '@/components/project-wizard/step-basic-info';
import { StepSubProjects } from '@/components/project-wizard/step-sub-projects';
import { StepFeatures } from '@/components/project-wizard/step-features';
import { StepResources } from '@/components/project-wizard/step-resources';
import { StepPreview } from '@/components/project-wizard/step-preview';
import { cn } from '@/lib/utils';

const steps = [
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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3101';
      const response = await fetch(`${API_URL}/api/projects/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.accessToken : ''}`,
        },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        // 下载 ZIP 文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${config.basicInfo.name || 'project'}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        reset();
        router.push('/');
      } else {
        const error = await response.json().catch(() => ({ message: '生成失败' }));
        alert(error.message || '生成项目失败');
      }
    } catch (error) {
      console.error('Error generating project:', error);
      alert('生成项目时发生错误');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">创建新项目</h1>
        <p className="text-muted-foreground">
          通过向导配置你的项目，选择需要的功能和资源
        </p>
      </div>

      {/* 步骤指示器 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center"
            >
              <button
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                  index === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : index < currentStep
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </button>
              <span
                className={cn(
                  'ml-2 text-sm font-medium',
                  index === currentStep
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-4',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 步骤内容 */}
      <div className="bg-card rounded-lg border p-6">
        {currentStep === 0 && <StepBasicInfo onNext={handleNext} onPrev={handlePrev} />}
        {currentStep === 1 && <StepSubProjects onNext={handleNext} onPrev={handlePrev} />}
        {currentStep === 2 && <StepFeatures onNext={handleNext} onPrev={handlePrev} />}
        {currentStep === 3 && <StepResources onNext={handleNext} onPrev={handlePrev} />}
        {currentStep === 4 && <StepPreview onPrev={handlePrev} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
      </div>
    </div>
  );
}
