/** 资源申请域常量 - 状态标签。 */

import type { ResourceRequest } from './types';

export const statusLabels: Record<ResourceRequest['status'], string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已交付',
  canceled: '已取消',
};
