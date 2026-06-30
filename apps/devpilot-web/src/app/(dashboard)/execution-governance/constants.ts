/**
 * 执行治理域常量
 *
 * 单一职责：仅放 Job 状态标签与样式映射。
 */

export const statusLabels: Record<string, string> = {
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
  cancelled: '已取消',
  expired: '已过期',
};

export const statusClasses: Record<string, string> = {
  queued: 'bg-indigo-100 text-indigo-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
};
