import type { TranslationKey, Translator } from '@svton/ui';

const PHASE_KEYS: Record<string, readonly [TranslationKey, TranslationKey]> = {
  idle: ['session.activity.idle.label', 'session.activity.idle.description'],
  inProgress: ['session.activity.inProgress.label', 'session.activity.inProgress.description'],
  waitingOnApproval: ['session.activity.waitingOnApproval.label', 'session.activity.waitingOnApproval.description'],
  waitingOnUserInput: ['session.activity.waitingOnUserInput.label', 'session.activity.waitingOnUserInput.description'],
  finalizing: ['session.activity.finalizing.label', 'session.activity.finalizing.description'],
  completed: ['session.activity.completed.label', 'session.activity.completed.description'],
  failed: ['session.activity.failed.label', 'session.activity.failed.description'],
  interrupted: ['session.activity.interrupted.label', 'session.activity.interrupted.description'],
};

export function localizeSessionActivity(
  activity: { phase: string; statusLabel: string; statusDescription: string },
  t: Translator,
) {
  const keys = PHASE_KEYS[activity.phase];
  return keys
    ? { statusLabel: t(keys[0]), statusDescription: t(keys[1]) }
    : { statusLabel: activity.statusLabel, statusDescription: activity.statusDescription };
}
