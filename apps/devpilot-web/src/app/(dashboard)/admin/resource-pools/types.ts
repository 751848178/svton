/**
 * 资源池域类型
 *
 * 单一职责：仅声明接口。
 */

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
