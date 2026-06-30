'use client';

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { ErrorBanner } from '@/components/ui';
import { useProjectConfigStore } from '@/store/hooks';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

function validatePackageName(name: string): { valid: boolean; error?: string } {
  if (!name) return { valid: false, error: '项目名称不能为空' };
  if (name.length > 214) return { valid: false, error: '项目名称不能超过 214 个字符' };
  if (name.startsWith('.') || name.startsWith('_'))
    return { valid: false, error: '项目名称不能以 . 或 _ 开头' };
  if (name !== name.toLowerCase()) return { valid: false, error: '项目名称必须全部小写' };
  if (/[~'!()*]/.test(name)) return { valid: false, error: '项目名称包含非法字符' };
  if (!/^[a-z0-9]/.test(name)) return { valid: false, error: '项目名称必须以字母或数字开头' };
  if (!/^[a-z0-9-_.]+$/.test(name))
    return { valid: false, error: '项目名称只能包含小写字母、数字、-、_、.' };
  return { valid: true };
}

export function StepBasicInfo({ onNext }: StepProps) {
  const { config, setBasicInfo } = useProjectConfigStore();
  const [nameError, setNameError] = useState<string>();

  const handleNameChange = usePersistFn((name: string) => {
    setBasicInfo({ name });
    setNameError(validatePackageName(name).error);
  });
  const handleOrgChange = usePersistFn((orgName: string) => {
    setBasicInfo({ orgName: orgName || config.basicInfo.name });
  });
  const handleNext = usePersistFn(() => onNext());

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">
          项目名称 <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={config.basicInfo.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {nameError ? (
          <ErrorBanner
            message={nameError}
            variant="inline"
          />
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">
          遵循 npm 包命名规范：小写字母、数字、-、_、.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">组织名称</label>
        <input
          type="text"
          value={config.basicInfo.orgName}
          onChange={(e) => handleOrgChange(e.target.value)}
          placeholder={config.basicInfo.name || 'my-org'}
          className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          用于 package.json 中的 scope，如 @my-org/backend
        </p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">项目描述</label>
        <textarea
          value={config.basicInfo.description}
          onChange={(e) => setBasicInfo({ description: e.target.value })}
          placeholder="描述你的项目..."
          rows={3}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">包管理器</label>
        <div className="flex gap-4">
          {(['pnpm', 'npm', 'yarn'] as const).map((pm) => (
            <label
              key={pm}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="radio"
                name="packageManager"
                value={pm}
                checked={config.basicInfo.packageManager === pm}
                onChange={() => setBasicInfo({ packageManager: pm })}
                className="h-4 w-4 text-primary"
              />
              <span className="text-sm">{pm}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <button
          onClick={handleNext}
          disabled={!config.basicInfo.name || !!nameError}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
