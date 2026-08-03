/**
 * 发布编排 — 计划级结论推导（F383, invest-3 §E.2）
 *
 * 单一职责：从 ReleasePlan 派生「当前结论 + 推荐下一步 + 阻塞原因」。
 * 纯函数，无副作用，便于测试。
 */
import type { ReleasePlan } from '../types/releases';
import { formatReleaseStageName } from './release-labels';

export interface ReleaseConclusion {
  summary: string;
  nextAction: string;
  blocked: string | null;
}

const TERMINAL_STAGE = ['succeeded', 'skipped', 'canceled'];

/** 推导当前结论 + 推荐下一步 + 阻塞。 */
export function deriveConclusion(plan: ReleasePlan | null, nowMs = Date.now()): ReleaseConclusion {
  if (!plan) {
    return { summary: '未选择发布计划', nextAction: '新建或选择一个发布', blocked: null };
  }
  const stages = plan.stages ?? [];
  const failed = stages.filter((s) => s.status === 'failed');
  const blocked = stages.filter((s) => s.status === 'blocked');
  const awaiting = stages.filter((s) => s.status === 'awaiting_approval');
  const running = stages.filter((s) => s.status === 'running' || s.status === 'queued');
  const allDone = stages.length > 0 && stages.every((s) => TERMINAL_STAGE.includes(s.status));

  if (plan.status === 'succeeded' || allDone) {
    return { summary: '发布已完成', nextAction: '可在部署 Tab 查看运行结果', blocked: null };
  }
  if (failed.length > 0) {
    const failedName = formatReleaseStageName(failed[0].name, failed[0].type);
    return {
      summary: `${failed.length} 个阶段失败`,
      nextAction: `修复后重试 ${failedName}`,
      blocked: failed[0].blockedReason ?? failedName,
    };
  }
  if (awaiting.length > 0) {
    const awaitingName = formatReleaseStageName(awaiting[0].name, awaiting[0].type);
    return {
      summary: '等待人工审批',
      nextAction: `审批 ${awaitingName}（见审批入口）`,
      blocked: null,
    };
  }
  if (running.length > 0) {
    return {
      summary: `正在执行 ${running.length} 个阶段`,
      nextAction: '等待关联运行完成（页面自动刷新）',
      blocked: null,
    };
  }
  if (blocked.length > 0) {
    return {
      summary: `${blocked.length} 个阶段被阻塞`,
      nextAction: '解决阻塞后重试',
      blocked: blocked[0].blockedReason ?? blocked[0].name,
    };
  }
  if (plan.status === 'ready') {
    return { summary: '发布就绪', nextAction: '点击「开始执行」', blocked: null };
  }
  if (plan.status === 'running') {
    const updatedAt = new Date(plan.updatedAt).getTime();
    const stale = Number.isFinite(updatedAt) && nowMs - updatedAt > 15 * 60 * 1000;
    return {
      summary: stale ? '发布长时间未推进' : '发布正在等待下一阶段',
      nextAction: '检查审批、关联任务和阶段依赖',
      blocked: stale ? '计划处于执行中，但 15 分钟内没有状态更新' : null,
    };
  }
  return {
    summary: `发布状态：${plan.status}`,
    nextAction: '刷新查看最新进展',
    blocked: plan.blockedReason ?? null,
  };
}
