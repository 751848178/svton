/**
 * Planning system types.
 */

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: PlanStepStatus;
  result?: string;
  dependencies?: string[];
}

export interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}
