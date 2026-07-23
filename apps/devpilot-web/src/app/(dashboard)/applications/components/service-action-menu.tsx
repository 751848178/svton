/**
 * 服务操作菜单
 *
 * 单一职责：把服务行的低频次操作（日志/重启/回滚 × 计划环境、申请 Live）收敛进
 * 一个 ActionMenu，按环境分两组带组标签，回滚（危险）固定在各组底部红色项。
 * 菜单项触发与原有按钮完全相同的入口（onRun / onRequestLive），审批/确认流程不变。
 */

'use client';

import { useTranslations } from 'next-intl';
import { ActionMenu } from '@/components/ui/action-menu';
import type { ServiceAction } from '../types';
import { getOperationLabel } from '../utils';

interface ServiceActionMenuProps {
  serviceId: string;
  runningOperation: string;
  queueServiceOperations: boolean;
  onRun: (action: ServiceAction) => void;
  onRequestLive: (action: ServiceAction) => void;
}

/** 计划环境组内展示的操作（status 高频外露为 outline 按钮，不入菜单）。 */
const PLAN_MENU_ACTIONS: ServiceAction[] = ['logs', 'restart', 'rollback'];
/** 申请 Live 组内展示的操作（与原 canRequestLive 判定一致）。 */
const LIVE_MENU_ACTIONS: ServiceAction[] = ['restart', 'rollback'];

export function ServiceActionMenu(props: ServiceActionMenuProps) {
  const { serviceId, runningOperation, queueServiceOperations, onRun, onRequestLive } = props;
  const t = useTranslations('applications');

  const planItems = PLAN_MENU_ACTIONS.map((action) => ({
    key: `plan:${action}`,
    label: queueServiceOperations
      ? t('operationEnqueue', { label: getOperationLabel(t, action) })
      : getOperationLabel(t, action),
    danger: action === 'rollback',
    disabled: runningOperation === `${serviceId}:${action}`,
    onSelect: () => onRun(action),
  }));

  const liveItems = LIVE_MENU_ACTIONS.map((action) => ({
    key: `live:${action}`,
    label: `${getOperationLabel(t, action)} · ${
      queueServiceOperations ? t('requestEnqueue') : t('requestLive')
    }`,
    danger: action === 'rollback',
    disabled: runningOperation === `${serviceId}:${action}:live`,
    onSelect: () => onRequestLive(action),
  }));

  return (
    <ActionMenu
      triggerLabel={t('moreActions')}
      groups={[
        { label: t('menuPlanGroup'), items: planItems },
        { label: t('menuLiveGroup'), items: liveItems },
      ]}
    />
  );
}
