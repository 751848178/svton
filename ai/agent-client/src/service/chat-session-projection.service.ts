import type { Usage } from '@earendil-works/pi-ai';
import type { DisplayMessage, PlanProgress } from '../types';

/** Stores compatibility-only usage and plan projections per session owner. */
export class ChatSessionProjectionService {
  readonly usage = new Map<string | null, Usage | null>();
  readonly plans = new Map<string | null, PlanProgress | null>();

  captureLoaded(sessionId: string | null, messages: DisplayMessage[]): void {
    this.usage.set(sessionId, findLatestUsage(messages));
    this.plans.set(sessionId, findLatestPlan(messages));
  }

  selected(sessionId: string | null): { usage: Usage | null; plan: PlanProgress | null } {
    return {
      usage: this.usage.get(sessionId) ?? null,
      plan: this.plans.get(sessionId) ?? null,
    };
  }

  delete(sessionId: string | null): void {
    this.usage.delete(sessionId);
    this.plans.delete(sessionId);
  }
}

function findLatestUsage(messages: DisplayMessage[]): Usage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const usage = messages[index].timeline?.usage;
    if (usage) return usage;
  }
  return null;
}

function findLatestPlan(messages: DisplayMessage[]): PlanProgress | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const blocks = messages[messageIndex].blocks ?? [];
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex];
      const plan = block.type === 'plan' ? block.plan : undefined;
      if (plan) return { planId: plan.planId, title: plan.title, steps: plan.steps };
    }
  }
  return null;
}
