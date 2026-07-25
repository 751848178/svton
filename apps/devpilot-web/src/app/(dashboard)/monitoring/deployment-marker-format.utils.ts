/**
 * 部署标注 tooltip 文本(N4)
 *
 * 单一职责:把部署运行拼成 SVG <title> 多行提示文本(commit sha / 分支 / 触发者)。
 * SVG <title> 不支持富文本,故用「\n」换行的纯文本。
 *
 * 纯函数,无状态,可单测。
 */
import type { DeploymentEventRun } from './hooks/use-recent-deployment-events';

/** commit sha 截短为前 7 位(对齐 git short 格式)。 */
export function shortCommit(commitSha?: string | null): string | null {
  if (!commitSha) return null;
  const trimmed = commitSha.trim();
  return trimmed ? trimmed.slice(0, 7) : null;
}

/** 把部署运行拼成多行 tooltip 文本;字段缺失时跳过对应行。 */
export function formatDeploymentTooltip(
  run: DeploymentEventRun,
  labels: {
    branch: string;
    trigger: string;
    triggeredBy: string;
    unknownTrigger: string;
  },
): string {
  const lines: string[] = [];
  const commit = shortCommit(run.commitSha);
  if (commit) lines.push(`${labels.trigger}: ${commit}`);
  if (run.branch) lines.push(`${labels.branch}: ${run.branch}`);
  const who = run.actor?.name || run.actor?.email || labels.unknownTrigger;
  lines.push(`${labels.triggeredBy}: ${who}`);
  return lines.join('\n');
}
