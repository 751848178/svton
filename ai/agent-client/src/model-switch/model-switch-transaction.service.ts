import type {
  ModelKey,
  ModelSwitchPhase,
  ModelSwitchRequest,
  ModelSwitchResult,
} from './model-switch.types';
import { toPublicModelSwitchError } from './model-switch-public-error';

export interface ModelSwitchBindings<Candidate> {
  active: (sessionId: string | null) => ModelKey;
  persisted: () => ModelKey;
  blockedReason: (sessionId: string | null) => string | null;
  prepare: (request: ModelSwitchRequest) => Promise<Candidate>;
  commit: (request: ModelSwitchRequest, candidate: Candidate) => boolean;
  dispose: (candidate: Candidate) => void;
  persistDefault: (request: ModelSwitchRequest, candidate: Candidate) => Promise<void>;
  commitPersistedDefault: (request: ModelSwitchRequest, candidate: Candidate) => void;
  publishPhase: (phase: ModelSwitchPhase, request: ModelSwitchRequest) => void;
}

export class ModelSwitchTransactionService {
  private generation = 0;
  private phase: ModelSwitchPhase = 'idle';

  async execute<Candidate>(
    request: ModelSwitchRequest,
    bindings: ModelSwitchBindings<Candidate>,
  ): Promise<ModelSwitchResult> {
    if (this.phase === 'committing') {
      return this.failed(request, bindings, 'blocked', '另一项模型提交正在持久化，请稍候。');
    }
    const generation = ++this.generation;
    const initialBlock = bindings.blockedReason(request.sessionId);
    if (initialBlock) return this.failed(request, bindings, 'blocked', initialBlock);
    this.setPhase('preparing', request, bindings);
    let candidate: Candidate;
    try {
      candidate = await bindings.prepare(request);
    } catch (error) {
      if (generation !== this.generation) return this.superseded(request, bindings);
      this.setPhase('failed', request, bindings);
      return this.failed(request, bindings, 'prepare', toPublicModelSwitchError(error));
    }
    if (generation !== this.generation) {
      bindings.dispose(candidate);
      return this.superseded(request, bindings);
    }
    const commitBlock = bindings.blockedReason(request.sessionId);
    if (commitBlock) {
      bindings.dispose(candidate);
      this.setPhase('failed', request, bindings);
      return this.failed(request, bindings, 'blocked', commitBlock);
    }
    this.setPhase('committing', request, bindings);
    let committed = false;
    try {
      committed = bindings.commit(request, candidate);
    } catch (error) {
      bindings.dispose(candidate);
      this.setPhase('failed', request, bindings);
      return this.failed(request, bindings, 'commit', toPublicModelSwitchError(error));
    }
    if (!committed) {
      bindings.dispose(candidate);
      this.setPhase('failed', request, bindings);
      return this.failed(request, bindings, 'commit', '目标会话已变化，候选运行时未提交。');
    }
    if (request.persistence === 'default-and-session') {
      try {
        await bindings.persistDefault(request, candidate);
        bindings.commitPersistedDefault(request, candidate);
      } catch (error) {
        this.setPhase('failed', request, bindings);
        return {
          kind: 'failed',
          requestId: request.requestId,
          active: bindings.active(request.sessionId),
          persisted: bindings.persisted(),
          message: toPublicModelSwitchError(error),
          code: 'persistence',
          activeDefaultSplit: true,
        };
      }
    }
    this.setPhase('succeeded', request, bindings);
    return {
      kind: 'succeeded',
      requestId: request.requestId,
      active: bindings.active(request.sessionId),
      persisted: request.persistence === 'default-and-session'
        ? request.to
        : bindings.persisted(),
    };
  }

  private setPhase<Candidate>(
    phase: ModelSwitchPhase,
    request: ModelSwitchRequest,
    bindings: ModelSwitchBindings<Candidate>,
  ): void {
    this.phase = phase;
    bindings.publishPhase(phase, request);
  }

  private failed<Candidate>(
    request: ModelSwitchRequest,
    bindings: ModelSwitchBindings<Candidate>,
    code: 'blocked' | 'prepare' | 'commit',
    message: string,
  ): ModelSwitchResult {
    return {
      kind: 'failed',
      requestId: request.requestId,
      active: bindings.active(request.sessionId),
      persisted: bindings.persisted(),
      message,
      code,
      activeDefaultSplit: false,
    };
  }

  private superseded<Candidate>(
    request: ModelSwitchRequest,
    bindings: ModelSwitchBindings<Candidate>,
  ): ModelSwitchResult {
    return {
      kind: 'superseded',
      requestId: request.requestId,
      active: bindings.active(request.sessionId),
      persisted: bindings.persisted(),
    };
  }
}
