/**
 * 发布计划轮询 Hook（F383）
 *
 * 单一职责：当选中计划处于「进行中」状态（running/ready/blocked）时，
 * 按固定间隔调用 reload() 自动刷新；切换到终态计划或卸载时停止。
 */
'use client';

import { useEffect } from 'react';
import type { ReleasePlan } from '../types/releases';

const POLL_INTERVAL_MS = 5_000;
const ACTIVE_STATUSES = new Set(['running', 'ready', 'blocked']);

interface UseReleasePollingArgs {
  selectedPlan: ReleasePlan | null;
  reload: () => Promise<void> | void;
}

/** 当 selectedPlan 进行中时启动轮询；否则无副作用。 */
export function useReleasePolling({ selectedPlan, reload }: UseReleasePollingArgs): void {
  const active = !!selectedPlan && ACTIVE_STATUSES.has(selectedPlan.status);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      void reload();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, reload]);
}
