/**
 * 部署向导 - Step 2：计划预览（dry-run 结果）
 *
 * 单一职责：解析 previewRun.commandPlan，展示命令步骤标签 + 将注入的 .env KEY（脱敏）
 * + 明确标注"这是 dry-run 预览"。
 *
 * 复用共享纯函数 readDeploymentCommandSteps / extractInjectedEnvKeys / hasWriteEnvStep。
 */

'use client';

import { useTranslations } from 'next-intl';
import {
  readDeploymentCommandSteps,
  extractInjectedEnvKeys,
  hasWriteEnvStep,
} from '@/lib/deployment-command-parser';
import type { CreatedDeploymentRun } from '../../types';

interface DeployWizardPlanPreviewProps {
  run: CreatedDeploymentRun | null;
}

export function DeployWizardPlanPreview({ run }: DeployWizardPlanPreviewProps) {
  const t = useTranslations('applications');
  const commandPlan = run?.commandPlan;
  const steps = readDeploymentCommandSteps(commandPlan);
  const envKeys = extractInjectedEnvKeys(commandPlan);
  const hasEnvStep = hasWriteEnvStep(commandPlan);

  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-600 dark:text-amber-400">{t('wizardDryRunHint')}</p>
      <div>
        <p className="mb-2 text-sm font-medium">{t('wizardPlanSteps')}</p>
        {steps.length > 0 ? (
          <ol className="space-y-1 rounded-md border bg-muted/30 p-3">
            {steps.map((step, idx) => (
              <li
                key={`${step.key}-${idx}`}
                className="flex items-start gap-2 text-sm"
              >
                <span className="mt-0.5 text-xs text-muted-foreground">{idx + 1}.</span>
                <span className="font-medium">{step.label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">{t('wizardNoSteps')}</p>
        )}
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">{t('wizardInjectedKeys')}</p>
        {envKeys.length > 0 ? (
          <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-2">
            {envKeys.map((key) => (
              <span
                key={key}
                className="rounded border bg-background px-1.5 py-0.5 font-mono text-xs"
              >
                {key}
                <span className="text-muted-foreground">=•••••</span>
              </span>
            ))}
          </div>
        ) : hasEnvStep ? (
          <p className="text-xs text-muted-foreground">{t('wizardInjectedKeysEmpty')}</p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('wizardInjectSkipped')}
          </p>
        )}
      </div>
    </div>
  );
}
