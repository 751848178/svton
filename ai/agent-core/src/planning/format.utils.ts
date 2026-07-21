import type { Plan, PlanStepStatus } from './types';

const STATUS_ICONS: Record<PlanStepStatus, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  completed: '[x]',
  skipped: '[-]',
  failed: '[!]',
};

export function formatPlanMarkdown(plan: Plan): string {
  const lines: string[] = [
    `# ${plan.title}`,
    `Plan ID: ${plan.id}`,
    '',
    ...plan.steps.map(
      (step) => `${STATUS_ICONS[step.status]} ${step.id}: ${step.title}${step.result ? `\n   ${step.result}` : ''}`,
    ),
  ];

  return lines.join('\n');
}
