/** 站点域工具 - 状态、运行时与运行日志格式化（纯函数）。 */

import type { SiteRuntimeType } from './types';
import { readString } from './utils';

export { formatDateTime } from './date-format.utils';
export {
  formatTlsAssetLabel,
  formatTlsCertificateSummary,
  formatShortFingerprint,
  formatTlsRenewalSummary,
  getTlsRenewalStatusLabel,
  getTlsFollowUpProbeStatusLabel,
} from './tls-format.utils';

/** describeRuntime 占位文案的 i18n 键。 */
export const DESCRIBE_RUNTIME_FALLBACK_KEYS = {
  static: 'runtimeNoStaticDir',
  upstream: 'runtimeNoUpstream',
} as const;

export function describeRuntime(
  runtimeType: SiteRuntimeType,
  runtimeConfig: Record<string, unknown>,
) {
  if (runtimeType === 'static') {
    return readString(runtimeConfig.rootPath) || DESCRIBE_RUNTIME_FALLBACK_KEYS.static;
  }

  return (
    readString(runtimeConfig.upstreamUrl) ||
    [readString(runtimeConfig.containerName), readString(runtimeConfig.containerPort)]
      .filter(Boolean)
      .join(':') ||
    DESCRIBE_RUNTIME_FALLBACK_KEYS.upstream
  );
}

/**
 * 返回站点/运行/审批等状态的 i18n 键（`sites` 命名空间下）。
 * 调用方用 `t(getStatusLabel(status))` 解析；未识别状态返回空串，调用方应回退原值。
 */
export function getStatusLabel(status: string): string {
  const key = STATUS_LABEL_KEYS[status];
  return key ?? '';
}

/** status 字符串 → i18n 键。 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  active: 'statusActive',
  queued: 'statusQueued',
  pending: 'statusPending',
  error: 'statusError',
  draft: 'statusDraft',
  completed: 'statusCompleted',
  blocked: 'statusBlocked',
  failed: 'statusFailed',
  approved: 'statusApproved',
  rejected: 'statusRejected',
};

/**
 * 返回运行模式（mode）的 i18n 键（`sites` 命名空间下）。
 * 未识别模式返回空串，调用方应回退原值。
 */
export function getRunModeLabel(mode: string): string {
  const key = RUN_MODE_LABEL_KEYS[mode];
  return key ?? '';
}

/** mode 字符串 → i18n 键。 */
const RUN_MODE_LABEL_KEYS: Record<string, string> = {
  tls_renew: 'modeTlsRenew',
  tls_probe: 'modeTlsProbe',
  smoke_check: 'modeSmokeCheck',
  openresty_module_baseline: 'modeModuleBaseline',
  openresty_modules: 'modeOpenrestyModules',
  openresty_status: 'modeOpenrestyStatus',
  diagnostics: 'modeDiagnostics',
  rollback: 'modeRollback',
  sync: 'modeSync',
};

/**
 * 解析 describeRuntime 的结果：若为已知占位 i18n 键，则用 translator 翻译；否则原样返回。
 */
export function resolveRuntimeDescription(value: string, t: (key: string) => string): string {
  if (value === DESCRIBE_RUNTIME_FALLBACK_KEYS.static || value === DESCRIBE_RUNTIME_FALLBACK_KEYS.upstream) {
    return t(value);
  }
  return value;
}

export function formatRunLogPreview(value: unknown) {
  const messages = readLogMessages(value);
  if (messages.length === 0) {
    return '';
  }
  return messages.slice(0, 6).join('\n');
}

export function readLogMessages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const record = item as Record<string, unknown>;
      const stream = typeof record.stream === 'string' ? `[${record.stream}] ` : '';
      const level = typeof record.level === 'string' ? `${record.level}: ` : '';
      const message = typeof record.message === 'string' ? record.message : '';
      return `${stream}${level}${message}`.trim();
    })
    .filter(Boolean);
}
