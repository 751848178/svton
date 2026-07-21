import type { AutomationDefinition } from './types';

export function shouldRefreshAutomationSchedule(
  existing: AutomationDefinition,
  patch: Partial<AutomationDefinition>,
): boolean {
  return Boolean(patch.trigger || (patch.enabled === true && !existing.enabled));
}
