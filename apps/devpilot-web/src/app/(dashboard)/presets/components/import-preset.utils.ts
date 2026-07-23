/**
 * 预设导入文件解析工具。
 *
 * 单一职责：解析导入文件 JSON 并做字段级校验，返回结构化结果。
 * 与反馈展示解耦 —— 调用方据 result.kind 选择对应 i18n 文案提示。
 */

/** 导入解析结果（成功 / 各类字段错误 / JSON 格式错误）。 */
export type ImportParseResult =
  | { kind: 'ok'; name: string; config: unknown }
  | { kind: 'invalidJson' }
  | { kind: 'missingName' }
  | { kind: 'missingConfig' };

/**
 * 校验 config 是否已配置核心字段（basicInfo.name 非空即视为已配置）。
 * 用于「保存当前配置」按钮的禁用判定。
 */
export function isConfigured(config: unknown): boolean {
  return Boolean(
    config &&
      typeof config === 'object' &&
      (config as { basicInfo?: { name?: string } }).basicInfo?.name,
  );
}

/** 解析并校验导入文件文本，返回结构化结果。 */
export function parseImportFile(text: string): ImportParseResult {
  let data: { name?: unknown; config?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'invalidJson' };
  }
  if (typeof data.name !== 'string' || !data.name) {
    return { kind: 'missingName' };
  }
  if (!data.config || typeof data.config !== 'object') {
    return { kind: 'missingConfig' };
  }
  return { kind: 'ok', name: data.name, config: data.config };
}
