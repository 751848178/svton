/**
 * 资源类型域常量
 *
 * 单一职责：审批/交付方式的值与 i18n key 映射，供表单选项与标签解析共享，
 * 消除两处硬编码漂移风险。
 */

export interface ModeOption {
  value: string;
  labelKey: string;
}

/** 审批方式：表单选项与标签解析的唯一数据源。 */
export const APPROVAL_MODE_OPTIONS: ModeOption[] = [
  { value: 'manual', labelKey: 'approvalModeManual' },
  { value: 'auto', labelKey: 'approvalModeAuto' },
  { value: 'none', labelKey: 'approvalModeNone' },
];

/** 交付方式：表单选项与标签解析的唯一数据源。 */
export const PROVISIONING_MODE_OPTIONS: ModeOption[] = [
  { value: 'manual', labelKey: 'provisioningModeManual' },
  { value: 'pool', labelKey: 'provisioningModePool' },
  { value: 'webhook', labelKey: 'provisioningModeWebhook' },
  { value: 'api', labelKey: 'provisioningModeApi' },
  { value: 'script', labelKey: 'provisioningModeScript' },
  { value: 'credential_only', labelKey: 'provisioningModeCredentialOnly' },
  { value: 'provider', labelKey: 'provisioningModeProvider' },
];
