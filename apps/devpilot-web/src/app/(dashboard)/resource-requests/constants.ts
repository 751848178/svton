/** 资源申请域常量 - 状态标签的 i18n key（文案在 resourceRequests 命名空间解析）。 */

import type { ResourceRequest } from './types';

/**
 * status → resourceRequests 命名空间下的 i18n key。
 * 调用方用 useTranslations('resourceRequests')(key) 解析为本地化文案。
 */
export const statusLabelKeys: Record<ResourceRequest['status'], string> = {
  pending: 'statusPending',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  completed: 'statusCompleted',
  canceled: 'statusCanceled',
};
