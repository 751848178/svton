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

/**
 * status → resourceInstances 命名空间下的 i18n key。
 * 调用方用 useTranslations('resourceInstances')(key) 解析为本地化文案。
 */
export const STATUS_LABEL_KEYS: Record<ResourceInstanceStatus, string> = {
  active: 'statusActive',
  released: 'statusReleased',
  expired: 'statusExpired',
  revoked: 'statusRevoked',
};
