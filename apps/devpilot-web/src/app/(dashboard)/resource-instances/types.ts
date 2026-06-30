/**
 * 资源实例域类型
 *
 * 单一职责：仅声明接口。
 */

export type ResourceInstanceStatus = 'active' | 'released' | 'expired' | 'revoked';

export interface ResourceInstance {
  id: string;
  name: string;
  status: ResourceInstanceStatus;
  delivery?: Record<string, unknown>;
  hasCredentials: boolean;
  expiresAt?: string;
  releasedAt?: string;
  createdAt: string;
  resourceType?: { id: string; key: string; name: string };
  project?: { id: string; name: string };
  request?: { id: string; title: string };
}

export const STATUS_LABELS: Record<ResourceInstanceStatus, string> = {
  active: '使用中',
  released: '已释放',
  expired: '已过期',
  revoked: '已回收',
};
