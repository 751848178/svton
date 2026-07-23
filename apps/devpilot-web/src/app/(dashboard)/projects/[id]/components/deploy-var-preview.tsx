/**
 * 部署变量预览（单个 DeploymentRun）
 *
 * 单一职责：解析某次部署的 commandPlan，展示「本次部署会写入 .env 的变量 KEY」列表。
 *
 * 关键事实（见 research/r2-issue234 §1.3）：
 * - 注入的真值从不落库（commandPlan 里的值统一是 ***REDACTED***），所以只展示 KEY 名是安全的；
 * - 若该 run 无 write_env 步骤 → 提示「注入被跳过」（best-effort 失败或当时无 active 实例）；
 * - 复用 utils/command-plan-env-parser 的纯函数。
 */
'use client';

import { useTranslations } from 'next-intl';
import { extractInjectedEnvKeys, hasWriteEnvStep } from '../utils/command-plan-env-parser';
import type { DeploymentRun } from '../types/operations';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function DeployVarPreview({ run, t }: { run: DeploymentRun; t: ProjectsTranslator }) {
  const keys = extractInjectedEnvKeys(run.commandPlan);
  const hasStep = hasWriteEnvStep(run.commandPlan);

  return (
    <div className="mt-2 space-y-1 rounded-md border bg-muted/30 p-2">
      <p className="text-xs text-muted-foreground">{t('runInjectedKeysHint')}</p>
      {keys.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {keys.map((key) => (
            <span
              key={key}
              className="rounded border bg-background px-1.5 py-0.5 font-mono text-xs"
            >
              {key}
              <span className="text-muted-foreground">=•••••</span>
            </span>
          ))}
        </div>
      ) : hasStep ? (
        <p className="text-xs text-muted-foreground">{t('runInjectedKeysEmpty')}</p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t('runInjectSkipped')}</p>
      )}
    </div>
  );
}
