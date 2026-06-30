/**
 * 访问策略域类型
 *
 * 单一职责：仅声明接口。
 */

export interface AccessPolicy {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  effect: 'allow' | 'deny' | string;
  principalType: 'team_role' | 'user' | 'any' | string;
  principalRole?: string | null;
  principalUserId?: string | null;
  categories?: unknown;
  actions?: unknown;
  riskLevels?: unknown;
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  principalUser?: { id: string; name?: string | null; email: string } | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
}

export interface ProjectRef {
  id: string;
  name: string;
}

export interface ProjectEnvironmentRef {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: { id: string; name: string } | null;
}

export interface PolicyForm {
  name: string;
  description: string;
  enabled: boolean;
  effect: 'allow' | 'deny';
  principalType: 'team_role' | 'user' | 'any';
  principalRole: string;
  principalUserId: string;
  projectId: string;
  environmentId: string;
  categories: string;
  actions: string;
  riskLevels: string;
  priority: string;
}

export interface PolicyStats {
  total: number;
  enabled: number;
  denies: number;
  scoped: number;
  userScoped: number;
}

export const EMPTY_FORM: PolicyForm = {
  name: '',
  description: '',
  enabled: true,
  effect: 'allow',
  principalType: 'team_role',
  principalRole: 'admin',
  principalUserId: '',
  projectId: '',
  environmentId: '',
  categories: '',
  actions: '',
  riskLevels: '',
  priority: '0',
};
