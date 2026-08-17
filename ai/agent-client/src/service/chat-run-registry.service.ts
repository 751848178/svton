import { reduceSessionRunState } from './chat-run-state-machine';
import type {
  ChatRunAddress,
  ChatRunTransition,
  SessionRunState,
} from './chat-run.types';

/** Session-keyed observable registry; reducer remains the only mutation policy. */
export class ChatRunRegistryService {
  private readonly bySession = new Map<string | null, SessionRunState>();

  constructor(private readonly notify: () => void = () => {}) {}

  start(address: ChatRunAddress, at = Date.now()): SessionRunState | null {
    return this.transition({ type: 'start', ...address, at });
  }

  transition(transition: ChatRunTransition): SessionRunState | null {
    const current = this.bySession.get(transition.sessionId) ?? null;
    const next = reduceSessionRunState(current, transition);
    if (next === current) return current;
    if (!next) return null;
    this.bySession.set(transition.sessionId, next);
    this.notify();
    return next;
  }

  get(sessionId: string | null): SessionRunState | null {
    return this.bySession.get(sessionId) ?? null;
  }

  currentAddress(sessionId: string | null): ChatRunAddress | null {
    const state = this.get(sessionId);
    return state ? { sessionId: state.sessionId, runId: state.runId } : null;
  }

  /** Hydrate a repository-validated durable mirror before applying recovery. */
  hydrate(state: SessionRunState): void {
    const current = this.bySession.get(state.sessionId);
    if (current && (current.turnRevision > state.turnRevision
      || (current.turnRevision === state.turnRevision && current.revision >= state.revision))) return;
    this.bySession.set(state.sessionId, state);
    this.notify();
  }

  clear(sessionId: string | null): boolean {
    const changed = this.bySession.delete(sessionId);
    if (changed) this.notify();
    return changed;
  }
}
