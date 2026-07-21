import type { AutomationDefinition, AutomationTrigger } from './types';

export function cloneAutomationDefinition(definition: AutomationDefinition): AutomationDefinition {
  return { ...definition, trigger: cloneAutomationTrigger(definition.trigger) };
}

export function cloneAutomationTrigger(trigger: AutomationTrigger): AutomationTrigger {
  return { ...trigger };
}
