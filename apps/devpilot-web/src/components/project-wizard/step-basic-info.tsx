'use client';

import { useProjectConfigStore } from '@/store/project-config';
import { useState, useEffect } from 'react';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

// npm 包名验证
function validatePackageName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: '项目名称不能为空' };
  }
  if (name.length > 214) {
    return { valid: false, error: '项目名称不能超过 214 个字符' };
  }
  if (name.startsWith('.') || name.startsWith('_')) {
    return { valid: false, error: '项目名称不能以 . 或 _ 开头' };
  }
  if (name !== name.toLowerCase()) {
    return { valid: false, error: '项目名称必须全部小写' };
  }
  if (/[~'!()*]/.test(name)) {
    return { valid: false, error: '项目名称包含非法字符' };
  }
  if (!/^[a-z0-9]/.test(name)) {
    return { valid: false, error: '项目名称必须以字母或数字开头' };
  }
  if (!/^[a-z0-9-_.]+$/.test(name)) {
    return { valid: false, error: '项目名称只能包含小写字母、数字、-、_、.' };
  }
  return { valid: true };
}

export function StepBasicInfo({ onNext }: StepProps) {
  const { config, setBasicInfo } = useProjectConfigStore();
  const [nameError, setNameError] = useState<string>();

  const handleNameChange = (name: string) => {
    setBasicInfo({ name });
    const validation = validatePackageName(name);
    setNameError(validation.error);
  };

  const handleOrgChange = (orgName: string) => {
    setBasicInfo({ orgName: orgName || config.basicInfo.name });
  };

  const canProceed = config.basicInfo.name && !nameError;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          项目名称 <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={config.basicInfo.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {nameError && (
          <p className="mt-1 text-sm text-destructive">{nameError}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          遵循 npm 包命名规范：小写字母、数字、-、_、.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          组织名称
        </label>
        <input
          type="text"
          value={config.basicInfo.orgName}
          onChange={(e) => handleOrgChange(e.target.value)}
          placeholder={config.basicInfo.name || 'my-org'}
          className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          用于 package.json 中的 scope，如 @my-org/backend
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          项目描述
        </label>
        <textarea
          value={config.basicInfo.description}
          onChange={(e) => setBasicInfo({ description: e.target.value })}
          placeholder="描述你的项目..."
          rows={3}
          className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          包管理器
        </label>
        <div className="flex gap-4">
          {(['pnpm', 'npm', 'yarn'] as const).map((pm) => (
            <label key={pm} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="packageManager"
                value={pm}
                checked={config.basicInfo.packageManager === pm}
                onChange={() => setBasicInfo({ packageManager: pm })}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">{pm}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
