import type { Plan, PlanStep, PlanStepStatus } from './types';
import type { IStorage } from '@svton/agent-platform';

const STORAGE_PREFIX = 'plan:';

let planCounter = 0;

/**
 * Manages task planning and execution tracking.
 *
 * Supports:
 * - Plan creation from task descriptions
 * - Step-by-step execution tracking
 * - Dependency management between steps
 * - Plan persistence via IStorage
 */
export class PlanningManager {
  private plans = new Map<string, Plan>();
  private storage: IStorage | null = null;

  /**
   * Initialize with storage for plan persistence.
   * Loads existing plans from storage.
   */
  async init(storage: IStorage): Promise<void> {
    this.storage = storage;
    await this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    if (!this.storage) return;

    try {
      const keys = await this.storage.list(STORAGE_PREFIX);
      for (const key of keys) {
        const plan = await this.storage.get<Plan>(key);
        if (plan?.id) {
          this.plans.set(plan.id, plan);
          // Update counter to avoid ID collisions
          const num = parseInt(plan.id.split('_')[1], 10);
          if (!isNaN(num) && num > planCounter) planCounter = num;
        }
      }
    } catch {
      // Storage read failure is non-fatal — start with empty plans
    }
  }

  private async persistPlan(plan: Plan): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.set(`${STORAGE_PREFIX}${plan.id}`, plan);
    } catch {
      // Persist failure is non-fatal
    }
  }

  private async removePlanFromStorage(planId: string): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.delete(`${STORAGE_PREFIX}${planId}`);
    } catch {
      // Delete failure is non-fatal
    }
  }

  /**
   * Create a new plan from a list of steps.
   */
  createPlan(title: string, steps: Array<{ title: string; description: string; dependencies?: string[] }>): Plan {
    const planId = `plan_${++planCounter}_${Date.now()}`;
    const now = Date.now();

    const plan: Plan = {
      id: planId,
      title,
      steps: steps.map((s, i) => ({
        id: `step_${i + 1}`,
        title: s.title,
        description: s.description,
        status: 'pending' as PlanStepStatus,
        dependencies: s.dependencies,
      })),
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(planId, plan);
    this.persistPlan(plan);
    return plan;
  }

  /**
   * Get a plan by ID.
   */
  getPlan(planId: string): Plan | null {
    return this.plans.get(planId) ?? null;
  }

  /**
   * Update a step's status.
   */
  updateStepStatus(planId: string, stepId: string, status: PlanStepStatus, result?: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return false;

    step.status = status;
    if (result !== undefined) step.result = result;
    plan.updatedAt = Date.now();
    this.persistPlan(plan);

    return true;
  }

  /**
   * Get the next step that is ready to execute.
   * A step is ready if it's pending and all its dependencies are completed.
   */
  getNextStep(planId: string): PlanStep | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    for (const step of plan.steps) {
      if (step.status !== 'pending') continue;

      // Check dependencies
      if (step.dependencies && step.dependencies.length > 0) {
        const allDepsCompleted = step.dependencies.every((depId) => {
          const dep = plan.steps.find((s) => s.id === depId);
          return dep?.status === 'completed';
        });
        if (!allDepsCompleted) continue;
      }

      return step;
    }

    return null;
  }

  /**
   * Get all steps that are ready to execute (for parallel execution).
   */
  getReadySteps(planId: string): PlanStep[] {
    const plan = this.plans.get(planId);
    if (!plan) return [];

    return plan.steps.filter((step) => {
      if (step.status !== 'pending') return false;

      if (step.dependencies && step.dependencies.length > 0) {
        return step.dependencies.every((depId) => {
          const dep = plan.steps.find((s) => s.id === depId);
          return dep?.status === 'completed';
        });
      }

      return true;
    });
  }

  /**
   * Get overall plan progress.
   */
  getProgress(planId: string): { total: number; completed: number; failed: number; pending: number } {
    const plan = this.plans.get(planId);
    if (!plan) return { total: 0, completed: 0, failed: 0, pending: 0 };

    return {
      total: plan.steps.length,
      completed: plan.steps.filter((s) => s.status === 'completed').length,
      failed: plan.steps.filter((s) => s.status === 'failed').length,
      pending: plan.steps.filter((s) => s.status === 'pending').length,
    };
  }

  /**
   * Format plan as markdown for display or saving.
   */
  formatPlan(planId: string): string {
    const plan = this.plans.get(planId);
    if (!plan) return '';

    const statusIcons: Record<PlanStepStatus, string> = {
      pending: '[ ]',
      in_progress: '[~]',
      completed: '[x]',
      skipped: '[-]',
      failed: '[!]',
    };

    const lines: string[] = [
      `# ${plan.title}`,
      `Plan ID: ${plan.id}`,
      '',
      ...plan.steps.map(
        (step) => `${statusIcons[step.status]} ${step.id}: ${step.title}${step.result ? `\n   ${step.result}` : ''}`,
      ),
    ];

    return lines.join('\n');
  }

  /**
   * Delete a plan.
   */
  deletePlan(planId: string): boolean {
    const existed = this.plans.delete(planId);
    if (existed) this.removePlanFromStorage(planId);
    return existed;
  }
}
