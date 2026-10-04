// Text rendering for `ship init`: check levels, masked review of planned writes,
// next steps. Previews arrive pre-masked at the object level (mask.ts / write.ts),
// so nothing token-bearing passes through here unmasked (M1-01).

import type { AgentCheckResult, RegistryCheckResult } from './checks.js';
import type { InitAnswers } from './plan.js';
import type { FilePlan } from './write.js';
import { unifiedDiff } from './diff.js';

export function renderAgentCheck(name: string, c: AgentCheckResult): string {
  const flag = c.passed ? '✓' : '✗';
  return `${flag} ${name}（${c.url}）：${c.detail}`;
}

export function renderRegistryCheck(c: RegistryCheckResult): string {
  // c.detail already carries the three-level semantics (reachable / auth not verified here / push-pull unverified)
  return `${c.reachable ? '✓' : '⚠'} 镜像仓库（${c.url}）：${c.detail}`;
}

function renderFileBlock(rel: string, beforePreview: string | null, afterPreview: string, mode: number, existing: boolean, existingInvalid: boolean): string {
  const perm = mode === 0o600 ? '，权限 0600（含 token）' : '';
  if (!existing) {
    const body = afterPreview.split('\n').map((l) => `  + ${l}`).join('\n');
    return `${rel}（新文件）${perm}\n${body}`;
  }
  if (existingInvalid || beforePreview === null) {
    const body = afterPreview.split('\n').map((l) => `  + ${l}`).join('\n');
    return `${rel}（已存在但无法解析，将整体替换；原内容备份到 .ship/backup/，原文不在本输出中显示）${perm}\n${body}`;
  }
  const diff = unifiedDiff(beforePreview, afterPreview, `${rel}（现有）`, `${rel}（生成）`);
  if (diff === '') {
    return `${rel}（已存在，将更新；差异仅涉及已脱敏字段，本输出不显示原文）${perm}`;
  }
  return `${rel}（已存在，将更新；原内容备份到 .ship/backup/）${perm}\n${diff}`;
}

export function renderReview(answers: InitAnswers, plan: FilePlan, builder: AgentCheckResult | null, runtime: AgentCheckResult | null, registry: RegistryCheckResult | null): string {
  const lines: string[] = ['── 审阅：以下变更将写入项目目录 ──'];
  const hc = answers.healthcheckPath
    ? `${answers.healthcheckPath}${answers.healthcheckHostPort ? `@${answers.healthcheckHostPort}` : ''}`
    : '未配置（deploy 时不做健康检查）';
  lines.push(`应用：${answers.name}｜Dockerfile：${answers.dockerfile}｜端口：${answers.ports.join(' ') || '不映射'}｜健康检查：${hc}${answers.envFile ? `｜envFile：${answers.envFile}` : ''}`);
  if (builder) lines.push(renderAgentCheck('构建机', builder));
  if (runtime) lines.push(renderAgentCheck(`运行机 ${answers.targetName}`, runtime));
  if (registry) lines.push(renderRegistryCheck(registry));
  lines.push('');
  for (const w of plan.warnings) lines.push(`⚠ ${w}`);
  if (plan.warnings.length > 0) lines.push('');
  for (const f of plan.files.filter((x) => x.changed)) {
    lines.push(renderFileBlock(f.rel, f.beforePreview, f.afterPreview, f.mode, f.before !== null, f.existingInvalid));
    lines.push('');
  }
  return lines.join('\n');
}

/** next steps differ between "environment ready" and "saved but blocked" (M1-10) */
export function renderNextSteps(targetName: string, ready: boolean, pending: string[]): string[] {
  if (!ready) {
    return [
      '配置已保存，但环境检查未通过 —— 初始化尚未完成：',
      ...pending.map((s) => `  ${s}`),
      `复检连通性：ship doctor`,
      `修正入口或 token 后重新运行 ship init（已答项会作为默认值保留）：ship init`,
    ];
  }
  return [
    '初始化完成（本命令只生成配置，不会构建或部署）。',
    `检查连通性：ship doctor`,
    `首次发布：ship release --from-dir . --to ${targetName}`,
  ];
}
