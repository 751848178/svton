/**
 * 备份域常量
 *
 * 单一职责：仅放标签映射，不含逻辑。
 */

export const providerLabels: Record<string, string> = {
  docker: 'Docker',
  'aliyun-rds': '阿里云 RDS',
};

export const kindLabels: Record<string, string> = {
  mysql: 'MySQL',
  redis: 'Redis',
  database: '数据库',
};

export const backupTypeLabels: Record<string, string> = {
  logical: '逻辑备份',
  snapshot: '快照',
  file: '文件备份',
};

export const statusLabels: Record<string, string> = {
  active: '启用',
  paused: '暂停',
  archived: '归档',
  queued: '已入队',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
};
