/**
 * 资源池域类型
 *
 * 单一职责：仅声明接口。
 */

/** 资源池类型图标名（与 pool-type-icons 的 ICON_PATHS 一一对应）。 */
export type PoolTypeIconName = 'database' | 'server' | 'globe' | 'cloud';

export interface ResourcePool {
  id: string;
  type: string;
  name: string;
  endpoint: string;
  capacity: number;
  allocated: number;
  available: number;
  status: string;
  createdAt: string;
}

export interface PoolForm {
  type: string;
  name: string;
  endpoint: string;
  capacity: number;
  adminConfig: Record<string, string>;
}

export const EMPTY_FORM: PoolForm = {
  type: 'mysql',
  name: '',
  endpoint: '',
  capacity: 10,
  adminConfig: {},
};
