import type { ToolCall, ToolResult, IToolExecutor } from '../types';
import type { PlanningManager } from '../../planning/manager';
import {
  normalizeOptionalPlanResult,
  normalizePlanSteps,
  normalizePlanTitle,
  normalizePlanUpdateStatus,
  normalizeRequiredPlanString,
} from './planning-validation.utils';
import { buildPlanProgressMetadata } from './planning-progress-metadata.utils';
import { missingPlanStepTargetMetadata, planStepTargetMetadata, planTargetMetadata } from './planning-target-metadata.utils';

// ── Tool definitions ───────────────────────────────────────

export const planCreateDef = {
  name: 'plan_create',
  description: 'Create an execution plan with ordered steps. Use this for complex multi-step tasks.',
  parameters: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Plan title' },
      steps: {
        type: 'array',
        description: 'List of steps',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Step title' },
            description: { type: 'string', description: 'What to do in this step' },
            dependencies: { type: 'array', items: { type: 'string' }, description: 'Step IDs this depends on' },
          },
          required: ['title', 'description'],
        },
      },
    },
    required: ['title', 'steps'],
  },
};

export const planGetStatusDef = {
  name: 'plan_get_status',
  description: 'Get the current status of a plan, including the next step to execute.',
  parameters: {
    type: 'object' as const,
    properties: {
      planId: { type: 'string', description: 'The plan ID' },
    },
    required: ['planId'],
  },
};

export const planUpdateStepDef = {
  name: 'plan_update_step',
  description: 'Update the status of a plan step after completing or failing it.',
  parameters: {
    type: 'object' as const,
    properties: {
      planId: { type: 'string', description: 'The plan ID' },
      stepId: { type: 'string', description: 'The step ID' },
      status: { type: 'string', enum: ['completed', 'failed', 'skipped', 'in_progress'], description: 'New status' },
      result: { type: 'string', description: 'Result summary for this step' },
    },
    required: ['planId', 'stepId', 'status'],
  },
};

// ── Executors ──────────────────────────────────────────────

export class PlanCreateExecutor implements IToolExecutor {
  constructor(private pm: PlanningManager) {}
  async execute(call: ToolCall): Promise<ToolResult> {
    const { title, steps } = call.arguments as { title?: unknown; steps?: unknown };

    const titleResult = normalizePlanTitle(title);
    if (titleResult.error || !titleResult.title) {
      return { callId: call.id, output: titleResult.error ?? 'Error: "title" is invalid.', isError: true };
    }
    const stepsResult = normalizePlanSteps(steps);
    if (stepsResult.error || !stepsResult.steps) {
      return { callId: call.id, output: stepsResult.error ?? 'Error: "steps" is invalid.', isError: true };
    }

    const plan = this.pm.createPlan(titleResult.title, stepsResult.steps);
    return {
      callId: call.id,
      output: this.pm.formatPlan(plan.id),
      metadata: {
        planProgress: buildPlanProgressMetadata(this.pm, plan),
      },
    };
  }
}

export class PlanGetStatusExecutor implements IToolExecutor {
  constructor(private pm: PlanningManager) {}
  async execute(call: ToolCall): Promise<ToolResult> {
    const { planId } = call.arguments as { planId?: unknown };

    const planIdResult = normalizeRequiredPlanString(planId, 'planId');
    if (planIdResult.error || !planIdResult.value) {
      return { callId: call.id, output: planIdResult.error ?? 'Error: "planId" is invalid.', isError: true };
    }
    const resolvedPlanId = planIdResult.value;

    const plan = this.pm.getPlan(resolvedPlanId);
    if (!plan) {
      return { callId: call.id, output: `Plan ${resolvedPlanId} not found`, isError: true, metadata: planTargetMetadata(resolvedPlanId) };
    }
    const next = this.pm.getNextStep(resolvedPlanId);
    const progress = this.pm.getProgress(resolvedPlanId);
    const formatted = this.pm.formatPlan(resolvedPlanId);
    return {
      callId: call.id,
      output: `${formatted}\n\nProgress: ${progress.completed}/${progress.total} completed. Next step: ${next ? `${next.id}: ${next.title}` : 'none (all done or blocked)'}`,
      metadata: {
        planProgress: buildPlanProgressMetadata(this.pm, plan),
      },
    };
  }
}

export class PlanUpdateStepExecutor implements IToolExecutor {
  constructor(private pm: PlanningManager) {}
  async execute(call: ToolCall): Promise<ToolResult> {
    const { planId, stepId, status, result } = call.arguments as {
      planId?: unknown; stepId?: unknown; status?: unknown; result?: unknown
    };

    const planIdResult = normalizeRequiredPlanString(planId, 'planId');
    if (planIdResult.error || !planIdResult.value) {
      return { callId: call.id, output: planIdResult.error ?? 'Error: "planId" is invalid.', isError: true };
    }
    const stepIdResult = normalizeRequiredPlanString(stepId, 'stepId');
    if (stepIdResult.error || !stepIdResult.value) {
      return { callId: call.id, output: stepIdResult.error ?? 'Error: "stepId" is invalid.', isError: true };
    }
    const statusResult = normalizePlanUpdateStatus(status);
    if (statusResult.error || !statusResult.status) {
      return { callId: call.id, output: statusResult.error ?? 'Error: "status" is invalid.', isError: true };
    }
    const resultValue = normalizeOptionalPlanResult(result);
    if (resultValue.error) {
      return { callId: call.id, output: resultValue.error, isError: true };
    }
    const resolvedPlanId = planIdResult.value;
    const resolvedStepId = stepIdResult.value;
    const resolvedStatus = statusResult.status;
    const targetMetadata = planStepTargetMetadata(resolvedPlanId, resolvedStepId, resolvedStatus);

    const plan = this.pm.getPlan(resolvedPlanId);
    if (!plan) {
      return { callId: call.id, output: `Error: Plan "${resolvedPlanId}" not found. Use plan_create first.`, isError: true, metadata: targetMetadata };
    }

    const step = plan.steps.find((s) => s.id === resolvedStepId);
    if (!step) {
      const available = plan.steps.map((s) => s.id).join(', ');
      return {
        callId: call.id,
        output: `Error: Step "${resolvedStepId}" not found. Available steps: ${available}`,
        isError: true,
        metadata: missingPlanStepTargetMetadata(
          resolvedPlanId,
          resolvedStepId,
          resolvedStatus,
          plan.steps.map((s) => s.id),
        ),
      };
    }

    const ok = this.pm.updateStepStatus(
      resolvedPlanId,
      resolvedStepId,
      resolvedStatus,
      resultValue.result,
    );
    if (!ok) {
      return { callId: call.id, output: `Failed to update step ${resolvedStepId} in plan ${resolvedPlanId}`, isError: true, metadata: targetMetadata };
    }
    const updatedPlan = this.pm.getPlan(resolvedPlanId) ?? plan;
    const formatted = this.pm.formatPlan(resolvedPlanId);
    return {
      callId: call.id,
      output: `Step ${resolvedStepId} marked as ${resolvedStatus}.\n\n${formatted}`,
      metadata: {
        planProgress: buildPlanProgressMetadata(this.pm, updatedPlan),
      },
    };
  }
}
