/**
 * 应用服务域常量
 *
 * 单一职责：仅放枚举与 key 映射（值均为 i18n key，渲染时由 utils 中的 resolver 解析）。
 * 不在此处内联中文文案，避免绕过 next-intl。
 */

import type { ServiceAction } from './types';

/** service.kind → applications namespace 下的 i18n key。 */
export const kindLabelKeys: Record<string, string> = {
  'docker-compose': 'kindDockerCompose',
  container: 'kindContainer',
  static: 'kindStatic',
  external: 'kindExternal',
};

/** ServiceAction → applications namespace 下的 i18n key。 */
export const operationLabelKeys: Record<ServiceAction, string> = {
  status: 'operationStatus',
  logs: 'operationLogs',
  restart: 'operationRestart',
  rollback: 'operationRollback',
};

/** operation run status → applications namespace 下的 i18n key。 */
export const operationStatusLabelKeys: Record<string, string> = {
  queued: 'runStatusQueued',
  running: 'runStatusRunning',
  completed: 'runStatusCompleted',
  failed: 'runStatusFailed',
  blocked: 'runStatusBlocked',
};

export const SERVICE_ACTIONS: ServiceAction[] = ['status', 'logs', 'restart', 'rollback'];

/** 创建服务表单中可选的 kind 列表（value 即 kindLabelKeys 的键）。 */
export const KIND_VALUES: { value: string; labelKey: string }[] = [
  { value: 'docker-compose', labelKey: 'kindDockerCompose' },
  { value: 'container', labelKey: 'kindContainer' },
  { value: 'static', labelKey: 'kindStatic' },
  { value: 'external', labelKey: 'kindExternal' },
];
