/**
 * 发布向导编排 Hook（第 0 步）
 *
 * 单一职责：持有向导页的三步状态（选环境 → 确认配置 → 确认发布），
 * 组合数据 Hook（环境/生效配置）与提交编排 Hook，向上暴露最小的页面视图。
 * 冲突或未配置密钥未解决时禁止进入下一步（与后端 409/阻断策略一致）。
 */

'use client';

import { useMemo, useState } from 'react';
import type { CreateReleaseOrderInput } from '../../types/release-order.types';
import { usePublishEnvironments } from './use-publish-environments';
import { useEffectiveConfig } from './use-effective-config';
import { usePublishSubmit } from './use-publish-submit';

export type PublishWizardStep = 1 | 2 | 3;

export function usePublishWizard(projectId: string) {
  const [step, setStep] = useState<PublishWizardStep>(1);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const environments = usePublishEnvironments(projectId);
  const config = useEffectiveConfig(projectId, selectedEnvironmentId || null);
  const submitState = usePublishSubmit(projectId);

  const selectedEnvironment = useMemo(
    () => environments.cards.find((card) => card.id === selectedEnvironmentId) ?? null,
    [environments.cards, selectedEnvironmentId],
  );

  /** 第二步放行条件：配置已加载且无冲突、无未配置密钥。 */
  const configResolved = useMemo(
    () =>
      Boolean(
        config.summary &&
        config.summary.conflicts.length === 0 &&
        config.summary.unconfiguredSecrets.length === 0,
      ),
    [config.summary],
  );

  const canAdvance =
    step === 1 ? Boolean(selectedEnvironmentId) : step === 2 ? configResolved : false;

  const goNext = () => {
    if (!canAdvance) return;
    setStep((current) => (current < 3 ? ((current + 1) as PublishWizardStep) : current));
  };
  const goBack = () =>
    setStep((current) => (current > 1 ? ((current - 1) as PublishWizardStep) : current));

  /** 确认发布：发布单版本号默认由用户意图（分支与版本）摘要生成。 */
  const publish = async (input: CreateReleaseOrderInput) => submitState.submit(input);
  const retryPublish = async (input: CreateReleaseOrderInput) => submitState.retry(input);

  return {
    step,
    setStep,
    goNext,
    goBack,
    canAdvance,
    environments,
    selectedEnvironmentId,
    selectEnvironment: (environmentId: string) => {
      setSelectedEnvironmentId(environmentId);
      setStep(2);
    },
    selectedEnvironment,
    config,
    configResolved,
    submit: submitState,
    publish,
    retryPublish,
  };
}

export type PublishWizardController = ReturnType<typeof usePublishWizard>;
