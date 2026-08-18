/**
 * 发布错误人话映射（纯函数，第 0 步）
 *
 * 单一职责：把后端原始错误（errorCode 或 message）映射为可展示的人话词条键；
 * 原始文本折叠为次要详情，绝不把裸错误码当主原因。空信息给通用兜底词条。
 * 词条键由组件层用 i18n 渲染（zh/en 双语，见 messages/*.json projects 命名空间）。
 */

/** 已知错误码 → 人话词条键（key 命名遵循发布词汇表，不外泄内部名词）。 */
const ERROR_KEY_BY_CODE: Record<string, string> = {
  BUILD_RUN_TIMEOUT: 'publishErrorBuildTimeout',
  BUILD_COMMAND_TIMEOUT: 'publishErrorBuildTimeout',
  DOCKER_TIMEOUT: 'publishErrorBuildTimeout',
  UNTRUSTED_WORKER_SCAN_TIMEOUT: 'publishErrorBuildTimeout',
  DEPENDENCY_FETCH_START_TIMEOUT: 'publishErrorDependencyTimeout',
  DEPENDENCY_ASSIGNMENT_TIMEOUT: 'publishErrorDependencyTimeout',
  DEPENDENCY_FETCH_AUTHORIZATION_TIMEOUT: 'publishErrorDependencyTimeout',
  BUILD_COMMAND_CANCELED: 'publishErrorBuildCanceled',
  BUILD_EXIT_NONZERO: 'publishErrorBuildExit',
  RELEASE_GATE_BLOCKED: 'publishErrorGateBlocked',
  releaseProductionPreviewScopeMismatch: 'publishErrorPreviewScope',
};

export interface PublishErrorCopy {
  /** 命中的 i18n 词条键；null 表示原始文本本身可直接展示（非错误码）。 */
  labelKey: string | null;
  /** 原始错误文本（含错误码），作为可展开的次要详情。 */
  detail: string | null;
}

export function publishErrorCopy(raw: string | null | undefined): PublishErrorCopy {
  const text = raw?.trim() ?? '';
  if (!text) return { labelKey: 'publishErrorFallback', detail: null };
  const exact = ERROR_KEY_BY_CODE[text];
  if (exact) return { labelKey: exact, detail: text };
  // 未知但形如错误码（全大写下划线）且以 _TIMEOUT 结尾 → 超时人话。
  if (/^[A-Z][A-Z0-9_]*_TIMEOUT$/.test(text)) {
    return { labelKey: 'publishErrorBuildTimeout', detail: text };
  }
  return { labelKey: null, detail: text };
}
