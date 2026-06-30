/**
 * 执行策略域类型
 *
 * 单一职责：仅声明接口。
 */

export interface PolicyTemplate {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  priority: number;
  adapterKeys?: unknown;
  operationKeys?: unknown;
  allowedPatterns?: unknown;
  blockedPatterns?: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  project?: { id: string; name: string } | null;
  environment?: { id: string; key: string; name: string; status: string } | null;
}

export interface Project {
  id: string;
  name: string;
}

export interface ProjectEnvironment {
  id: string;
  key: string;
  name: string;
  status: string;
  project?: { id: string; name: string } | null;
}

export interface PolicyForm {
  name: string;
  description: string;
  projectId: string;
  environmentId: string;
  enabled: boolean;
  priority: string;
  adapterKeys: string;
  operationKeys: string;
  allowedPatterns: string;
  blockedPatterns: string;
}

export interface PolicyStats {
  total: number;
  enabled: number;
  scoped: number;
  blockingRules: number;
  allowingRules: number;
}
