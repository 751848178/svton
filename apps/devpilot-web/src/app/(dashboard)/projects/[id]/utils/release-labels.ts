/**
 * 发布编排 — 中文文案常量（F383）
 *
 * 单一职责：状态/风险/阶段类型/依赖条件的中英文映射与确认短语常量。
 * 与后端 ReleaseStageStatus / RiskLevel / ReleaseStageType /
 * ReleaseDependencyConditionType 枚举字符串保持一致（未识别值兜底原值）。
 */

/** 阶段状态 → 中文。 */
export const STAGE_STATUS_LABEL: Record<string, string> = {
  pending: '待执行',
  blocked: '已阻塞',
  awaiting_approval: '待审批',
  ready: '就绪',
  queued: '已排队',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  skipped: '已跳过',
  canceled: '已取消',
};

/** 风险等级 → 中文。 */
export const RISK_LABEL: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

/** 阶段类型 → 中文。 */
export const STAGE_TYPE_LABEL: Record<string, string> = {
  precheck: '配置校验',
  schema_migration: '数据库结构迁移',
  bootstrap: '生产 bootstrap',
  data_backfill: '历史数据回填',
  application_deploy: '应用部署',
  health_check: '就绪检查',
  manual_gate: '人工门禁',
  custom_command: '自定义命令',
};

/** 依赖条件类型 → 中文。 */
export const DEPENDENCY_CONDITION_LABEL: Record<string, string> = {
  on_success: '成功后',
  always: '无论成败',
  on_failure: '失败后',
};

/**
 * 跳过可选阶段的 L3 确认短语（与后端 release-plan.service RELEASE_SKIP_CONFIRMATION_TEXT 一致）。
 * 用户必须在确认框中逐字输入该短语，禁止服务端自动提交。
 */
export const SKIP_CONFIRMATION_TEXT = '我确认跳过此可选阶段';

/** 取中文标签，未匹配兜底原值。 */
export function pickLabel(map: Record<string, string>, value?: string | null): string {
  if (!value) return '-';
  return map[value] ?? value;
}
