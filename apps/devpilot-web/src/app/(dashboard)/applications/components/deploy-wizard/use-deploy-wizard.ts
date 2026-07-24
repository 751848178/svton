/**
 * 部署向导状态 Hook
 *
 * 单一职责：管理向导 3 步状态机 + 编排 dry-run 预览 / live 申请两个 API 调用。
 *
 * 步骤：
 *   1) environment —— 选环境（默认服务当前环境），不可跳过；
 *   2) preview    —— 调 createDeploymentPlan(dryRun:true) 拿 commandPlan 展示；
 *   3) action     —— 仅生成计划（关闭）/ 申请 live（需 confirmationText=项目名 + reason）。
 *
 * 失败时把错误写入 state（供弹窗内联展示），不抛出（toast 由调用方按需补充）。
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  CreatedDeploymentRun,
} from '../../types';

export type DeployWizardStep = 'environment' | 'preview' | 'action';

export interface DeployWizardInput {
  environmentId: string;
  serverId: string;
  branch: string;
}

interface UseDeployWizardArgs {
  application: ApplicationItem;
  service: ApplicationServiceItem;
  /** dry-run 计划生成（已封装 loading/error）。 */
  createPlan: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    options?: { environmentId?: string; serverId?: string; branch?: string },
  ) => Promise<CreatedDeploymentRun>;
  /** live 部署审批申请。 */
  requestApproval: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    input: {
      confirmationText: string;
      approvalReason?: string;
      environmentId?: string;
      serverId?: string;
      branch?: string;
    },
  ) => Promise<CreatedDeploymentRun>;
}

export function useDeployWizard({ application, service, createPlan, requestApproval }: UseDeployWizardArgs) {
  const [step, setStep] = useState<DeployWizardStep>('environment');
  const [input, setInput] = useState<DeployWizardInput>({
    environmentId: service.environment?.id ?? '',
    serverId: service.server?.id ?? '',
    branch: application.defaultBranch ?? '',
  });
  const [previewRun, setPreviewRun] = useState<CreatedDeploymentRun | null>(null);
  const [resultRun, setResultRun] = useState<CreatedDeploymentRun | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep('environment');
    setInput({
      environmentId: service.environment?.id ?? '',
      serverId: service.server?.id ?? '',
      branch: application.defaultBranch ?? '',
    });
    setPreviewRun(null);
    setResultRun(null);
    setSubmitting(false);
    setError('');
  }, [service.environment?.id, service.server?.id, application.defaultBranch]);

  const updateInput = useCallback((patch: Partial<DeployWizardInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Step 2：生成 dry-run 预览计划。成功时返回 run（供调用方 toast），失败返回 null。 */
  const generatePreview = useCallback(async (): Promise<CreatedDeploymentRun | null> => {
    setSubmitting(true);
    setError('');
    try {
      const run = await createPlan(application, service, {
        environmentId: input.environmentId || undefined,
        serverId: input.serverId || undefined,
        branch: input.branch || undefined,
      });
      setPreviewRun(run);
      setStep('preview');
      return run;
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成预览计划失败');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [application, service, createPlan, input]);

  /** Step 3：申请 live 部署（创建审批单，run 通常置为 BLOCKED）。成功返回 run，失败 null。 */
  const submitLive = useCallback(
    async (confirmationText: string, approvalReason: string): Promise<CreatedDeploymentRun | null> => {
      setSubmitting(true);
      setError('');
      try {
        const run = await requestApproval(application, service, {
          confirmationText,
          approvalReason: approvalReason || undefined,
          environmentId: input.environmentId || undefined,
          serverId: input.serverId || undefined,
          branch: input.branch || undefined,
        });
        setResultRun(run);
        setStep('action');
        return run;
      } catch (err) {
        setError(err instanceof Error ? err.message : '申请正式部署审批失败');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [application, service, requestApproval, input],
  );

  return useMemo(
    () => ({
      step,
      input,
      previewRun,
      resultRun,
      submitting,
      error,
      setStep,
      updateInput,
      generatePreview,
      submitLive,
      reset,
    }),
    [step, input, previewRun, resultRun, submitting, error, updateInput, generatePreview, submitLive, reset],
  );
}

export type UseDeployWizard = ReturnType<typeof useDeployWizard>;
