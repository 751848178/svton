import type {
  UserInputAnswers,
  UserInputRequest,
  UserInputSettlement,
} from '@svton/agent-core';
import { UserInputSettledKeys } from '@svton/agent-core';

export type PendingUserInputState = 'pending' | 'submitting' | 'error';

export interface PendingUserInputRequest extends UserInputRequest {
  state: PendingUserInputState;
  error?: string;
  draft?: Record<string, string>;
}

export class ChatUserInputStore {
  private readonly bySession = new Map<string, PendingUserInputRequest[]>();
  private readonly responders = new Map<string, (
    requestId: string,
    answers: UserInputAnswers,
  ) => boolean>();
  private readonly settled = new UserInputSettledKeys();

  constructor(
    private readonly notify: () => void,
    private readonly respond: (
      sessionId: string,
      requestId: string,
      answers: UserInputAnswers,
    ) => boolean = () => false,
  ) {}

  enqueue(
    request: UserInputRequest,
    responder?: (requestId: string, answers: UserInputAnswers) => boolean,
  ): boolean {
    const key = requestKey(request.sessionId, request.requestId);
    const queue = this.bySession.get(request.sessionId) ?? [];
    if (this.settled.has(key) || queue.some((entry) => entry.requestId === request.requestId)) {
      return false;
    }
    this.bySession.set(request.sessionId, [...queue, { ...request, state: 'pending' }]);
    if (responder) this.responders.set(key, responder);
    this.notify();
    return true;
  }

  head(sessionId: string | null): PendingUserInputRequest | null {
    return sessionId ? this.bySession.get(sessionId)?.[0] ?? null : null;
  }

  beginSubmit(
    sessionId: string,
    requestId: string,
    _answers: UserInputAnswers,
  ): PendingUserInputRequest | null {
    const head = this.head(sessionId);
    if (!head || head.requestId !== requestId || head.state !== 'pending') return null;
    this.replaceHead(sessionId, { ...head, state: 'submitting', error: undefined });
    return head;
  }

  submit(
    sessionId: string | null,
    requestId: string,
    answers: UserInputAnswers,
  ): boolean {
    if (!sessionId) return false;
    this.retry(sessionId, requestId);
    if (!this.beginSubmit(sessionId, requestId, answers)) return false;
    try {
      const responder = this.responders.get(requestKey(sessionId, requestId));
      const accepted = responder
        ? responder(requestId, answers)
        : this.respond(sessionId, requestId, answers);
      if (!accepted) this.markError(sessionId, requestId);
      return accepted;
    } catch {
      this.markError(sessionId, requestId);
      return false;
    }
  }

  updateDraft(
    sessionId: string | null,
    requestId: string,
    questionId: string,
    value: string,
  ): boolean {
    const head = this.head(sessionId);
    const question = head?.questions.find((item) => item.id === questionId);
    if (!sessionId || !head || head.requestId !== requestId || !question) return false;
    if (question.isSecret) return true;
    const draft = { ...head.draft };
    if (value.length > 0) draft[questionId] = value;
    else delete draft[questionId];
    this.replaceHead(sessionId, {
      ...head,
      draft: Object.keys(draft).length > 0 ? draft : undefined,
    });
    return true;
  }

  markError(sessionId: string, requestId: string): void {
    const head = this.head(sessionId);
    if (!head || head.requestId !== requestId || head.state !== 'submitting') return;
    this.replaceHead(sessionId, {
      ...head,
      state: 'error',
      error: 'Your response could not be submitted. Please try again.',
    });
  }

  retry(sessionId: string, requestId: string): void {
    const head = this.head(sessionId);
    if (!head || head.requestId !== requestId || head.state !== 'error') return;
    this.replaceHead(sessionId, { ...head, state: 'pending', error: undefined });
  }

  settle(sessionId: string, requestId: string, _settlement: UserInputSettlement): boolean {
    const queue = this.bySession.get(sessionId) ?? [];
    const index = queue.findIndex((entry) => entry.requestId === requestId);
    if (index < 0) return false;
    this.settled.add(requestKey(sessionId, requestId));
    this.responders.delete(requestKey(sessionId, requestId));
    const next = [...queue.slice(0, index), ...queue.slice(index + 1)];
    if (next.length > 0) this.bySession.set(sessionId, next);
    else this.bySession.delete(sessionId);
    this.notify();
    return true;
  }

  interruptAll(): void {
    if (this.bySession.size === 0) return;
    for (const [sessionId, queue] of this.bySession) {
      for (const request of queue) this.settled.add(requestKey(sessionId, request.requestId));
    }
    this.bySession.clear();
    this.responders.clear();
    this.notify();
  }

  interruptSession(sessionId: string): void {
    const queue = this.bySession.get(sessionId);
    if (!queue?.length) return;
    for (const request of queue) this.settled.add(requestKey(sessionId, request.requestId));
    for (const request of queue) this.responders.delete(requestKey(sessionId, request.requestId));
    this.bySession.delete(sessionId);
    this.notify();
  }

  get settledSize(): number {
    return this.settled.size;
  }

  private replaceHead(sessionId: string, request: PendingUserInputRequest): void {
    const queue = this.bySession.get(sessionId);
    if (!queue?.length) return;
    this.bySession.set(sessionId, [request, ...queue.slice(1)]);
    this.notify();
  }
}

function requestKey(sessionId: string, requestId: string): string {
  return `${sessionId}\u0000${requestId}`;
}
