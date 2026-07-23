/**
 * 执行治理域常量
 *
 * 单一职责：仅放 Job 状态文案映射。状态色调统一走 @/components/ui/status-map。
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
