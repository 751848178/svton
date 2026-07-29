import type { IPlatform } from '@svton/agent-platform';
import type { DesktopE2eNativeEvidence } from './desktop-e2e-native.service';
import {
  extractDesktopE2eMessageText,
  type DesktopE2eMessage,
} from './desktop-e2e-messages.utils';
import {
  DESKTOP_E2E_MARKER,
  DESKTOP_E2E_USER_MESSAGE,
} from './e2e-provider';

export const DESKTOP_E2E_RESULT_PATH =
  '/tmp/svton-desktop-e2e-result.json';

export interface DesktopE2eBaseline {
  messageCount: number;
  userMessageCount: number;
  markerCount: number;
}

export interface DesktopE2eResultEvidence {
  state: 'running' | 'passed' | 'failed';
  ok: boolean;
  finalStatus: string;
  userMessage: string;
  assistantMarker: string;
  baselineMessageCount: number;
  baselineUserMessageCount: number;
  baselineMarkerCount: number;
  hasUserMessage: boolean;
  hasAssistantMarker: boolean;
  assistantText: string;
  messageCount: number;
  userMessageCount: number;
  markerCount: number;
  newMessageCount: number;
  newUserMessageCount: number;
  newMarkerCount: number;
  lastUserMessageIndex: number;
  lastAssistantMarkerIndex: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
  native?: DesktopE2eNativeEvidence;
}

export function buildDesktopE2eResult(
  state: DesktopE2eResultEvidence['state'],
  messages: readonly DesktopE2eMessage[],
  finalStatus: string,
  startedAt: number,
  error?: string,
  baseline = captureDesktopE2eBaseline([]),
  native?: DesktopE2eNativeEvidence,
): DesktopE2eResultEvidence {
  const current = captureDesktopE2eBaseline(messages);
  const lastUserMessageIndex = findLastIndex(messages, isTargetUser);
  const lastAssistantMarkerIndex = findLastIndex(messages, isMarkerAssistant);
  const now = Date.now();
  return {
    state,
    ok: state === 'passed',
    finalStatus,
    userMessage: DESKTOP_E2E_USER_MESSAGE,
    assistantMarker: DESKTOP_E2E_MARKER,
    baselineMessageCount: baseline.messageCount,
    baselineUserMessageCount: baseline.userMessageCount,
    baselineMarkerCount: baseline.markerCount,
    hasUserMessage: lastUserMessageIndex >= baseline.messageCount,
    hasAssistantMarker: lastAssistantMarkerIndex >= baseline.messageCount,
    assistantText: lastAssistantMarkerIndex >= 0
      ? extractDesktopE2eMessageText(messages[lastAssistantMarkerIndex])
      : '',
    messageCount: current.messageCount,
    userMessageCount: current.userMessageCount,
    markerCount: current.markerCount,
    newMessageCount: current.messageCount - baseline.messageCount,
    newUserMessageCount: current.userMessageCount - baseline.userMessageCount,
    newMarkerCount: current.markerCount - baseline.markerCount,
    lastUserMessageIndex,
    lastAssistantMarkerIndex,
    startedAt,
    updatedAt: now,
    ...(state === 'running' ? {} : { completedAt: now }),
    ...(error ? { error } : {}),
    ...(native ? { native } : {}),
  };
}

export function captureDesktopE2eBaseline(
  messages: readonly DesktopE2eMessage[],
): DesktopE2eBaseline {
  return {
    messageCount: messages.length,
    userMessageCount: messages.filter(isTargetUser).length,
    markerCount: messages.filter(isMarkerAssistant).length,
  };
}

export async function persistDesktopE2eResult(
  platform: IPlatform,
  evidence: DesktopE2eResultEvidence,
): Promise<void> {
  if (typeof window !== 'undefined') {
    Object.assign(window, { __svtonDesktopE2e__: evidence });
  }
  await platform.fs.writeFile(
    DESKTOP_E2E_RESULT_PATH,
    JSON.stringify(evidence),
  );
}

function findLastIndex(
  messages: readonly DesktopE2eMessage[],
  predicate: (message: DesktopE2eMessage) => boolean,
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (predicate(messages[index])) return index;
  }
  return -1;
}

function isTargetUser(message: DesktopE2eMessage): boolean {
  return message.role === 'user'
    && extractDesktopE2eMessageText(message) === DESKTOP_E2E_USER_MESSAGE;
}

function isMarkerAssistant(message: DesktopE2eMessage): boolean {
  return message.role === 'assistant'
    && extractDesktopE2eMessageText(message).includes(DESKTOP_E2E_MARKER);
}
