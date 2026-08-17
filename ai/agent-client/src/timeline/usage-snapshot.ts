import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { DisplayMessage } from '../types';
import type { TimelineTurn } from './types';
import type {
  TimelineUsageContribution,
  TimelineUsageSnapshot,
  TimelineUsageState,
} from './usage.types';
import { createUsageResponseKey } from './usage-response-key';

export const MAX_USAGE_RESPONSE_KEYS = 128;
const RESPONSE_KEY_PATTERN = /^usage:[0-9a-z]+:[0-9a-z]+$/;
const TOKEN_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const;
const COST_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite', 'total'] as const;

export function contributionFromAssistant(
  message: AssistantMessage,
): TimelineUsageContribution | undefined {
  return contribution(message.usage, message.responseId, message.timestamp, {
    api: message.api, provider: message.provider, model: message.model, content: message.content,
  });
}

export function contributionFromDisplay(
  message: DisplayMessage,
): TimelineUsageContribution | undefined {
  const metadata = message.metadata;
  return contribution(metadata?.usage, metadata?.responseId, message.timestamp, {
    api: metadata?.api, provider: metadata?.provider, model: metadata?.model,
    content: message.content, thinking: message.thinking, toolCalls: message.toolCalls,
  });
}

export function applyUsageContributions(
  state: TimelineTurn,
  values: TimelineUsageContribution[],
  fallbackOnly = false,
): TimelineTurn {
  if (fallbackOnly && state.usage) return state;
  let usage = state.usage;
  const keys = [...(state.usageResponseKeys ?? [])];
  let changed = false;
  for (const value of values) {
    const parsed = parseUsageSnapshot(value.usage);
    if (!parsed || !RESPONSE_KEY_PATTERN.test(value.responseKey)) continue;
    if (keys.includes(value.responseKey)) continue;
    const next = usage ? addUsage(usage, parsed) : parsed;
    if (!next) continue;
    usage = next;
    keys.push(value.responseKey);
    if (keys.length > MAX_USAGE_RESPONSE_KEYS) keys.shift();
    changed = true;
  }
  return changed ? {
    ...state, usage, usageResponseKeys: keys, revision: state.revision + 1,
  } : state;
}

export function parseTimelineUsageState(
  value: Record<string, unknown>,
): TimelineUsageState | null {
  if (value.usage === undefined && value.usageResponseKeys === undefined) return {};
  const usage = parseUsageSnapshot(value.usage);
  const keys = value.usageResponseKeys;
  if (!usage || !Array.isArray(keys) || keys.length === 0 || keys.length > MAX_USAGE_RESPONSE_KEYS) {
    return null;
  }
  if (!keys.every((key) => typeof key === 'string' && RESPONSE_KEY_PATTERN.test(key))) return null;
  if (new Set(keys).size !== keys.length) return null;
  return { usage, usageResponseKeys: [...keys] as string[] };
}

export function parseUsageSnapshot(value: unknown): TimelineUsageSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.cost)) return undefined;
  const cost = value.cost;
  if (!TOKEN_FIELDS.every((field) => isToken(value[field]))) return undefined;
  if (!COST_FIELDS.every((field) => isCost(cost[field]))) return undefined;
  if (!isOptionalToken(value.cacheWrite1h) || !isOptionalToken(value.reasoning)) return undefined;
  return {
    input: value.input as number, output: value.output as number,
    cacheRead: value.cacheRead as number, cacheWrite: value.cacheWrite as number,
    ...(typeof value.cacheWrite1h === 'number' ? { cacheWrite1h: value.cacheWrite1h } : {}),
    ...(typeof value.reasoning === 'number' ? { reasoning: value.reasoning } : {}),
    totalTokens: value.totalTokens as number,
    cost: {
      input: cost.input as number, output: cost.output as number,
      cacheRead: cost.cacheRead as number, cacheWrite: cost.cacheWrite as number,
      total: cost.total as number,
    },
  };
}

export function mergeUsageStates(states: TimelineUsageState[]): TimelineUsageState | undefined {
  let usage: TimelineUsageSnapshot | undefined;
  const keys: string[] = [];
  for (const state of states) {
    if (!state.usage || !state.usageResponseKeys?.length) continue;
    if (state.usageResponseKeys.some((key) => keys.includes(key))) continue;
    const next = usage ? addUsage(usage, state.usage) : state.usage;
    if (!next) continue;
    usage = next;
    keys.push(...state.usageResponseKeys);
    if (keys.length > MAX_USAGE_RESPONSE_KEYS) {
      keys.splice(0, keys.length - MAX_USAGE_RESPONSE_KEYS);
    }
  }
  return usage ? { usage, usageResponseKeys: keys } : undefined;
}

function contribution(
  usageValue: unknown,
  responseId: unknown,
  timestamp: number,
  fallbackSource: unknown,
): TimelineUsageContribution | undefined {
  const usage = parseUsageSnapshot(usageValue);
  if (!usage) return undefined;
  return { responseKey: createUsageResponseKey(responseId, timestamp, fallbackSource), usage };
}

function addUsage(a: TimelineUsageSnapshot, b: TimelineUsageSnapshot): TimelineUsageSnapshot | undefined {
  const input = addToken(a.input, b.input);
  const output = addToken(a.output, b.output);
  const cacheRead = addToken(a.cacheRead, b.cacheRead);
  const cacheWrite = addToken(a.cacheWrite, b.cacheWrite);
  const totalTokens = addToken(a.totalTokens, b.totalTokens);
  const costInput = addCost(a.cost.input, b.cost.input);
  const costOutput = addCost(a.cost.output, b.cost.output);
  const costCacheRead = addCost(a.cost.cacheRead, b.cost.cacheRead);
  const costCacheWrite = addCost(a.cost.cacheWrite, b.cost.cacheWrite);
  const costTotal = addCost(a.cost.total, b.cost.total);
  if ([input, output, cacheRead, cacheWrite, totalTokens, costInput, costOutput,
    costCacheRead, costCacheWrite, costTotal].some((value) => value === undefined)) return undefined;
  const cacheWrite1h = addOptionalToken(a.cacheWrite1h, b.cacheWrite1h);
  const reasoning = addOptionalToken(a.reasoning, b.reasoning);
  if (cacheWrite1h === null || reasoning === null) return undefined;
  return {
    input: input!, output: output!, cacheRead: cacheRead!, cacheWrite: cacheWrite!,
    totalTokens: totalTokens!,
    ...(cacheWrite1h === undefined ? {} : { cacheWrite1h }),
    ...(reasoning === undefined ? {} : { reasoning }),
    cost: {
      input: costInput!, output: costOutput!, cacheRead: costCacheRead!,
      cacheWrite: costCacheWrite!, total: costTotal!,
    },
  };
}

function addOptionalToken(a?: number, b?: number): number | null | undefined {
  if (a === undefined && b === undefined) return undefined;
  return addToken(a ?? 0, b ?? 0) ?? null;
}

function addToken(a: number, b: number): number | undefined {
  const value = a + b;
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function addCost(a: number, b: number): number | undefined {
  const value = a + b;
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isToken(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isOptionalToken(value: unknown): boolean {
  return value === undefined || isToken(value);
}

function isCost(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
