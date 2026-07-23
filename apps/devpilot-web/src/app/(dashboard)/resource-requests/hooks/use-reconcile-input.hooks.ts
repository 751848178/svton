/**
 * provider 对账输入收集 Hook
 *
 * 单一职责：用弹窗收集 providerState JSON（取代原生 window.prompt）。
 * 维护"当前待对账的 run"状态 + 校验/提交/取消逻辑，校验通过后回调 onCollected。
 * 校验错误以返回串形式交给调用方（弹窗内联展示），不在此处副作用。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import type { ResourceProvisioningRun } from '../types';
import { parseJsonObject } from '../utils';

export interface ReconcileInputApi {
  /** 当前待对账的 run（驱动弹窗 open）。 */
  reconcileInputTarget: ResourceProvisioningRun | null;
  /** 打开输入弹窗收集指定 run 的 providerState。 */
  openReconcileInput: (run: ResourceProvisioningRun) => void;
  /** 校验 JSON 并回调；返回校验错误串或 null（成功）。 */
  submitReconcileInput: (raw: string) => string | null;
  /** 取消（关闭弹窗）。 */
  cancelReconcileInput: () => void;
}

export function useReconcileInput(
  onCollected: (run: ResourceProvisioningRun, providerState: Record<string, unknown>) => void,
): ReconcileInputApi {
  const t = useTranslations('resourceRequests');
  const [reconcileInputTarget, setReconcileInputTarget] = useState<ResourceProvisioningRun | null>(null);

  const openReconcileInput = usePersistFn((run: ResourceProvisioningRun) => {
    setReconcileInputTarget(run);
  });

  /** 校验 providerState JSON 并回调；返回校验错误串供弹窗内联展示。 */
  const submitReconcileInput = usePersistFn((raw: string): string | null => {
    const run = reconcileInputTarget;
    if (!run) return null;
    let providerState: Record<string, unknown>;
    try {
      providerState = parseJsonObject(raw, 'providerState');
    } catch (err) {
      return err instanceof Error ? err.message : t('providerStateInvalid');
    }
    setReconcileInputTarget(null);
    onCollected(run, providerState);
    return null;
  });

  const cancelReconcileInput = usePersistFn(() => setReconcileInputTarget(null));

  return {
    reconcileInputTarget,
    openReconcileInput,
    submitReconcileInput,
    cancelReconcileInput,
  };
}
