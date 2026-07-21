import type { AutomationRun } from './types';

export function cloneAutomationRun(run: AutomationRun): AutomationRun {
  return { ...run };
}
