import type {
  UserInputAnswers,
  UserInputQuestion,
  UserInputRequest,
  UserInputSettlement,
} from './user-input.types';
import { validateUserInputAnswers } from './user-input-validator';
import { UserInputSettledKeys } from './user-input-settled-keys';

interface PendingUserInput {
  request: UserInputRequest;
  promise: Promise<UserInputAnswers>;
  resolve: (answers: UserInputAnswers) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
  removeAbort?: () => void;
}

type UserInputEventSink =
  (event: { type: 'user_input_requested'; request: UserInputRequest }
    | { type: 'user_input_settled'; sessionId: string; requestId: string; settlement: UserInputSettlement }) => void;

export class UserInputBroker {
  private readonly pending = new Map<string, PendingUserInput>();
  private readonly settled = new UserInputSettledKeys();

  constructor(private readonly emit: UserInputEventSink) {}

  request(
    sessionId: string,
    requestId: string,
    questions: UserInputQuestion[],
    autoResolutionMs?: number,
    signal?: AbortSignal,
  ): Promise<UserInputAnswers> {
    const key = requestKey(sessionId, requestId);
    const existing = this.pending.get(key);
    if (existing) return existing.promise;
    if (this.settled.has(key)) return Promise.reject(new Error('User input request already settled'));

    const request: UserInputRequest = {
      sessionId,
      requestId,
      questions,
      ...(autoResolutionMs === undefined ? {} : { autoResolutionMs }),
    };
    let resolve!: PendingUserInput['resolve'];
    let reject!: PendingUserInput['reject'];
    const promise = new Promise<UserInputAnswers>((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    const pending: PendingUserInput = { request, promise, resolve, reject };
    this.pending.set(key, pending);
    if (autoResolutionMs !== undefined) {
      pending.timer = setTimeout(() => this.interrupt(sessionId, requestId, 'timed_out'), autoResolutionMs);
    }
    if (signal) {
      const abort = () => this.interrupt(sessionId, requestId, 'interrupted');
      signal.addEventListener('abort', abort, { once: true });
      pending.removeAbort = () => signal.removeEventListener('abort', abort);
      if (signal.aborted) abort();
    }
    if (this.pending.has(key)) this.emit({ type: 'user_input_requested', request });
    return promise;
  }

  respond(sessionId: string, requestId: string, answers: unknown): boolean {
    const key = requestKey(sessionId, requestId);
    const pending = this.pending.get(key);
    if (!pending) return false;
    const validated = validateUserInputAnswers(pending.request.questions, answers);
    this.finish(key, pending, 'resolved');
    pending.resolve(validated);
    return true;
  }

  interrupt(
    sessionId: string,
    requestId: string,
    settlement: Exclude<UserInputSettlement, 'resolved'> = 'interrupted',
  ): boolean {
    const key = requestKey(sessionId, requestId);
    const pending = this.pending.get(key);
    if (!pending) return false;
    this.finish(key, pending, settlement);
    pending.reject(new Error(settlement === 'timed_out'
      ? 'User input request timed out'
      : 'User input request interrupted'));
    return true;
  }

  abortPending(sessionId?: string): void {
    for (const pending of [...this.pending.values()]) {
      if (sessionId === undefined || pending.request.sessionId === sessionId) {
        this.interrupt(pending.request.sessionId, pending.request.requestId);
      }
    }
  }

  reset(): void {
    this.abortPending();
    this.settled.clear();
  }

  get size(): number {
    return this.pending.size;
  }

  get settledSize(): number {
    return this.settled.size;
  }

  private finish(key: string, pending: PendingUserInput, settlement: UserInputSettlement): void {
    this.pending.delete(key);
    this.settled.add(key);
    if (pending.timer) clearTimeout(pending.timer);
    pending.removeAbort?.();
    this.emit({
      type: 'user_input_settled',
      sessionId: pending.request.sessionId,
      requestId: pending.request.requestId,
      settlement,
    });
  }
}

function requestKey(sessionId: string, requestId: string): string {
  return `${sessionId}\u0000${requestId}`;
}
