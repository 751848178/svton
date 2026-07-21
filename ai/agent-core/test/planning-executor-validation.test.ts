import { describe, expect, it, vi } from 'vitest';
import { PlanningManager } from '../src/planning/manager';
import {
  planUpdateStepDef,
  PlanCreateExecutor,
  PlanGetStatusExecutor,
  PlanUpdateStepExecutor,
} from '../src/tool/builtins/planning';
import type { ToolCall } from '../src/tool/types';

function makeCall(arguments_: Record<string, unknown>): ToolCall {
  return {
    id: 'plan-validation',
    name: 'plan_create',
    arguments: arguments_,
  };
}

describe('PlanCreateExecutor validation', () => {
  it.each([
    ['blank title', { title: '  \n\t ', steps: [{ title: 'Step', description: 'Do it' }] }, '"title"'],
    ['blank step title', { title: 'Plan', steps: [{ title: '  ', description: 'Do it' }] }, 'must contain'],
    ['blank step description', { title: 'Plan', steps: [{ title: 'Step', description: '\n\t' }] }, 'must contain'],
    [
      'blank dependency id',
      { title: 'Plan', steps: [{ title: 'Step', description: 'Do it', dependencies: [' '] }] },
      'must contain',
    ],
  ])('rejects %s before creating a plan', async (_label, args, expected) => {
    const pm = new PlanningManager();
    const executor = new PlanCreateExecutor(pm);

    const result = await executor.execute(makeCall(args));

    expect(result.isError).toBe(true);
    expect(result.output).toContain(expected);
  });

  it('trims title, steps, and dependencies before creating a plan', async () => {
    const pm = new PlanningManager();
    const executor = new PlanCreateExecutor(pm);

    const result = await executor.execute(makeCall({
      title: '  Plan  ',
      steps: [
        { title: '  First  ', description: '  Start  ' },
        { title: '  Second  ', description: '  Continue  ', dependencies: [' step_1 '] },
      ],
    }));

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('# Plan');
    expect(result.metadata?.planProgress?.steps[0].title).toBe('First');
    expect(pm.getNextStep(result.metadata!.planProgress!.planId)?.title).toBe('First');
    const plan = pm.getPlan(result.metadata!.planProgress!.planId);
    expect(plan?.steps[1].description).toBe('Continue');
    expect(plan?.steps[1].dependencies).toEqual(['step_1']);
  });

  it.each([
    [
      'unknown dependency',
      [
        { title: 'First', description: 'Start', dependencies: ['step_99'] },
        { title: 'Second', description: 'Continue' },
      ],
    ],
    [
      'self dependency',
      [
        { title: 'First', description: 'Start', dependencies: ['step_1'] },
        { title: 'Second', description: 'Continue' },
      ],
    ],
    [
      'cyclic dependency',
      [
        { title: 'First', description: 'Start', dependencies: ['step_2'] },
        { title: 'Second', description: 'Continue', dependencies: ['step_1'] },
      ],
    ],
  ])('rejects %s before creating a plan', async (_label, steps) => {
    const pm = new PlanningManager();
    const executor = new PlanCreateExecutor(pm);

    const result = await executor.execute(makeCall({ title: 'Plan', steps }));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('dependencies');
    expect(result.metadata?.planProgress).toBeUndefined();
  });
});

