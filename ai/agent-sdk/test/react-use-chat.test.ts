// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentProvider, useAgent, useChat, useToolApproval } from '../src/react';
import type { UseChatReturn } from '../src/react/use-chat';
import type { UseToolApprovalReturn } from '../src/react/use-tool-approval';
import { setSharedChatMessages } from '../src/react/chat-message-store';
import type { Agent } from '../src/agent';
import type { CreateAgentConfig } from '../src/types';
import type { AgentEvent } from '@svton/agent-core';

interface ProbeState {
  agent: Agent;
  chat: UseChatReturn;
  toolApproval: UseToolApprovalReturn;
}

function config(): CreateAgentConfig {
  return {
    provider: { type: 'openai', apiKey: 'sk-test' },
    model: 'test-model',
  };
}

function Probe({ onState }: { onState: (state: ProbeState) => void }) {
  const { agent } = useAgent();
  const chat = useChat();
  const toolApproval = useToolApproval();
  useEffect(() => { onState({ agent, chat, toolApproval }); });
  return null;
}

async function renderProbe() {
  let state: ProbeState | null = null;
  const view = render(React.createElement(
    AgentProvider,
    { config: config() },
    React.createElement(Probe, { onState: (next) => { state = next; } }),
  ));

  await waitFor(() => expect(state).not.toBeNull());
  return {
    get state() {
      return state!;
    },
    unmount: view.unmount,
  };
}

function waitingApprovalChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'tc-sdk', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
    } as AgentEvent;
    yield {
      type: 'tool_approval_needed',
      call: { id: 'tc-sdk', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
    } as AgentEvent;
    await new Promise(() => {});
  }) as Agent['chat'];
}

function metadataWaitingApprovalChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'tc-sdk-meta', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
    } as AgentEvent;
    yield {
      type: 'tool_approval_needed',
      call: { id: 'tc-sdk-meta', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
      metadata: {
        autoReviewVerdict: {
          verdict: 'ask_user',
          reason: 'No matching rule',
          ruleId: undefined,
        },
      },
    } as AgentEvent;
    await new Promise(() => {});
  }) as Agent['chat'];
}

function approvedToolCompletesChat(onApproveReady: (approve: () => void) => void): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'tc-sdk', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
    } as AgentEvent;
    yield {
      type: 'tool_approval_needed',
      call: { id: 'tc-sdk', name: 'write_file', arguments: { path: '/tmp/out.txt' } },
    } as AgentEvent;
    await new Promise<void>((resolve) => { onApproveReady(resolve); });
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'tc-sdk',
        output: 'ok',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'text_delta', text: 'done' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function abortRejectingChat(onRejectReady: (reject: (err: Error) => void) => void): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'working' } as AgentEvent;
    await new Promise<void>((_, reject) => {
      onRejectReady((err) => { reject(err); });
    });
  }) as Agent['chat'];
}

function failingChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'working' } as AgentEvent;
    throw new Error('provider failed');
  }) as Agent['chat'];
}

function staleEventAfterAbortChat(onReleaseReady: (release: () => void) => void): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'old-start' } as AgentEvent;
    await new Promise<void>((resolve) => { onReleaseReady(resolve); });
    yield { type: 'text_delta', text: 'stale-old' } as AgentEvent;
  }) as Agent['chat'];
}

function hangingTextChat(text: string): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text } as AgentEvent;
    await new Promise(() => {});
  }) as Agent['chat'];
}

function lateEventAfterDoneChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'final' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
    yield { type: 'text_delta', text: 'late' } as AgentEvent;
  }) as Agent['chat'];
}

function thrownErrorAfterDoneChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'final' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
    throw new Error('late iterator failure');
  }) as Agent['chat'];
}

function doneAfterErrorEventChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'before-error' } as AgentEvent;
    yield { type: 'error', error: new Error('stream event failed') } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
    yield { type: 'text_delta', text: 'late' } as AgentEvent;
  }) as Agent['chat'];
}

function redactedThinkingChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'thinking_delta', thinking: '[REDACTED] encrypted reasoning' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function commandTextChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'Ready [Open diff](action:open_diff)' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function progressNameChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'tc-progress-name', name: 'test_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'tc-progress-name',
      name: 'test_tool',
      message: '',
      arguments: { key: 'value' },
    } as any;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function progressSubagentNameChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'subagent-progress-name', name: 'subagent_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'subagent-progress-name',
      name: 'subagent_spawn',
      message: '',
      arguments: { task: 'inspect auth flow' },
    } as any;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function progressSlowToolNameChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'web-progress-name', name: 'web_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'web-progress-name',
      name: 'web_search',
      message: '',
      arguments: { query: 'agent runtime' },
    } as any;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function progressSlowToolNameAfterTextChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'Intro' } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'web-progress-after-text', name: 'web_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'web-progress-after-text',
      name: 'web_search',
      message: '',
      arguments: { query: 'agent runtime' },
    } as any;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function repeatedProgressSlowToolNameChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'web-progress-first', name: 'web_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'web-progress-second', name: 'web_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'web-progress-first',
      name: 'web_search',
      message: '',
      arguments: { query: 'first' },
    } as any;
    yield {
      type: 'tool_call_progress',
      callId: 'web-progress-second',
      name: 'web_search',
      message: '',
      arguments: { query: 'second' },
    } as any;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function firstSlowToolCompletesChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'web-progress-first', name: 'web_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'web-progress-second', name: 'web_', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'web-progress-first',
      name: 'web_search',
      message: '',
      arguments: { query: 'first' },
    } as any;
    yield {
      type: 'tool_call_progress',
      callId: 'web-progress-second',
      name: 'web_search',
      message: '',
      arguments: { query: 'second' },
    } as any;
    yield {
      type: 'tool_call_end',
      result: { callId: 'web-progress-first', output: 'first done', isError: false },
    } as AgentEvent;
    await new Promise(() => {});
  }) as Agent['chat'];
}

function orphanSlowToolProgressChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'text_delta', text: 'Intro' } as AgentEvent;
    yield {
      type: 'tool_call_progress',
      callId: 'missing-call',
      name: 'web_search',
      message: '',
      arguments: { query: 'orphan' },
    } as any;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function warningAndSkillChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'skill_activated', skills: ['code-review', 'shell-safety'] } as AgentEvent;
    yield { type: 'warning', text: 'Network retries are degraded', source: 'provider' } as AgentEvent;
    yield { type: 'text_delta', text: 'continuing' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function subagentEventsChat(): Agent['chat'] {
  return (async function* () {
    yield { type: 'subagent_start', agentId: 'worker-1', task: 'scan repo' } as AgentEvent;
    yield { type: 'text_delta', text: 'main continues' } as AgentEvent;
    yield { type: 'subagent_end', agentId: 'worker-1', summary: 'found issue' } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function subagentToolChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: {
        id: 'subagent-tool-1',
        name: 'subagent_spawn',
        arguments: { task: 'inspect auth flow' },
      },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'subagent-tool-1',
        output: 'auth flow has stale token handling',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function subagentApprovalChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: {
        id: 'subagent-approval-1',
        name: 'subagent_spawn',
        arguments: { task: 'check permissions' },
      },
    } as AgentEvent;
    yield {
      type: 'tool_approval_needed',
      call: {
        id: 'subagent-approval-1',
        name: 'subagent_spawn',
        arguments: { task: 'check permissions' },
      },
    } as AgentEvent;
    await new Promise(() => {});
  }) as Agent['chat'];
}

function planningProgressChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'plan-call-1', name: 'plan_create', arguments: { title: 'Ship feature' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'plan-call-1',
        output: 'Plan created',
        isError: false,
        metadata: {
          planProgress: {
            planId: 'plan-1',
            title: 'Ship feature',
            steps: [
              { id: 'step-1', title: 'Audit', status: 'completed' },
              { id: 'step-2', title: 'Fix', status: 'pending' },
            ],
          },
        },
      },
    } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'plan-call-2', name: 'plan_update_step', arguments: { planId: 'plan-1' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'plan-call-2',
        output: 'Plan updated',
        isError: false,
        metadata: {
          planProgress: {
            planId: 'plan-1',
            title: 'Ship feature',
            steps: [
              { id: 'step-1', title: 'Audit', status: 'completed' },
              { id: 'step-2', title: 'Fix', status: 'completed' },
            ],
          },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function webSearchResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'web-search-1', name: 'web_search', arguments: { query: 'agent sdk testing' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'web-search-1',
        output: 'Search complete',
        isError: false,
        metadata: {
          query: 'agent sdk testing',
          searchResults: {
            title: 'Agent SDK testing guide',
            url: 'https://example.com/sdk',
            snippet: 'How to test agent SDK hooks.',
          },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function replayedWebSearchResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'web-search-replay', name: 'web_search', arguments: { query: 'agent sdk replay' } },
    } as AgentEvent;
    const endEvent = {
      type: 'tool_call_end',
      result: {
        callId: 'web-search-replay',
        output: 'Search complete',
        isError: false,
        metadata: {
          query: 'agent sdk replay',
          searchResults: {
            title: 'Agent SDK replay guide',
            url: 'https://example.com/sdk-replay',
            snippet: 'Replay-safe search blocks.',
          },
        },
      },
    } as AgentEvent;
    yield endEvent;
    yield endEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function overlappingWebSearchResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'web-search-overlap', name: 'web_search', arguments: { query: 'agent sdk overlap' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'file-read-overlap', name: 'file_read', arguments: { path: '/workspace/src/next.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'web-search-overlap',
        output: 'Search complete',
        isError: false,
        metadata: {
          query: 'agent sdk overlap',
          searchResults: {
            title: 'Agent SDK overlap guide',
            url: 'https://example.com/sdk-overlap',
            snippet: 'Overlap-safe search blocks.',
          },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function fileReadResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'file-read-1', name: 'file_read', arguments: { path: '/workspace/src/app.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'file-read-1',
        output: 'export const app = true;',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function readFileAliasResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'read-file-alias-1', name: 'read_file', arguments: { path: '/workspace/src/alias.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'read-file-alias-1',
        output: 'export const alias = true;',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function listFilesResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'list-files-1', name: 'list_files', arguments: { path: '/workspace/src' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'list-files-1',
        output: JSON.stringify([
          { name: 'app.ts', type: 'file' },
          {
            path: '/workspace/src/components',
            isDirectory: true,
            children: [
              { path: '/workspace/src/components/Button.tsx', type: 'file' },
              {
                name: 'forms',
                type: 'directory',
                children: [{ path: '/workspace/src/components/forms/Input.tsx', type: 'file' }],
              },
            ],
          },
        ]),
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function lsAliasResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'ls-alias-1', name: 'ls', arguments: { path: '/workspace/src' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'ls-alias-1',
        output: JSON.stringify([{ name: 'alias.ts', type: 'file' }]),
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function globResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'glob-1', name: 'glob', arguments: { pattern: '**/*.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'glob-1',
        output: 'src/app.ts\nsrc/components/Button.tsx',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function imageGenerateResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'image-generate-1', name: 'image_generate', arguments: { model: 'gpt-image-test' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'image-generate-1',
        output: JSON.stringify({
          images: { url: 'https://example.com/image.png', revised_prompt: 'A sharper prompt' },
        }),
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function imageGenerateMetadataResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'image-generate-metadata-1', name: 'image_generate', arguments: { model: 'gpt-image-test' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'image-generate-metadata-1',
        output: 'Generated 1 image(s) using model "gpt-image-test".',
        isError: false,
        metadata: {
          model: 'gpt-image-test',
          images: [{ url: 'https://example.com/metadata-image.png', revisedPrompt: 'Metadata prompt' }],
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function chromeScreenshotResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'chrome-screenshot-1', name: 'chrome_screenshot', arguments: { fullPage: true } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'chrome-screenshot-1',
        output: JSON.stringify({ type: 'image', data: 'chrome-screenshot-base64', mimeType: 'image/png' }),
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function previewDocumentImagesChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'preview-document-1', name: 'preview_document', arguments: { path: '/workspace/report.pdf' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'preview-document-1',
        output: JSON.stringify({ kind: 'images', count: 2, type: 'pdf' }),
        isError: false,
        metadata: {
          previewResult: { kind: 'images', images: 'page-one-base64' },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function gitDiffResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'git-diff-1', name: 'git_diff', arguments: {} },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'git-diff-1',
        output: [
          'diff --git a/src/app.ts b/src/app.ts',
          '--- a/src/app.ts',
          '+++ b/src/app.ts',
          'diff --git a/src/new.ts b/src/new.ts',
          '--- /dev/null',
          '+++ b/src/new.ts',
        ].join('\n'),
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function autoReviewVerdictChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'auto-review-1', name: 'write_file', arguments: { path: '/workspace/src/risky.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'auto-review-1',
        output: 'Blocked by reviewer',
        isError: false,
        metadata: {
          autoReviewVerdict: {
            verdict: 'deny',
            reason: 'Writes to protected path',
            ruleId: 'protected-path',
          },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function deniedAutoReviewVerdictChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'auto-review-deny-1', name: 'bash', arguments: { command: 'rm -rf /' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'auto-review-deny-1',
        output: 'Auto-reviewer denied: Dangerous',
        isError: true,
        metadata: {
          autoReviewVerdict: {
            verdict: 'deny',
            reason: 'Dangerous',
            ruleId: 'deny-dangerous-bash',
          },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function orphanAutoReviewVerdictChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'missing-auto-review',
        output: 'Auto-reviewer denied: Orphaned',
        isError: true,
        metadata: {
          autoReviewVerdict: {
            verdict: 'deny',
            reason: 'Orphaned',
            ruleId: 'orphan-auto-review',
          },
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function csvFanoutResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'csv-fanout-1', name: 'csv_fanout', arguments: { path: '/workspace/input.csv' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'csv-fanout-1',
        output: JSON.stringify({
          totalRows: '3',
          succeeded: '2',
          failed: '1',
          rows: [
            { rowIndex: 1, status: 'success', rowData: { email: 'a@example.com' }, summary: 'sent' },
            { rowIndex: 2, status: 'failed', rowData: { email: 'b@example.com' }, summary: 'bounced' },
          ],
        }),
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function csvFanoutMetadataResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'csv-fanout-metadata-1', name: 'csv_fanout', arguments: { path: '/workspace/input.csv' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'csv-fanout-metadata-1',
        output: 'CSV fan-out completed: 1 succeeded, 1 failed out of 2 rows.',
        isError: false,
        metadata: {
          totalRows: 2,
          successCount: 1,
          failCount: 1,
          results: [
            { summary: 'sent', success: true },
            { summary: 'bounced', success: false, error: 'invalid email' },
          ],
        },
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function fileWriteResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'file-write-1', name: 'write_file', arguments: { path: '/workspace/src/new.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'file-write-1',
        output: '+export const created = true;',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function overlappingFileWriteResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'file-write-overlap', name: 'write_file', arguments: { path: '/workspace/src/overlap.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'file-read-after-write', name: 'file_read', arguments: { path: '/workspace/src/next.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'file-write-overlap',
        output: '+export const overlap = true;',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

function multiFileWriteResultChat(): Agent['chat'] {
  return (async function* () {
    yield {
      type: 'tool_call_start',
      call: { id: 'file-write-a', name: 'write_file', arguments: { path: '/workspace/src/a.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'file-write-a',
        output: '+a',
        isError: false,
      },
    } as AgentEvent;
    yield {
      type: 'tool_call_start',
      call: { id: 'file-edit-b', name: 'edit_file', arguments: { path: '/workspace/src/b.ts' } },
    } as AgentEvent;
    yield {
      type: 'tool_call_end',
      result: {
        callId: 'file-edit-b',
        output: '~b',
        isError: false,
      },
    } as AgentEvent;
    yield { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as AgentEvent;
  }) as Agent['chat'];
}

describe('SDK useChat approval wait state', () => {
  it('keeps streaming controls active and blocks a second send while waiting for approval', async () => {
    const rendered = await renderProbe();
    const chat = vi.fn(waitingApprovalChat());
    rendered.state.agent.chat = chat;

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('waiting_approval'));
    expect(rendered.state.chat.isStreaming).toBe(true);
    expect(rendered.state.chat.messages).toHaveLength(2);

    act(() => {
      rendered.state.chat.send('must be ignored');
    });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(rendered.state.chat.messages).toHaveLength(2);
    rendered.unmount();
  });

  it('shares pending tool calls with useToolApproval', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(waitingApprovalChat());

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('waiting_approval'));
    expect(rendered.state.toolApproval.pendingCalls).toEqual([
      {
        id: 'tc-sdk',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        status: 'pending_approval',
      },
    ]);
    rendered.unmount();
  });

  it('preserves approval metadata on pending tool calls', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(metadataWaitingApprovalChat());

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('waiting_approval'));
    expect(rendered.state.toolApproval.pendingCalls).toEqual([
      {
        id: 'tc-sdk-meta',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        status: 'pending_approval',
        metadata: {
          autoReviewVerdict: {
            verdict: 'ask_user',
            reason: 'No matching rule',
            ruleId: undefined,
          },
        },
      },
    ]);
    rendered.unmount();
  });

  it('derives pending tool calls from block-only messages', async () => {
    const rendered = await renderProbe();

    act(() => {
      setSharedChatMessages(rendered.state.agent, [
        {
          id: 'msg-block-only',
          role: 'assistant',
          content: '',
          toolCalls: [],
          blocks: [
            {
              type: 'tool_call',
              call: {
                id: 'tc-block-only',
                name: 'write_file',
                arguments: { path: '/tmp/block.txt' },
                status: 'pending_approval',
              },
            },
          ],
          timestamp: Date.now(),
        },
      ]);
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toEqual([
      {
        id: 'tc-block-only',
        name: 'write_file',
        arguments: { path: '/tmp/block.txt' },
        status: 'pending_approval',
      },
    ]));
    rendered.unmount();
  });

  it('prefers block pending approval metadata over stale legacy tool calls across messages', async () => {
    const rendered = await renderProbe();

    act(() => {
      setSharedChatMessages(rendered.state.agent, [
        {
          id: 'msg-old-legacy',
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'tc-shared-pending',
              name: 'write_file',
              arguments: { path: '/tmp/legacy.txt' },
              status: 'pending_approval',
            },
          ],
          blocks: [],
          timestamp: Date.now(),
        },
        {
          id: 'msg-new-block',
          role: 'assistant',
          content: '',
          toolCalls: [],
          blocks: [
            {
              type: 'tool_call',
              call: {
                id: 'tc-shared-pending',
                name: 'write_file',
                arguments: { path: '/tmp/out.txt' },
                status: 'pending_approval',
                metadata: {
                  autoReviewVerdict: {
                    verdict: 'ask_user',
                    reason: 'No matching rule',
                  },
                },
              },
            },
          ],
          timestamp: Date.now(),
        },
      ]);
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toEqual([
      {
        id: 'tc-shared-pending',
        name: 'write_file',
        arguments: { path: '/tmp/out.txt' },
        status: 'pending_approval',
        metadata: {
          autoReviewVerdict: {
            verdict: 'ask_user',
            reason: 'No matching rule',
          },
        },
      },
    ]));
    rendered.unmount();
  });

  it('does not derive pending calls from stale legacy state when visible block is running', async () => {
    const rendered = await renderProbe();

    act(() => {
      setSharedChatMessages(rendered.state.agent, [
        {
          id: 'msg-stale-legacy',
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'tc-stale-legacy',
              name: 'write_file',
              arguments: { path: '/tmp/stale.txt' },
              status: 'pending_approval',
            },
          ],
          blocks: [
            {
              type: 'tool_call',
              call: {
                id: 'tc-stale-legacy',
                name: 'write_file',
                arguments: { path: '/tmp/stale.txt' },
                status: 'running',
              },
            },
          ],
          timestamp: Date.now(),
        },
      ]);
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(0));
    rendered.unmount();
  });

  it('treats visible-only pending approvals as active chat state', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn();

    act(() => {
      setSharedChatMessages(rendered.state.agent, [
        {
          id: 'msg-visible-pending',
          role: 'assistant',
          content: '',
          toolCalls: [],
          blocks: [
            {
              type: 'tool_call',
              call: {
                id: 'tc-visible-pending',
                name: 'write_file',
                arguments: { path: '/tmp/visible.txt' },
                status: 'pending_approval',
              },
            },
          ],
          timestamp: Date.now(),
        },
      ]);
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('waiting_approval'));
    expect(rendered.state.chat.isStreaming).toBe(true);

    act(() => {
      rendered.state.chat.send('must be ignored while approval is visible');
    });

    expect(rendered.state.agent.chat).not.toHaveBeenCalled();
    expect(rendered.state.chat.messages).toHaveLength(1);
    rendered.unmount();
  });

  it('aborts visible-only pending approvals when clearing chat state', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.abort = vi.fn();

    act(() => {
      setSharedChatMessages(rendered.state.agent, [
        {
          id: 'msg-visible-clear',
          role: 'assistant',
          content: '',
          toolCalls: [],
          blocks: [
            {
              type: 'tool_call',
              call: {
                id: 'tc-visible-clear',
                name: 'write_file',
                arguments: { path: '/tmp/clear.txt' },
                status: 'pending_approval',
              },
            },
          ],
          timestamp: Date.now(),
        },
      ]);
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rendered.state.chat.clear();
    });

    expect(rendered.state.agent.abort).toHaveBeenCalled();
    await waitFor(() => expect(rendered.state.chat.messages).toHaveLength(0));
    expect(rendered.state.chat.status).toBe('idle');
    expect(rendered.state.chat.isStreaming).toBe(false);
    rendered.unmount();
  });

  it('clears pending approval state immediately after approving', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(waitingApprovalChat());
    rendered.state.agent.approveToolCall = vi.fn();

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rendered.state.toolApproval.approve('tc-sdk');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(rendered.state.agent.approveToolCall).toHaveBeenCalledWith('tc-sdk');
    expect(rendered.state.chat.messages[1].toolCalls[0].status).toBe('running');
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-sdk', status: 'running' },
    });
    rendered.unmount();
  });

  it('updates tool call names from progress events', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(progressNameChat());

    act(() => {
      rendered.state.chat.send('use tool');
    });

    await waitFor(() =>
      expect(rendered.state.chat.messages[1].toolCalls[0]).toMatchObject({
        id: 'tc-progress-name',
        name: 'test_tool',
        arguments: { key: 'value' },
      }),
    );
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'tool_call',
      call: {
        id: 'tc-progress-name',
        name: 'test_tool',
        arguments: { key: 'value' },
      },
    });
    rendered.unmount();
  });

  it('reclassifies progress-updated subagent tool calls as subagent blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(progressSubagentNameChat());

    act(() => {
      rendered.state.chat.send('spawn subagent');
    });

    await waitFor(() =>
      expect(rendered.state.chat.messages[1].toolCalls[0]).toMatchObject({
        id: 'subagent-progress-name',
        name: 'subagent_spawn',
        arguments: { task: 'inspect auth flow' },
      }),
    );
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'subagent',
      agentId: 'subagent-progress-name',
      task: 'inspect auth flow',
      status: 'running',
    });
    rendered.unmount();
  });

  it('adds slow tool progress blocks from progress-updated tool names', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(progressSlowToolNameChat());

    act(() => {
      rendered.state.chat.send('search');
    });

    await waitFor(() =>
      expect(rendered.state.chat.messages[1].toolCalls[0]).toMatchObject({
        id: 'web-progress-name',
        name: 'web_search',
        arguments: { query: 'agent runtime' },
      }),
    );
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'progress',
      text: 'Searching the web',
      status: 'running',
    });
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'tool_call',
      call: {
        id: 'web-progress-name',
        name: 'web_search',
        arguments: { query: 'agent runtime' },
        status: 'running',
      },
    });
    rendered.unmount();
  });

  it('inserts progress-updated slow tool blocks before the matching tool call', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(progressSlowToolNameAfterTextChat());

    act(() => {
      rendered.state.chat.send('search after text');
    });

    await waitFor(() =>
      expect(rendered.state.chat.messages[1].toolCalls[0]).toMatchObject({
        id: 'web-progress-after-text',
        name: 'web_search',
      }),
    );
    expect(rendered.state.chat.messages[1].blocks[0]).toEqual({
      type: 'text',
      text: 'Intro',
    });
    expect(rendered.state.chat.messages[1].blocks[1]).toEqual({
      type: 'progress',
      text: 'Searching the web',
      status: 'running',
    });
    expect(rendered.state.chat.messages[1].blocks[2]).toMatchObject({
      type: 'tool_call',
      call: { id: 'web-progress-after-text', name: 'web_search' },
    });
    rendered.unmount();
  });

  it('keeps separate progress blocks for repeated progress-updated slow tools', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(repeatedProgressSlowToolNameChat());

    act(() => {
      rendered.state.chat.send('search twice');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    const blocks = rendered.state.chat.messages[1].blocks;
    const progressBlocks = blocks.filter((block) =>
      block.type === 'progress' && block.text === 'Searching the web'
    );
    expect(progressBlocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'progress' });
    expect(blocks[1]).toMatchObject({
      type: 'tool_call',
      call: { id: 'web-progress-first', arguments: { query: 'first' } },
    });
    expect(blocks[2]).toMatchObject({ type: 'progress' });
    expect(blocks[3]).toMatchObject({
      type: 'tool_call',
      call: { id: 'web-progress-second', arguments: { query: 'second' } },
    });
    rendered.unmount();
  });

  it('marks only the completed slow tool progress block done', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(firstSlowToolCompletesChat());

    act(() => {
      rendered.state.chat.send('search twice');
    });

    await waitFor(() =>
      expect(rendered.state.chat.messages[1].toolCalls[0]).toMatchObject({
        id: 'web-progress-first',
        status: 'completed',
      }),
    );
    const blocks = rendered.state.chat.messages[1].blocks;
    expect(blocks[0]).toEqual({
      type: 'progress',
      text: 'Searching the web',
      status: 'done',
    });
    expect(blocks[2]).toEqual({
      type: 'progress',
      text: 'Searching the web',
      status: 'running',
    });
    rendered.unmount();
  });

  it('does not create orphan progress blocks for unknown tool calls', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(orphanSlowToolProgressChat());

    act(() => {
      rendered.state.chat.send('orphan progress');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].toolCalls).toEqual([]);
    expect(rendered.state.chat.messages[1].blocks).toEqual([{ type: 'text', text: 'Intro' }]);
    rendered.unmount();
  });

  it('clears pending approval state immediately after rejecting', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(waitingApprovalChat());
    rendered.state.agent.rejectToolCall = vi.fn();

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rendered.state.toolApproval.reject('tc-sdk');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(rendered.state.agent.rejectToolCall).toHaveBeenCalledWith('tc-sdk');
    expect(rendered.state.chat.messages[1].toolCalls[0].status).toBe('error');
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-sdk', status: 'error' },
    });
    rendered.unmount();
  });

  it('clears pending approval state when aborting a waiting run', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(waitingApprovalChat());
    rendered.state.agent.abort = vi.fn();

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rendered.state.chat.abort();
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(rendered.state.agent.abort).toHaveBeenCalled();
    expect(rendered.state.chat.status).toBe('idle');
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].toolCalls[0].status).toBe('error');
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'tool_call',
      call: { id: 'tc-sdk', status: 'error' },
    });
    rendered.unmount();
  });

  it('aborts the waiting run when clearing pending approval state', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(waitingApprovalChat());
    rendered.state.agent.abort = vi.fn();

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rendered.state.chat.clear();
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(rendered.state.agent.abort).toHaveBeenCalled();
    expect(rendered.state.chat.status).toBe('idle');
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages).toHaveLength(0);
    rendered.unmount();
  });

  it('returns to idle after an approved tool call completes', async () => {
    const rendered = await renderProbe();
    let approveReady: (() => void) | null = null;
    rendered.state.agent.chat = vi.fn(approvedToolCompletesChat((approve) => { approveReady = approve; }));
    rendered.state.agent.approveToolCall = vi.fn(() => { approveReady?.(); });

    act(() => {
      rendered.state.chat.send('needs approval');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rendered.state.toolApproval.approve('tc-sdk');
    });

    await waitFor(() => expect(rendered.state.chat.messages[1].content).toBe('done'));
    expect(rendered.state.chat.status).toBe('idle');
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].toolCalls[0].status).toBe('completed');
    rendered.unmount();
  });

  it('ignores a late abort error after aborting locally', async () => {
    const rendered = await renderProbe();
    let rejectRun: ((err: Error) => void) | null = null;
    rendered.state.agent.chat = vi.fn(abortRejectingChat((reject) => { rejectRun = reject; }));
    rendered.state.agent.abort = vi.fn(() => { rejectRun?.(new Error('aborted')); });

    act(() => {
      rendered.state.chat.send('cancel me');
    });

    await waitFor(() => expect(rendered.state.chat.messages[1].content).toBe('working'));
    await act(async () => {
      rendered.state.chat.abort();
      await Promise.resolve();
    });

    expect(rendered.state.chat.status).toBe('idle');
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].error).toBeUndefined();
    rendered.unmount();
  });

  it('ignores a late abort error after clearing locally', async () => {
    const rendered = await renderProbe();
    let rejectRun: ((err: Error) => void) | null = null;
    rendered.state.agent.chat = vi.fn(abortRejectingChat((reject) => { rejectRun = reject; }));
    rendered.state.agent.abort = vi.fn(() => { rejectRun?.(new Error('aborted')); });

    act(() => {
      rendered.state.chat.send('clear me');
    });

    await waitFor(() => expect(rendered.state.chat.messages[1].content).toBe('working'));
    await act(async () => {
      rendered.state.chat.clear();
      await Promise.resolve();
    });

    expect(rendered.state.agent.abort).toHaveBeenCalled();
    expect(rendered.state.chat.status).toBe('idle');
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages).toHaveLength(0);
    rendered.unmount();
  });

  it('still surfaces real stream errors while a run is active', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(failingChat());

    act(() => {
      rendered.state.chat.send('fail');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('error'));
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].error).toBe('provider failed');
    rendered.unmount();
  });

  it('keeps explicit error events terminal when done arrives later', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(doneAfterErrorEventChat());

    act(() => {
      rendered.state.chat.send('event error');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('error'));
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].content).toBe('before-error');
    expect(rendered.state.chat.messages[1].error).toBe('stream event failed');
    expect(rendered.state.chat.messages[1].isStreaming).toBe(false);
    rendered.unmount();
  });

  it('surfaces redacted thinking deltas as redacted thinking blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(redactedThinkingChat());

    act(() => {
      rendered.state.chat.send('think privately');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].thinking).toBe('[REDACTED] encrypted reasoning');
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'redacted_thinking',
      reason: 'Provider returned encrypted thinking content',
    });
    expect(rendered.state.chat.messages[1].blocks.some((block) => (
      block.type === 'thinking' && block.text.includes('[REDACTED]')
    ))).toBe(false);
    rendered.unmount();
  });

  it('surfaces skill activation and warning events on the assistant message', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(warningAndSkillChat());

    act(() => {
      rendered.state.chat.send('use skills');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].activeSkills).toEqual(['code-review', 'shell-safety']);
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'warning',
      text: 'Network retries are degraded',
      source: 'provider',
    });
    expect(rendered.state.chat.messages[1].content).toBe('continuing');
    rendered.unmount();
  });

  it('extracts action markdown into command blocks on done', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(commandTextChat());

    act(() => {
      rendered.state.chat.send('show command');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({ type: 'text', text: 'Ready' });
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'command',
      label: 'Open diff',
      action: 'open_diff',
    });
    rendered.unmount();
  });

  it('surfaces subagent lifecycle events on the assistant message', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(subagentEventsChat());

    act(() => {
      rendered.state.chat.send('delegate');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toEqual([
      {
        type: 'subagent',
        agentId: 'worker-1',
        task: 'scan repo',
        status: 'completed',
        summary: 'found issue',
      },
      { type: 'text', text: 'main continues' },
    ]);
    rendered.unmount();
  });

  it('renders subagent spawn tool calls as subagent lifecycle blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(subagentToolChat());

    act(() => {
      rendered.state.chat.send('delegate through tool');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toEqual([
      {
        type: 'subagent',
        agentId: 'subagent-tool-1',
        task: 'inspect auth flow',
        status: 'completed',
        summary: 'auth flow has stale token handling',
      },
    ]);
    expect(rendered.state.chat.messages[1].toolCalls[0]).toMatchObject({
      id: 'subagent-tool-1',
      name: 'subagent_spawn',
      status: 'completed',
    });
    rendered.unmount();
  });

  it('syncs subagent spawn blocks with pending approval actions', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(subagentApprovalChat());
    rendered.state.agent.approveToolCall = vi.fn();

    act(() => {
      rendered.state.chat.send('approve subagent');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(1));
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'subagent',
      agentId: 'subagent-approval-1',
      status: 'pending',
    });

    act(() => {
      rendered.state.toolApproval.approve('subagent-approval-1');
    });

    await waitFor(() => expect(rendered.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(rendered.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'subagent',
      agentId: 'subagent-approval-1',
      status: 'running',
    });
    rendered.unmount();
  });

  it('marks pending subagent spawn blocks as error when rejected or aborted', async () => {
    const rejected = await renderProbe();
    rejected.state.agent.chat = vi.fn(subagentApprovalChat());
    rejected.state.agent.rejectToolCall = vi.fn();

    act(() => {
      rejected.state.chat.send('reject subagent');
    });

    await waitFor(() => expect(rejected.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      rejected.state.toolApproval.reject('subagent-approval-1');
    });

    await waitFor(() => expect(rejected.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(rejected.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'subagent',
      agentId: 'subagent-approval-1',
      status: 'error',
    });
    rejected.unmount();

    const aborted = await renderProbe();
    aborted.state.agent.chat = vi.fn(subagentApprovalChat());
    aborted.state.agent.abort = vi.fn();

    act(() => {
      aborted.state.chat.send('abort subagent');
    });

    await waitFor(() => expect(aborted.state.toolApproval.pendingCalls).toHaveLength(1));
    act(() => {
      aborted.state.chat.abort();
    });

    await waitFor(() => expect(aborted.state.toolApproval.pendingCalls).toHaveLength(0));
    expect(aborted.state.chat.messages[1].blocks[0]).toMatchObject({
      type: 'subagent',
      agentId: 'subagent-approval-1',
      status: 'error',
    });
    aborted.unmount();
  });

  it('surfaces planning progress metadata as active plan and a single updated plan block', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(planningProgressChat());

    act(() => {
      rendered.state.chat.send('make a plan');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.activePlan).toEqual({
      planId: 'plan-1',
      title: 'Ship feature',
      steps: [
        { id: 'step-1', title: 'Audit', status: 'completed' },
        { id: 'step-2', title: 'Fix', status: 'completed' },
      ],
    });
    const planBlocks = rendered.state.chat.messages[1].blocks.filter((block) => block.type === 'plan');
    expect(planBlocks).toHaveLength(1);
    expect(planBlocks[0]).toEqual({ type: 'plan', plan: rendered.state.chat.activePlan });
    rendered.unmount();
  });

  it('surfaces web search metadata as a web search block', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(webSearchResultChat());

    act(() => {
      rendered.state.chat.send('search');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'web_search',
      query: 'agent sdk testing',
      results: [
        { title: 'Agent SDK testing guide', url: 'https://example.com/sdk', snippet: 'How to test agent SDK hooks.' },
      ],
    });
    rendered.unmount();
  });

  it('does not duplicate web search blocks when a tool result is replayed', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(replayedWebSearchResultChat());

    act(() => {
      rendered.state.chat.send('search replay');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    const webSearchBlocks = rendered.state.chat.messages[1].blocks.filter((block) => block.type === 'web_search');
    expect(webSearchBlocks).toHaveLength(1);
    expect(webSearchBlocks[0]).toEqual({
      type: 'web_search',
      query: 'agent sdk replay',
      results: [
        { title: 'Agent SDK replay guide', url: 'https://example.com/sdk-replay', snippet: 'Replay-safe search blocks.' },
      ],
    });
    rendered.unmount();
  });

  it('keeps overlapping tool result blocks next to their owning tool call', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(overlappingWebSearchResultChat());

    act(() => {
      rendered.state.chat.send('search and read');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    const blockTypes = rendered.state.chat.messages[1].blocks.map((block) => block.type);
    expect(blockTypes).toEqual(['progress', 'tool_call', 'web_search', 'progress', 'tool_call']);
    expect(rendered.state.chat.messages[1].blocks[2]).toEqual({
      type: 'web_search',
      query: 'agent sdk overlap',
      results: [
        { title: 'Agent SDK overlap guide', url: 'https://example.com/sdk-overlap', snippet: 'Overlap-safe search blocks.' },
      ],
    });
    rendered.unmount();
  });

  it('surfaces file read results as reference blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(fileReadResultChat());

    act(() => {
      rendered.state.chat.send('read file');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'reference',
      refs: [{ path: '/workspace/src/app.ts' }],
    });
    rendered.unmount();
  });

  it('marks slow tool progress blocks done when the tool completes', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(fileReadResultChat());

    act(() => {
      rendered.state.chat.send('read file with progress');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'progress',
      text: 'Reading file',
      status: 'done',
    });
    rendered.unmount();
  });

  it('marks read_file alias progress blocks done when the tool completes', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(readFileAliasResultChat());

    act(() => {
      rendered.state.chat.send('read aliased file');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'progress',
      text: 'Reading file',
      status: 'done',
    });
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'reference',
      refs: [{ path: '/workspace/src/alias.ts' }],
    });
    rendered.unmount();
  });

  it('surfaces list tool results as file tree blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(listFilesResultChat());

    act(() => {
      rendered.state.chat.send('list files');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'file_tree',
      tree: [
        { name: 'app.ts', type: 'file', children: undefined },
        {
          name: 'components',
          type: 'dir',
          children: [
            { name: 'Button.tsx', type: 'file', children: undefined },
            {
              name: 'forms',
              type: 'dir',
              children: [{ name: 'Input.tsx', type: 'file', children: undefined }],
            },
          ],
        },
      ],
    });
    rendered.unmount();
  });

  it('surfaces glob newline file paths as file tree blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(globResultChat());

    act(() => {
      rendered.state.chat.send('glob files');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'file_tree',
      tree: [
        { name: 'app.ts', type: 'file', children: undefined },
        { name: 'Button.tsx', type: 'file', children: undefined },
      ],
    });
    rendered.unmount();
  });

  it('marks ls alias progress blocks done when the tool completes', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(lsAliasResultChat());

    act(() => {
      rendered.state.chat.send('list with alias');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'progress',
      text: 'Listing files',
      status: 'done',
    });
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'file_tree',
      tree: [{ name: 'alias.ts', type: 'file', children: undefined }],
    });
    rendered.unmount();
  });

  it('surfaces image generation results as image generated blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(imageGenerateResultChat());

    act(() => {
      rendered.state.chat.send('generate image');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'image_generated',
      images: [{ url: 'https://example.com/image.png', base64: undefined, revisedPrompt: 'A sharper prompt' }],
      model: 'gpt-image-test',
    });
    rendered.unmount();
  });

  it('surfaces image generation metadata images as image generated blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(imageGenerateMetadataResultChat());

    act(() => {
      rendered.state.chat.send('generate metadata image');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'image_generated',
      images: [{ url: 'https://example.com/metadata-image.png', base64: undefined, revisedPrompt: 'Metadata prompt' }],
      model: 'gpt-image-test',
    });
    rendered.unmount();
  });

  it('surfaces screenshot JSON image output as image generated blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(chromeScreenshotResultChat());

    act(() => {
      rendered.state.chat.send('capture screenshot');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'image_generated',
      images: [{ url: undefined, base64: 'chrome-screenshot-base64', mimeType: 'image/png', revisedPrompt: undefined }],
      model: 'chrome_screenshot',
    });
    rendered.unmount();
  });

  it('surfaces document preview image results as preview image blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(previewDocumentImagesChat());

    act(() => {
      rendered.state.chat.send('preview document');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'preview_images',
      images: ['page-one-base64'],
      title: '/workspace/report.pdf',
    });
    rendered.unmount();
  });

  it('surfaces git diff results as code review blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(gitDiffResultChat());

    act(() => {
      rendered.state.chat.send('review diff');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'code_review',
      findings: [
        { file: 'src/app.ts', severity: 'info', comment: '文件变更' },
        { file: 'src/new.ts', severity: 'info', comment: '文件变更' },
      ],
    });
    rendered.unmount();
  });

  it('surfaces auto review verdict metadata as auto review blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(autoReviewVerdictChat());

    act(() => {
      rendered.state.chat.send('write reviewed file');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'auto_review',
      toolName: 'write_file',
      verdict: 'deny',
      reason: 'Writes to protected path',
      ruleId: 'protected-path',
    });
    rendered.unmount();
  });

  it('surfaces denied auto review metadata even when the tool result is an error', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(deniedAutoReviewVerdictChat());

    act(() => {
      rendered.state.chat.send('run reviewed command');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'auto_review',
      toolName: 'bash',
      verdict: 'deny',
      reason: 'Dangerous',
      ruleId: 'deny-dangerous-bash',
    });
    rendered.unmount();
  });

  it('ignores auto review metadata when a tool result has no matching tool call', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(orphanAutoReviewVerdictChat());

    act(() => {
      rendered.state.chat.send('orphan result');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks.some((block) => block.type === 'auto_review')).toBe(false);
    rendered.unmount();
  });

  it('surfaces csv fanout results as csv fanout blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(csvFanoutResultChat());

    act(() => {
      rendered.state.chat.send('fan out csv');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'csv_fanout',
      totalRows: 3,
      succeeded: 2,
      failed: 1,
      rows: [
        { rowIndex: 1, status: 'success', rowData: { email: 'a@example.com' }, summary: 'sent' },
        { rowIndex: 2, status: 'failed', rowData: { email: 'b@example.com' }, summary: 'bounced' },
      ],
    });
    rendered.unmount();
  });

  it('surfaces csv fanout metadata results as csv fanout blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(csvFanoutMetadataResultChat());

    act(() => {
      rendered.state.chat.send('fan out csv metadata');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'csv_fanout',
      totalRows: 2,
      succeeded: 1,
      failed: 1,
      rows: [
        { rowIndex: 1, status: 'success', rowData: {}, summary: 'sent' },
        { rowIndex: 2, status: 'failed', rowData: {}, summary: 'bounced' },
      ],
    });
    rendered.unmount();
  });

  it('surfaces write tool results as file change blocks', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(fileWriteResultChat());

    act(() => {
      rendered.state.chat.send('write file');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.messages[1].blocks).toContainEqual({
      type: 'file_change',
      changes: [{
        path: '/workspace/src/new.ts',
        changeType: 'create',
        diff: '+export const created = true;',
      }],
    });
    rendered.unmount();
  });

  it('keeps overlapping file change blocks next to their owning write tool call', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(overlappingFileWriteResultChat());

    act(() => {
      rendered.state.chat.send('write and read');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    const blocks = rendered.state.chat.messages[1].blocks;
    expect(blocks.map((block) => block.type)).toEqual(['tool_call', 'file_change', 'progress', 'tool_call']);
    expect(blocks[1]).toEqual({
      type: 'file_change',
      changes: [{
        path: '/workspace/src/overlap.ts',
        changeType: 'create',
        diff: '+export const overlap = true;',
      }],
    });
    rendered.unmount();
  });

  it('aggregates multiple file change blocks into a turn diff on done', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(multiFileWriteResultChat());

    act(() => {
      rendered.state.chat.send('modify files');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    const blocks = rendered.state.chat.messages[1].blocks;
    expect(blocks.filter((block) => block.type === 'file_change')).toHaveLength(0);
    expect(blocks).toContainEqual({
      type: 'turn_diff',
      changes: [
        { path: '/workspace/src/a.ts', changeType: 'create', diff: '+a' },
        { path: '/workspace/src/b.ts', changeType: 'modify', diff: '~b' },
      ],
    });
    rendered.unmount();
  });

  it('ignores late stream events after final done', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(lateEventAfterDoneChat());

    act(() => {
      rendered.state.chat.send('finish');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].content).toBe('final');
    expect(rendered.state.chat.messages[1].isStreaming).toBe(false);
    rendered.unmount();
  });

  it('ignores thrown iterator errors after final done', async () => {
    const rendered = await renderProbe();
    rendered.state.agent.chat = vi.fn(thrownErrorAfterDoneChat());

    act(() => {
      rendered.state.chat.send('finish with late throw');
    });

    await waitFor(() => expect(rendered.state.chat.status).toBe('idle'));
    expect(rendered.state.chat.isStreaming).toBe(false);
    expect(rendered.state.chat.messages[1].content).toBe('final');
    expect(rendered.state.chat.messages[1].error).toBeUndefined();
    expect(rendered.state.chat.messages[1].isStreaming).toBe(false);
    rendered.unmount();
  });

  it('ignores stale events from an aborted run after a newer run starts', async () => {
    const rendered = await renderProbe();
    let releaseOldRun: (() => void) | null = null;
    rendered.state.agent.chat = vi.fn(staleEventAfterAbortChat((release) => { releaseOldRun = release; }));
    rendered.state.agent.abort = vi.fn();

    act(() => {
      rendered.state.chat.send('old');
    });

    await waitFor(() => expect(rendered.state.chat.messages[1].content).toBe('old-start'));
    act(() => {
      rendered.state.chat.abort();
    });

    rendered.state.agent.chat = vi.fn(hangingTextChat('new-start'));
    act(() => {
      rendered.state.chat.send('new');
    });

    await waitFor(() => expect(rendered.state.chat.messages[3].content).toBe('new-start'));
    await act(async () => {
      releaseOldRun?.();
      await Promise.resolve();
    });

    expect(rendered.state.chat.status).toBe('running');
    expect(rendered.state.chat.messages[1].content).toBe('old-start');
    expect(rendered.state.chat.messages[3].content).toBe('new-start');
    rendered.unmount();
  });
});
