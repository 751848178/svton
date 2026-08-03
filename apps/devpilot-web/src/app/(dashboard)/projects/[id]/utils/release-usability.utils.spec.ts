import { deriveConclusion } from './release-conclusion.utils';
import { deriveStageActions } from './release-stage-actions.utils';
import { formatReleaseSideEffect, PLAN_STATUS_LABEL, STAGE_TYPE_LABEL } from './release-labels';
import type { ReleasePlan, ReleaseStage } from '../types/releases';

describe('release usability policies', () => {
  it('blocks another retry while a newer attempt is queued', () => {
    const stage = {
      id: 'stage-1',
      status: 'failed',
      required: true,
      attempts: [{ id: 'attempt-2', attemptNo: 2, status: 'queued', createdAt: '2026-07-31' }],
    } as ReleaseStage;

    expect(deriveStageActions(stage, 'running', null).retry).toEqual({
      enabled: false,
      reason: '已有重试正在排队或执行',
    });
  });

  it('reports a running plan with no progress as stale', () => {
    const plan = {
      id: 'plan-1',
      status: 'running',
      updatedAt: '2026-07-31T08:00:00.000Z',
      stages: [{ status: 'pending' }],
    } as ReleasePlan;

    expect(deriveConclusion(plan, new Date('2026-07-31T08:16:00.000Z').getTime())).toEqual({
      summary: '发布长时间未推进',
      nextAction: '检查审批、关联任务和阶段依赖',
      blocked: '计划处于执行中，但 15 分钟内没有状态更新',
    });
  });

  it('uses user-facing release labels and strips internal stage keys', () => {
    expect(PLAN_STATUS_LABEL.succeeded).toBe('成功');
    expect(STAGE_TYPE_LABEL.bootstrap).toBe('初始化数据');
    expect(formatReleaseSideEffect('schema_migration: 修改数据库结构（不可自动回滚）')).toBe(
      '修改数据库结构（不可自动回滚）',
    );
  });
});
