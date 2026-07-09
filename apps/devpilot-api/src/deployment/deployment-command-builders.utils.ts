/**
 * Pure deployment command-step builders, warning collectors, and validation
 * helpers. Extracted from `DeploymentService` to begin the god-service split.
 * All functions are pure.
 */

import { ServerCommandStep } from '../server-executor';

export type DeploymentConfig = {
  targetType: string;
  workingDirectory?: string;
  buildCommand?: string;
  deployCommand?: string;
  rollbackCommand?: string;
  healthCheckUrl?: string;
};

export function safeGitCommitSha(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^[a-fA-F0-9]{7,64}$/.test(trimmed) ? trimmed : undefined;
}

export function safePositiveInt(value: unknown, fallback: number, max: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(1, Math.min(Math.floor(numberValue), max));
}

export function buildCommandSteps(deployment: DeploymentConfig, gitRepo?: string, branch?: string): ServerCommandStep[] {
  return [
    { key: 'checkout', label: '拉取代码', command: gitRepo ? `git fetch --all --prune && git checkout ${branch || 'main'} && git pull` : '', cwd: deployment.workingDirectory || '', required: Boolean(gitRepo), risk: 'low', timeoutSeconds: 120 },
    { key: 'build', label: '构建', command: deployment.buildCommand || '', cwd: deployment.workingDirectory || '', required: Boolean(deployment.buildCommand), risk: 'medium', timeoutSeconds: 600 },
    { key: 'deploy', label: '部署', command: deployment.deployCommand || '', cwd: deployment.workingDirectory || '', required: true, risk: 'medium', timeoutSeconds: 600 },
    { key: 'health_check', label: '健康检查', command: deployment.healthCheckUrl ? `curl -fsS ${deployment.healthCheckUrl}` : '', cwd: '', required: Boolean(deployment.healthCheckUrl), risk: 'low', timeoutSeconds: 30 },
  ];
}

export function buildRollbackCommandSteps(deployment: DeploymentConfig, gitRepo?: string, commitSha?: string | null): ServerCommandStep[] {
  const safeCommitSha = safeGitCommitSha(commitSha);
  const deployCommand = deployment.rollbackCommand || deployment.deployCommand || '';
  return [
    { key: 'checkout_rollback', label: '切换到回滚版本', command: gitRepo && safeCommitSha ? `git fetch --all --prune && git checkout ${safeCommitSha}` : '', cwd: deployment.workingDirectory || '', required: Boolean(gitRepo && safeCommitSha), risk: 'low', timeoutSeconds: 120 },
    { key: 'build_rollback', label: '构建回滚版本', command: deployment.buildCommand || '', cwd: deployment.workingDirectory || '', required: Boolean(deployment.buildCommand), risk: 'medium', timeoutSeconds: 600 },
    { key: 'deploy_rollback', label: deployment.rollbackCommand ? '执行回滚命令' : '重新部署回滚版本', command: deployCommand, cwd: deployment.workingDirectory || '', required: true, risk: 'high', timeoutSeconds: 600 },
    { key: 'health_check', label: '回滚后健康检查', command: deployment.healthCheckUrl ? `curl -fsS ${deployment.healthCheckUrl}` : '', cwd: '', required: Boolean(deployment.healthCheckUrl), risk: 'low', timeoutSeconds: 30 },
  ];
}

export function buildSmokeCheckCommandSteps(healthCheckUrl: string): ServerCommandStep[] {
  return [
    { key: 'deployment_smoke_check', label: '部署 Smoke 检查', command: `curl -fsS ${healthCheckUrl}`, cwd: '', required: true, risk: 'low', timeoutSeconds: 30 },
  ];
}

export function collectWarnings(deployment: DeploymentConfig, gitRepo?: string, branch?: string): string[] {
  const warnings: string[] = [];
  if (!gitRepo) warnings.push('未配置 Git 仓库，无法生成代码拉取步骤');
  if (gitRepo && !branch) warnings.push('未配置默认分支，将使用 main');
  if (!deployment.workingDirectory) warnings.push('未配置工作目录');
  if (!deployment.deployCommand) warnings.push('未配置部署命令');
  if (!deployment.healthCheckUrl) warnings.push('未配置健康检查地址');
  return warnings;
}

export function collectRollbackWarnings(deployment: DeploymentConfig, gitRepo?: string, commitSha?: string | null): string[] {
  const warnings: string[] = [];
  if (!gitRepo) warnings.push('未配置 Git 仓库，无法生成回滚代码 checkout 步骤。');
  if (gitRepo && !safeGitCommitSha(commitSha)) warnings.push('历史部署记录缺少有效的 Git commit SHA，无法生成 checkout 回滚步骤。');
  if (!deployment.workingDirectory) warnings.push('未配置工作目录');
  if (!deployment.deployCommand && !deployment.rollbackCommand) warnings.push('未配置部署/回滚命令');
  if (!deployment.healthCheckUrl) warnings.push('未配置健康检查地址');
  return warnings;
}
