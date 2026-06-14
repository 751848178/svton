/**
 * Automation / scheduled task types.
 */

export type AutomationTriggerType = 'cron' | 'interval' | 'event';

export interface AutomationTrigger {
  type: AutomationTriggerType;
  /** Cron expression (for type='cron') — 5 fields: minute hour day-of-month month day-of-week */
  expression?: string;
  /** Interval in minutes (for type='interval') */
  minutes?: number;
  /** Event name (for type='event') */
  eventType?: string;
  /** Timezone for cron expressions (e.g. "America/New_York"). Defaults to local. */
  timezone?: string;
}

export interface AutomationDefinition {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  prompt: string;
  agentDefinition?: string;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt: number;
}

export type AutomationRunStatus = 'running' | 'completed' | 'failed';

export interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: number;
  finishedAt?: number;
  status: AutomationRunStatus;
  sessionId: string;
  result?: string;
  error?: string;
}
