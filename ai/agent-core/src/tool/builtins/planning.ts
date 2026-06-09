import type { ToolCall, ToolResult, IToolExecutor } from '../types';
import type { PlanningManager } from '../../planning/manager';

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
      status: { type: 'string', enum: ['completed', 'failed', 'skipped'], description: 'New status' },
      result: { type: 'string', description: 'Result summary for this step' },
    },
    required: ['planId', 'stepId', 'status'],
  },
};

// ── Executors ──────────────────────────────────────────────

export class PlanCreateExecutor implements IToolExecutor {
  constructor(private pm: PlanningManager) {}
  async execute(call: ToolCall): Promise<ToolResult> {
    const { title, steps } = call.arguments as { title?: string; steps?: Array<{ title: string; description: string; dependencies?: string[] }> };

    if (!title || typeof title !== 'string') {
      return { callId: call.id, output: 'Error: "title" is required and must be a string.', isError: true };
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return { callId: call.id, output: 'Error: "steps" is required and must be a non-empty array of { title, description } objects.', isError: true };
    }

    const plan = this.pm.createPlan(title, steps);
    return {
      callId: call.id,
      output: this.pm.formatPlan(plan.id),
      metadata: {
        planProgress: {
          planId: plan.id,
          title: plan.title,
          steps: plan.steps.map((s) => ({ id: s.id, title: s.title, status: s.status })),
        },
      },
    };
  }
}

export class PlanGetStatusExecutor implements IToolExecutor {
  constructor(private pm: PlanningManager) {}
  async execute(call: ToolCall): Promise<ToolResult> {
    const { planId } = call.arguments as { planId?: string };

    if (!planId || typeof planId !== 'string') {
      return { callId: call.id, output: 'Error: "planId" is required and must be a string.', isError: true };
    }

    const plan = this.pm.getPlan(planId);
    if (!plan) {
      return { callId: call.id, output: `Plan ${planId} not found`, isError: true };
    }
    const next = this.pm.getNextStep(planId);
    const progress = this.pm.getProgress(planId);
    const formatted = this.pm.formatPlan(planId);
    return {
      callId: call.id,
      output: `${formatted}\n\nProgress: ${progress.completed}/${progress.total} completed. Next step: ${next ? `${next.id}: ${next.title}` : 'none (all done or blocked)'}`,
      metadata: {
        planProgress: {
          planId: plan.id,
          title: plan.title,
          steps: plan.steps.map((s) => ({ id: s.id, title: s.title, status: s.status })),
        },
      },
    };
  }
}

export class PlanUpdateStepExecutor implements IToolExecutor {
  constructor(private pm: PlanningManager) {}
  async execute(call: ToolCall): Promise<ToolResult> {
    const { planId, stepId, status, result } = call.arguments as {
      planId?: string; stepId?: string; status?: string; result?: string
    };

    if (!planId) return { callId: call.id, output: 'Error: "planId" is required.', isError: true };
    if (!stepId) return { callId: call.id, output: 'Error: "stepId" is required.', isError: true };
    if (!status || !['completed', 'failed', 'skipped', 'in_progress'].includes(status)) {
      return { callId: call.id, output: 'Error: "status" must be one of: completed, failed, skipped, in_progress.', isError: true };
    }

    const plan = this.pm.getPlan(planId);
    if (!plan) return { callId: call.id, output: `Error: Plan "${planId}" not found. Use plan_create first.`, isError: true };

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      const available = plan.steps.map((s) => s.id).join(', ');
      return { callId: call.id, output: `Error: Step "${stepId}" not found. Available steps: ${available}`, isError: true };
    }

    const ok = this.pm.updateStepStatus(planId, stepId, status as 'completed' | 'failed' | 'skipped', result);
    if (!ok) {
      return { callId: call.id, output: `Failed to update step ${stepId} in plan ${planId}`, isError: true };
    }
    const formatted = this.pm.formatPlan(planId);
    return {
      callId: call.id,
      output: `Step ${stepId} marked as ${status}.\n\n${formatted}`,
      metadata: {
        planProgress: {
          planId: plan.id,
          title: plan.title,
          steps: plan.steps.map((s) => ({ id: s.id, title: s.title, status: s.status })),
        },
      },
    };
  }
}
