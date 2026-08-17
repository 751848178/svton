import { useCallback, useMemo, useRef, useState } from 'react';
import {
  encodeModelKey,
  modelKeysEqual,
  toPublicModelSwitchError,
  useAgentContext,
  useChat,
  type ModelKey,
  type ModelSwitchHost,
  type ModelSwitchPhase,
  type ModelSwitchRequest,
  type ModelSwitchResult,
} from '@svton/agent-client';
import type { ReasoningEffort } from '@svton/agent-core';
import type { ModelSelectionControl } from '@svton/agent-ui';
import { useI18n, type Translator } from '@svton/ui';
import type { LiveModelRegistry } from './model-registry';
import { useModelRegistry } from './use-model-registry';
import { releaseSessionValue, setBoundedSessionValue } from './model-switch-session-state';

type SessionAddress = string | null;

interface UseModelSwitchOptions {
  registry: LiveModelRegistry;
  host: ModelSwitchHost;
  initialActive: ModelKey;
  reasoningEffort: ReasoningEffort | undefined;
}

interface SwitchViewState {
  phase: ModelSwitchPhase;
  pending?: ModelKey;
  result?: ModelSwitchResult;
  message?: string;
}

const IDLE_STATE: SwitchViewState = { phase: 'idle' };

export function useModelSwitch({
  registry,
  host,
  initialActive,
  reasoningEffort,
}: UseModelSwitchOptions): ModelSelectionControl {
  const { translate: t } = useI18n();
  useModelRegistry(registry);
  const { chatService } = useAgentContext();
  const { currentModelKey } = useChat();
  const sessionId = chatService.activeSessionId;
  const active = currentModelKey ?? initialActive;
  const [persisted, setPersisted] = useState(host.getPersisted);
  const [sessionStates, setSessionStates] = useState(
    () => new Map<SessionAddress, SwitchViewState>(),
  );
  const state = sessionStates.get(sessionId) ?? IDLE_STATE;
  const requestNumber = useRef(0);
  const latestRequests = useRef(new Map<SessionAddress, string>());
  const records = registry.selectable(active);
  const setSessionState = useCallback((
    address: SessionAddress,
    update: SwitchViewState | ((current: SwitchViewState) => SwitchViewState),
  ) => {
    setSessionStates((current) => {
      const previous = current.get(address) ?? IDLE_STATE;
      const value = typeof update === 'function' ? update(previous) : update;
      return setBoundedSessionValue(current, address, value);
    });
  }, []);

  const select = useCallback(async (value: string) => {
    const target = registry.resolve(value);
    const record = registry.find(target);
    if (!target || !record || record.hidden) {
      setSessionState(sessionId, {
        phase: 'failed', message: t('settings.model.unselectable'),
      });
      return;
    }
    if (modelKeysEqual(target, active)) return;
    const request: ModelSwitchRequest = {
      requestId: `model-switch-${++requestNumber.current}`,
      sessionId,
      from: active,
      to: target,
      reasoningEffort,
      persistence: 'default-and-session',
    };
    latestRequests.current = setBoundedSessionValue(
      latestRequests.current, sessionId, request.requestId,
    );
    const result = await chatService.runtimeSettings.switchModel(request, host, (phase, owner) => {
      if (latestRequests.current.get(owner.sessionId) !== owner.requestId) return;
      setSessionState(owner.sessionId, {
        phase,
        pending: phase === 'preparing' || phase === 'committing' ? owner.to : undefined,
        message: phaseMessage(phase, registry, owner.to, t),
      });
    });
    if (!releaseSessionValue(latestRequests.current, sessionId, request.requestId)) return;
    if (result.kind === 'succeeded') setPersisted(result.persisted);
    setSessionState(sessionId, {
      phase: result.kind === 'succeeded' ? 'succeeded' : 'failed',
      result,
      message: resultMessage(result, registry, t),
    });
  }, [active, chatService, host, reasoningEffort, registry, sessionId, setSessionState, t]);

  const retryPersistence = useCallback(async () => {
    setSessionState(sessionId, (current) => ({
      ...current, phase: 'committing', message: t('settings.model.retrying'),
    }));
    try {
      await chatService.runtimeSettings.retryModelDefaultPersistence(active, host);
      setPersisted(active);
      setSessionState(sessionId, {
        phase: 'succeeded',
        message: t('settings.model.defaultSaved', { model: label(registry, active, t) }),
      });
    } catch (error) {
      setSessionState(sessionId, (current) => ({
        ...current,
        phase: 'failed',
        message: toPublicModelSwitchError(error),
      }));
    }
  }, [active, chatService, host, registry, sessionId, setSessionState, t]);

  return useMemo(() => ({
    options: records.map((record) => ({
      value: record.value,
      modelName: record.displayName,
      providerName: record.providerName,
      providerId: record.key.providerId,
      accessibleName: `(${record.key.providerId}) ${record.displayName} — ${record.providerName}`,
      hiddenCurrent: record.hidden,
      removedCurrent: record.removed,
      bootstrap: record.source === 'bootstrap',
    })),
    activeValue: encodeModelKey(active),
    persistedValue: encodeModelKey(persisted),
    pendingValue: state.pending ? encodeModelKey(state.pending) : undefined,
    phase: state.phase,
    message: state.message,
    disabledReason: chatService.runtimeSettings.getModelSwitchBlockedReason() ?? undefined,
    activeLabel: label(registry, active, t),
    persistedLabel: label(registry, persisted, t),
    canRetryPersistence: state.result?.kind === 'failed'
      && state.result.activeDefaultSplit,
    select,
    retryPersistence,
    dismissResult: () => setSessionState(sessionId, IDLE_STATE),
  }), [active, chatService, persisted, records, registry, retryPersistence, select,
    sessionId, setSessionState, state, t]);
}

function label(registry: LiveModelRegistry, key: ModelKey, t: Translator): string {
  const record = registry.display(key);
  const suffix = record.removed ? t('settings.model.removedSuffix') : '';
  return `${record.providerName} (${record.key.providerId}) · ${record.displayName}${suffix}`;
}

function phaseMessage(
  phase: ModelSwitchPhase,
  registry: LiveModelRegistry,
  target: ModelKey,
  t: Translator,
): string | undefined {
  const model = label(registry, target, t);
  if (phase === 'preparing') return t('settings.model.preparing', { model });
  if (phase === 'committing') return t('settings.model.committing', { model });
  return undefined;
}

function resultMessage(
  result: ModelSwitchResult,
  registry: LiveModelRegistry,
  t: Translator,
): string {
  if (result.kind === 'succeeded') {
    return t('settings.model.succeeded', { model: label(registry, result.active, t) });
  }
  if (result.kind === 'superseded') return t('settings.model.superseded');
  if (result.activeDefaultSplit) {
    return t('settings.model.splitFailure', {
      active: label(registry, result.active, t),
      persisted: label(registry, result.persisted, t),
      message: result.message,
    });
  }
  return result.message;
}
