import type { StreamEvent } from './types';

export interface OpenAIStreamToolCallBuffer {
  id: string;
  name: string;
  args: string;
  pendingArgumentDeltas: string[];
  started: boolean;
}

interface OpenAIStreamToolCallDelta {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export function* collectOpenAIStreamToolCallEvents(
  buffers: Map<number, OpenAIStreamToolCallBuffer>,
  toolCall: OpenAIStreamToolCallDelta,
  fallbackIndex = 0,
): Generator<StreamEvent> {
  const index = resolveToolCallBufferIndex(buffers, toolCall, fallbackIndex);
  const buffer = getOrCreateToolCallBuffer(buffers, index, toolCall.id);
  if (toolCall.id) buffer.id = toolCall.id;

  const name = toolCall.function?.name;
  if (name) {
    buffer.name = name;
    yield* startToolCallBuffer(buffer);
  }

  const argumentsDelta = toolCall.function?.arguments;
  if (argumentsDelta) {
    buffer.args += argumentsDelta;
    if (buffer.started) {
      yield { type: 'tool_call_delta', id: buffer.id, argumentsDelta };
    } else {
      buffer.pendingArgumentDeltas.push(argumentsDelta);
    }
  }
}

export function* flushOpenAIStreamToolCallBuffers(
  buffers: Map<number, OpenAIStreamToolCallBuffer>,
): Generator<StreamEvent> {
  for (const [, buffer] of buffers) {
    yield* startToolCallBuffer(buffer);
    if (!buffer.started) continue;
    yield {
      type: 'tool_call_end',
      id: buffer.id,
      name: buffer.name,
      arguments: buffer.args,
    };
  }
  buffers.clear();
}

function resolveToolCallBufferIndex(
  buffers: Map<number, OpenAIStreamToolCallBuffer>,
  toolCall: OpenAIStreamToolCallDelta,
  fallbackIndex: number,
): number {
  if (toolCall.index !== undefined) return toolCall.index;
  if (!toolCall.id) return fallbackIndex;

  for (const [index, buffer] of buffers) {
    if (buffer.id === toolCall.id) return index;
  }
  return fallbackIndex;
}

function getOrCreateToolCallBuffer(
  buffers: Map<number, OpenAIStreamToolCallBuffer>,
  index: number,
  id?: string,
): OpenAIStreamToolCallBuffer {
  const existing = buffers.get(index);
  if (existing) return existing;

  const buffer = {
    id: id ?? '',
    name: '',
    args: '',
    pendingArgumentDeltas: [],
    started: false,
  };
  buffers.set(index, buffer);
  return buffer;
}

function* startToolCallBuffer(
  buffer: OpenAIStreamToolCallBuffer,
): Generator<StreamEvent> {
  if (buffer.started || !buffer.name) return;

  buffer.started = true;
  yield { type: 'tool_call_start', id: buffer.id, name: buffer.name };
  for (const argumentsDelta of buffer.pendingArgumentDeltas) {
    yield { type: 'tool_call_delta', id: buffer.id, argumentsDelta };
  }
  buffer.pendingArgumentDeltas = [];
}
