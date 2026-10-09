import type { Logger } from '../shared/log.js';
import type { ExecutionHooks, StageKey } from './contracts.js';
import { EventSink } from './event-sink.js';
import { JobObserver } from './job-observer.js';
import { publicUrl } from './project-context.js';

export function pipelineLogger(sink: EventSink, hooks: ExecutionHooks): Logger {
  const observer = new JobObserver(sink, hooks);
  const diagnostic = (level: string, message: string, detail?: Record<string, unknown>) =>
    sink.enqueue({ type: 'log', stageKey: observer.currentStage, message: `${message}${detail ? ` ${JSON.stringify(detail)}` : ''}\n`, detail: { level } });
  return {
    info: (message, detail) => diagnostic('info', message, detail),
    warn: (message, detail) => diagnostic('warn', message, detail),
    error: (message, detail) => diagnostic('error', message, detail),
    observeJob: (o) => observer.observe(o),
    checkpoint: () => sink.checkpoint(),
    operationId: async (stage, service, handle) => {
      if (!hooks.executionId) return undefined;
      const operationId = `${hooks.executionId}:${stage}:${service ?? 'group'}`;
      await sink.emit({ type: 'remote-intent', stageKey: stage as StageKey, serviceKey: service,
        detail: { operationId, agentRole: stage === 'deploy' ? 'runtime' : 'builder', urlRef: publicUrl(handle.url) } });
      return operationId;
    },
    stage: async (key, status, detail) => {
      observer.currentStage = key as StageKey;
      await sink.emit({ type: 'stage', stageKey: key as StageKey, status, detail });
      if (key === 'cleanup' && detail?.builderRelease) await sink.emit({ type: 'cleanup', status: String(detail.builderRelease), detail });
    },
  };
}
