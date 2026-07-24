/**
 * 部署命令计划 - 环境变量 KEY 解析（re-export）
 *
 * 单一职责：从 DeploymentRun.commandPlan 里提取「本次部署会写入 .env 的变量 KEY」。
 *
 * 背景（见 research/r2-issue234 §1.3）：
 * - 注入的真值从不落库（持久化的是 `KEY=***REDACTED***`，真值只在 secretEnv 运行期生效）。
 * - commandPlan 里 write_env 步骤的 command 形如：
 *     cat > .env <<'DEVPLOT_ENV_EOF'\nDATABASE_URL=***REDACTED***\nREDIS_HOST=***REDACTED***\nDEVPLOT_ENV_EOF
 * - 因此只能安全展示 KEY 名（值已脱敏），让用户知道「这次部署注入了哪些变量」。
 *
 * 实现已抽取到共享 lib（@/lib/deployment-command-parser），applications/ 域亦可复用。
 * 此处仅保持原模块路径与导出签名，转发到共享实现。
 */

export {
  extractInjectedEnvKeys,
  hasWriteEnvStep,
} from '@/lib/deployment-command-parser';
