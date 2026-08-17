import { logger, type SvtonAgentRuntime } from '@svton/agent-core';
import type { ChatEventHandler } from './chat-event-handler';
import type { DisplayMessage } from '../types';
import { captureRuntimeMessageIndex } from './chat-runtime-history.service';
import { appendSessionMessage, mapStreamingMessage, type MessageStoreHost } from './chat-message-store';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import type { ChatRunAddress } from './chat-run.types';
import {
  drivePreparedAssistantTurn,
  failPreparedAssistantTurn,
  prepareAssistantTurn,
  runAssistantTurn,
  type StreamRunnerDeps,
} from './chat-stream-runner';
import type { ChatPreparedInput } from './chat-prepared-input.types';

interface ChatSendBindings {
  host: MessageStoreHost;
  runtimes: ChatRuntimeRegistryService;
  ownership: ChatRunOwnershipService;
  runs: ChatRunCoordinatorService;
  handler: ChatEventHandler;
  createMessage: (role: 'user' | 'assistant' | 'system', content: string) => DisplayMessage;
  recordInput: (content: string) => void;
  notify: () => void;
  onBackgroundEnd: () => ((sessionId: string) => void) | null;
  persistRunDisplay: () => StreamRunnerDeps['persistRunDisplay'];
}

/** Serializes run startup per session while allowing different sessions in parallel. */
export class ChatSendCoordinatorService {
  private readonly starting = new Set<string | null>();
  private readonly creatingRuntime = new Set<string | null>();

  constructor(private readonly bindings: ChatSendBindings) {}

  isStarting(sessionId: string | null): boolean {
    return this.starting.has(sessionId);
  }

  isCreatingRuntime(sessionId: string | null): boolean {
    return this.creatingRuntime.has(sessionId);
  }

  cancel(sessionId: string | null): void {
    this.creatingRuntime.delete(sessionId);
    if (this.starting.delete(sessionId)) this.bindings.notify();
  }

  async send(
    owner: string | null,
    input: ChatPreparedInput,
  ): Promise<void> {
    if (this.starting.has(owner) || this.bindings.ownership.isProcessing(owner)) return;
    const address = this.bindings.runs.createAddress(owner);
    this.starting.add(owner);
    this.bindings.notify();
    logger.info('Chat', 'Sending message', { length: input.runtimeContent.length, hasImages: !!input.images?.length });
    this.bindings.recordInput(input.historyContent);
    const user = this.bindings.createMessage('user', input.publicContent);
    user.publicAttachments = input.publicAttachments;
    user.runId = address.runId;
    if (input.images?.length) user.images = input.images;
    const prepared = prepareAssistantTurn(
      this.runner(emptyRuntime()),
      address,
      () => appendSessionMessage(this.bindings.host, owner, user),
    );
    if (!prepared) {
      this.starting.delete(owner);
      this.bindings.notify();
      return;
    }
    try {
      this.creatingRuntime.add(owner);
      const runtime = await this.bindings.runtimes.ensureCurrent(owner);
      this.creatingRuntime.delete(owner);
      user.runtimeMessageIndex = captureRuntimeMessageIndex(runtime);
      mapStreamingMessage(this.bindings.host, (message) =>
        message.id === user.id ? { ...message, runtimeMessageIndex: user.runtimeMessageIndex } : message,
      owner);
      await drivePreparedAssistantTurn(this.runner(runtime), prepared, input.runtimeContent, input.images);
    } catch (error) {
      await failPreparedAssistantTurn(this.runner(emptyRuntime()), prepared, error);
    } finally {
      this.creatingRuntime.delete(owner);
      this.starting.delete(owner);
      this.bindings.notify();
    }
  }

  async run(
    address: ChatRunAddress,
    runtime: SvtonAgentRuntime,
    content: string,
    images?: Array<{ data: string; mimeType?: string }>,
  ): Promise<void> {
    await runAssistantTurn(this.runner(runtime), address, content, images);
  }

  private runner(runtime: StreamRunnerDeps['runtime']): StreamRunnerDeps {
    return {
      runtime,
      handler: this.bindings.handler,
      store: this.bindings.host,
      ownership: this.bindings.ownership,
      runs: this.bindings.runs,
      onBackgroundStreamEnd: this.bindings.onBackgroundEnd(),
      persistRunDisplay: this.bindings.persistRunDisplay(),
      createDisplayMessage: this.bindings.createMessage,
    };
  }
}

function emptyRuntime(): StreamRunnerDeps['runtime'] {
  return { async *run() {} };
}