describe('Planning executor identifier validation', () => {
  it('advertises every supported update status in the tool definition', () => {
    expect(planUpdateStepDef.parameters.properties.status.enum).toEqual([
      'completed',
      'failed',
      'skipped',
      'in_progress',
    ]);
  });

  it.each([
    ['plan_get_status', () => ({ planId: '  ' })],
    ['plan_update_step planId', () => ({ planId: '  ', stepId: 'step_1', status: 'completed' })],
    ['plan_update_step stepId', () => ({ planId: 'plan_1', stepId: '\n\t', status: 'completed' })],
  ])('rejects blank %s before plan lookup', async (label, makeArgs) => {
    const pm = new PlanningManager();
    const getStatus = new PlanGetStatusExecutor(pm);
    const updateStep = new PlanUpdateStepExecutor(pm);
    const executor = label === 'plan_get_status' ? getStatus : updateStep;
    const toolName = label === 'plan_get_status' ? 'plan_get_status' : 'plan_update_step';

    const result = await executor.execute(makeCall(makeArgs()));

    expect(result.isError).toBe(true);
    expect(result.output).toContain(label.includes('stepId') ? '"stepId"' : '"planId"');
  });

  it('trims planId before reading plan status', async () => {
    const pm = new PlanningManager();
    const plan = pm.createPlan('Plan', [{ title: 'Step', description: 'Do it' }]);
    const executor = new PlanGetStatusExecutor(pm);

    const result = await executor.execute(makeCall({ planId: ` ${plan.id}\n` }));

    expect(result.isError).toBeFalsy();
    expect(result.metadata?.planProgress?.planId).toBe(plan.id);
    expect(result.output).toContain('Progress: 0/1 completed');
  });

  it('includes full progress counts in plan status metadata', async () => {
    const pm = new PlanningManager();
    const plan = pm.createPlan('Plan', [
      { title: 'Queued', description: 'Pending work' },
      { title: 'Running', description: 'Active work' },
      { title: 'Skipped', description: 'Skipped work' },
    ]);
    pm.updateStepStatus(plan.id, 'step_2', 'in_progress');
    pm.updateStepStatus(plan.id, 'step_3', 'skipped');
    const executor = new PlanGetStatusExecutor(pm);

    const result = await executor.execute(makeCall({ planId: plan.id }));

    expect(result.isError).toBeFalsy();
    expect(result.metadata?.planProgress?.progress).toEqual({
      total: 3,
      completed: 0,
      failed: 0,
      pending: 1,
      inProgress: 1,
      skipped: 1,
    });
  });

  it('returns target metadata when status plan is not found', async () => {
    const pm = new PlanningManager();
    const executor = new PlanGetStatusExecutor(pm);

    const result = await executor.execute(makeCall({ planId: ' missing_plan\n' }));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('missing_plan');
    expect(result.metadata).toMatchObject({
      planId: 'missing_plan',
    });
  });

  it('trims planId, stepId, status, and result before updating a step', async () => {
    const pm = new PlanningManager();
    const plan = pm.createPlan('Plan', [{ title: 'Step', description: 'Do it' }]);
    const executor = new PlanUpdateStepExecutor(pm);

    const result = await executor.execute(makeCall({
      planId: ` ${plan.id}\t`,
      stepId: ' step_1\n',
      status: ' completed ',
      result: ' done ',
    }));

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('Step step_1 marked as completed');
    expect(result.metadata?.planProgress?.steps[0].status).toBe('completed');
    expect(result.metadata?.planProgress?.progress.completed).toBe(1);
    expect(pm.getPlan(plan.id)?.steps[0].status).toBe('completed');
    expect(pm.getPlan(plan.id)?.steps[0].result).toBe('done');
  });

  it('clears stale step result when status changes without a new result', async () => {
    const pm = new PlanningManager();
    const plan = pm.createPlan('Plan', [{ title: 'Step', description: 'Do it' }]);
    pm.updateStepStatus(plan.id, 'step_1', 'failed', 'Old failure');
    const executor = new PlanUpdateStepExecutor(pm);

    const result = await executor.execute(makeCall({
      planId: plan.id,
      stepId: 'step_1',
      status: 'in_progress',
    }));

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('Step step_1 marked as in_progress');
    expect(result.output).not.toContain('Old failure');
    expect(pm.getPlan(plan.id)?.steps[0].status).toBe('in_progress');
    expect(pm.getPlan(plan.id)?.steps[0].result).toBeUndefined();
  });

  it('returns target metadata when update plan is not found', async () => {
    const pm = new PlanningManager();
    const executor = new PlanUpdateStepExecutor(pm);

    const result = await executor.execute(makeCall({
      planId: ' missing_plan ',
      stepId: ' step_1\n',
      status: ' completed ',
    }));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('missing_plan');
    expect(result.metadata).toMatchObject({
      planId: 'missing_plan',
      stepId: 'step_1',
      status: 'completed',
    });
  });

  it('returns target metadata when update step is not found', async () => {
    const pm = new PlanningManager();
    const plan = pm.createPlan('Plan', [{ title: 'Step', description: 'Do it' }]);
    const executor = new PlanUpdateStepExecutor(pm);

    const result = await executor.execute(makeCall({
      planId: plan.id,
      stepId: ' missing_step ',
      status: ' failed ',
    }));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('missing_step');
    expect(result.metadata).toMatchObject({
      planId: plan.id,
      stepId: 'missing_step',
      status: 'failed',
      availableStepIds: ['step_1'],
    });
  });

  it('returns target metadata when updateStepStatus returns false', async () => {
    const pm = new PlanningManager();
    const plan = pm.createPlan('Plan', [{ title: 'Step', description: 'Do it' }]);
    vi.spyOn(pm, 'updateStepStatus').mockReturnValue(false);
    const executor = new PlanUpdateStepExecutor(pm);

    const result = await executor.execute(makeCall({
      planId: plan.id,
      stepId: 'step_1',
      status: 'skipped',
    }));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to update step');
    expect(result.metadata).toMatchObject({
      planId: plan.id,
      stepId: 'step_1',
      status: 'skipped',
    });
  });
});
