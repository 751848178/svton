import { useCallback, useMemo, useRef, useState } from 'react';
import {
  useAgentContext,
  useChat,
  type PermissionProfileHost,
  type PermissionProfilePhase,
} from '@svton/agent-client';
import type { PermissionMode, ReasoningEffort } from '@svton/agent-core';
import type {
  ExecutionProfileControl,
  ReasoningControl,
  SessionSettingPhase,
} from '@svton/agent-ui';
import { useI18n, type Translator } from '@svton/ui';
import type { LiveModelRegistry } from './model-registry';
import { useModelRegistry } from './use-model-registry';
import { releaseSessionValue, setBoundedSessionValue } from './model-switch-session-state';

type SessionAddress = string | null;
interface ViewState { phase: SessionSettingPhase; message?: string }
const IDLE: ViewState = { phase: 'idle' };

export function useSessionSettingsControl(
  registry: LiveModelRegistry,
  host: PermissionProfileHost,
): { execution: ExecutionProfileControl; reasoning: ReasoningControl } {
  const { translate: t } = useI18n();
  useModelRegistry(registry);
  const { chatService } = useAgentContext();
  const { currentModelKey, currentPermissionMode, currentReasoningEffort } = useChat();
  const sessionId = chatService.activeSessionId;
  const [executionStates, setExecutionStates] = useState(
    () => new Map<SessionAddress, ViewState>(),
  );
  const [reasoningStates, setReasoningStates] = useState(
    () => new Map<SessionAddress, ViewState>(),
  );
  const requestNumber = useRef(0);
  const latest = useRef(new Map<SessionAddress, string>());
  const executionState = executionStates.get(sessionId) ?? IDLE;
  const reasoningState = reasoningStates.get(sessionId) ?? IDLE;
  const record = registry.find(currentModelKey);
  const defaultEffort = validEffort(record?.defaultReasoningEffort);
  const availableEfforts = supportedEfforts(
    record?.reasoningEfforts ?? [], record?.defaultReasoningEffort,
  );
  const setState = useCallback((
    setter: typeof setExecutionStates,
    address: SessionAddress,
    state: ViewState,
  ) => setter((current) => setBoundedSessionValue(current, address, state)), []);

  const selectExecution = useCallback(async (to: PermissionMode) => {
    const from = currentPermissionMode;
    if (!isPermissionMode(to)) {
      setState(setExecutionStates, sessionId, {
        phase: 'failed', message: t('settings.execution.unknown'),
      });
      return;
    }
    if (!from || from === to) return;
    const requestId = `permission-${++requestNumber.current}`;
    latest.current = setBoundedSessionValue(latest.current, sessionId, requestId);
    const result = await chatService.runtimeSettings.switchPermissionProfile(
      { requestId, sessionId, from, to }, host,
      (phase: PermissionProfilePhase, request) => {
        if (latest.current.get(request.sessionId) !== request.requestId) return;
        setState(setExecutionStates, request.sessionId, {
          phase, message: executionPhaseMessage(phase, request.to, t),
        });
      },
    );
    if (!releaseSessionValue(latest.current, sessionId, requestId)) return;
    setState(setExecutionStates, sessionId, {
      phase: result.kind === 'succeeded' ? 'succeeded' : 'failed',
      message: result.kind === 'succeeded'
        ? t('settings.execution.succeeded', { profile: permissionLabel(to, t) })
        : permissionFailureMessage(result, t),
    });
  }, [chatService, currentPermissionMode, host, sessionId, setState, t]);

  const selectReasoning = useCallback(async (effort: ReasoningEffort | undefined) => {
    if (effort === currentReasoningEffort) return;
    if (effort !== undefined && !availableEfforts.includes(effort)) {
      setState(setReasoningStates, sessionId, {
        phase: 'failed', message: t('settings.reasoning.unsupported'),
      });
      return;
    }
    const label = reasoningLabel(effort, t);
    setState(setReasoningStates, sessionId, {
      phase: 'applying', message: t('settings.reasoning.applying', { effort: label }),
    });
    const result = await chatService.runtimeSettings.setReasoningEffort(effort);
    setState(setReasoningStates, sessionId, {
      phase: result.kind === 'succeeded' ? 'succeeded' : 'failed',
      message: result.kind === 'succeeded'
        ? t('settings.reasoning.succeeded', { effort: label })
        : result.message,
    });
  }, [availableEfforts, chatService, currentReasoningEffort, sessionId, setState, t]);

  const blockedReason = chatService.runtimeSettings.getPermissionProfileBlockedReason() ?? undefined;
  return useMemo(() => ({
    execution: {
      value: currentPermissionMode,
      phase: executionState.phase,
      message: executionState.message,
      disabledReason: currentPermissionMode ? blockedReason : t('settings.execution.unsupported'),
      select: selectExecution,
    },
    reasoning: {
      value: currentReasoningEffort,
      availableEfforts,
      defaultEffort,
      phase: reasoningState.phase,
      message: reasoningState.message,
      disabledReason: blockedReason,
      select: selectReasoning,
    },
  }), [availableEfforts, blockedReason, currentPermissionMode, currentReasoningEffort, defaultEffort,
    executionState, reasoningState, selectExecution, selectReasoning, t]);
}

function supportedEfforts(values: readonly string[], fallback?: string): Exclude<ReasoningEffort, undefined>[] {
  const source = fallback ? [...values, fallback] : values;
  return source.filter((value, index): value is Exclude<ReasoningEffort, undefined> =>
    (value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh')
    && source.indexOf(value) === index);
}

function validEffort(value?: string): Exclude<ReasoningEffort, undefined> | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
    ? value
    : undefined;
}

function executionPhaseMessage(
  phase: PermissionProfilePhase,
  profile: PermissionMode,
  t: Translator,
): string | undefined {
  const label = permissionLabel(profile, t);
  if (phase === 'applying') return t('settings.execution.applying', { profile: label });
  if (phase === 'persisting') return t('settings.execution.persisting', { profile: label });
  return undefined;
}

function isPermissionMode(value: unknown): value is PermissionMode {
  return value === 'read_only' || value === 'plan' || value === 'default'
    || value === 'accept_edits' || value === 'auto';
}

function permissionFailureMessage(result: {
  message: string;
  active: PermissionMode;
  persisted: PermissionMode;
  rolledBack: boolean;
  activeDefaultSplit: boolean;
}, t: Translator): string {
  if (result.activeDefaultSplit) {
    return t('settings.execution.splitFailure', {
      message: result.message,
      active: permissionLabel(result.active, t),
      persisted: permissionLabel(result.persisted, t),
    });
  }
  if (result.rolledBack) {
    return t('settings.execution.rollbackFailure', {
      message: result.message, active: permissionLabel(result.active, t),
    });
  }
  return t('settings.execution.sameFailure', {
    message: result.message, active: permissionLabel(result.active, t),
  });
}

function permissionLabel(mode: PermissionMode, t: Translator): string {
  return t(`settings.execution.${mode}.label`);
}

function reasoningLabel(effort: ReasoningEffort | undefined, t: Translator): string {
  return effort ? t(`settings.reasoning.${effort}`) : t('settings.reasoning.auto');
}
