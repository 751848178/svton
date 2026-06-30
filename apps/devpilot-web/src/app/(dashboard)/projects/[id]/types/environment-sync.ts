/**
 * 项目详情域 - 环境同步类型
 *
 * 单一职责：环境同步建议、批量绑定、复制流程相关接口。
 */

import type { ProjectEnvironment } from './index';

export interface DeployConfigCoverage {
  total: number;
  workingDirectory: number;
  buildCommand: number;
  deployCommand: number;
  healthCheckUrl: number;
  rollbackCommand: number;
}

export interface EnvironmentConfigProfile {
  environment: ProjectEnvironment;
  isReference: boolean;
  serviceKeys: string[];
  serverKeys: string[];
  resourceKindKeys: string[];
  siteRuntimeKeys: string[];
  secretTypeKeys: string[];
  siteCount: number;
  tlsSiteCount: number;
  serviceBindingGapCount: number;
  deployConfigCoverage: DeployConfigCoverage;
  successfulDeployments: number;
  differences: string[];
}

export interface EnvironmentSyncSuggestionAction {
  kind: string;
  severity: 'info' | 'warning' | 'critical' | string;
  title: string;
  description: string;
  target: 'resource-control' | 'applications' | 'sites' | 'keys' | 'cdn-configs' | string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentSyncSuggestionProfile {
  environment: { id: string; key: string; name: string; status: string; sortOrder: number };
  isReference: boolean;
  differenceLabels: string[];
  actions: EnvironmentSyncSuggestionAction[];
}

export interface EnvironmentSyncSuggestions {
  projectId: string;
  referenceEnvironment: {
    id: string;
    key: string;
    name: string;
    status: string;
    sortOrder: number;
  } | null;
  profiles: EnvironmentSyncSuggestionProfile[];
  summary: {
    environmentCount: number;
    actionCount: number;
    differenceCount: number;
  };
}

export interface EnvironmentSyncApplyStep {
  kind: string;
  status: 'planned' | 'applied' | 'skipped' | string;
  title: string;
  description: string;
  targetType: string;
  sourceId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentSyncApplyResult {
  projectId: string;
  sourceEnvironment: { id: string; key: string; name: string };
  targetEnvironment: { id: string; key: string; name: string };
  dryRun: boolean;
  status: string;
  plannedCount: number;
  appliedCount: number;
  skippedCount: number;
  steps: EnvironmentSyncApplyStep[];
  warnings: string[];
}
