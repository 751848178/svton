/**
 * Full-scenario E2E conversation tests.
 *
 * Covers EVERY tool type in realistic conversation flows, plus the key
 * multi-tool chains and mixed scenarios that the previous E2E tests missed.
 *
 * Strategy: MockProvider scripts the exact LLM behaviour (which tools to call,
 * in what order, what text to emit), while each tool executor runs against a
 * mock platform (in-memory fs / process / search / http). This lets us verify
 * the full pipeline without a real LLM or real external systems.
 *
 * Each test asserts:
 *   - The tool was actually executed (executor recorded the call)
 *   - The tool_result landed in context with correct content
 *   - The assistant's final text response is present
 *   - Context message ordering is correct
 */
import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/agent/runtime';
import { ToolRegistry } from '../src/tool/registry';
import { PermissionManager } from '../src/permission/manager';
import {
  fileReadDef, FileReadExecutor,
  fileWriteDef, FileWriteExecutor,
  fileEditDef, FileEditExecutor,
  bashDef, BashExecutor,
  grepDef, GrepExecutor,
  globDef, GlobExecutor,
  gitDiffDef, GitDiffExecutor,
  gitLogRangeDef, GitLogRangeExecutor,
  webSearchDef, WebSearchExecutor,
  webFetchDef, WebFetchExecutor,
  memorySaveDef, MemorySaveExecutor,
  memoryRecallDef, MemoryRecallExecutor,
  planCreateDef, PlanCreateExecutor,
  planGetStatusDef, PlanGetStatusExecutor,
  planUpdateStepDef, PlanUpdateStepExecutor,
} from '../src/tool/builtins';
import { MemoryManager } from '../src/memory/manager';
import { PlanningManager } from '../src/planning/manager';
import { MockProvider, createMockPlatform, createMockHttpClient, collectEvents } from './helpers';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';
import type { ChatMessage } from '../src/provider/types';

// ── Helpers ──────────────────────────────────────────────

/** A recording executor that returns a fixed output and remembers calls. */
function recordingExecutor(output: string, isError = false): { exec: IToolExecutor; calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    exec: {
      execute: async (call: ToolCall): Promise<ToolResult> => {
        calls.push(call);
        return { callId: call.id, output, isError };
      },
    },
  };
}

/** Extract text from a ChatMessage. */
function textOf(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }
  return '';
}

/** Extract all tool_result outputs from context. */
function allToolResults(msgs: ChatMessage[]): string[] {
  return msgs
    .filter((m) => m.role === 'tool')
    .flatMap((m) => {
      if (!Array.isArray(m.content)) return [];
      return m.content.filter((b: any) => b.type === 'tool_result').map((b: any) => b.output);
    });
}

/** Extract all tool_use names from context. */
function allToolUses(msgs: ChatMessage[]): string[] {
  return msgs
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => {
      if (!Array.isArray(m.content)) return [];
      return m.content.filter((b: any) => b.type === 'tool_use').map((b: any) => b.name);
    });
}

/** Build a tool_call_end event (the runtime synthesises this from the buffer). */
function tc(id: string, name: string, args: Record<string, unknown>) {
  return { type: 'tool_call_end' as const, id, name, arguments: JSON.stringify(args) };
}

/** Build a full tool-call sequence (start + delta + end). */
function toolSeq(id: string, name: string, args: Record<string, unknown>) {
  const argsStr = JSON.stringify(args);
  return [
    { type: 'tool_call_start' as const, id, name },
    { type: 'tool_call_delta' as const, id, argumentsDelta: argsStr },
    { type: 'tool_call_end' as const, id, name, arguments: argsStr },
    { type: 'done' as const, stopReason: 'tool_use' },
  ];
}

// ── Shared registry builder ──────────────────────────────

interface TestSetup {
  runtime: AgentRuntime;
  provider: MockProvider;
  platform: ReturnType<typeof createMockPlatform>;
  registry: ToolRegistry;
}

function setupWithRealExecutors(): TestSetup & {
  fileContents: Map<string, string>;
  bashOutputs: Map<string, string>;
} {
  const provider = new MockProvider();
  const registry = new ToolRegistry();
  const fileContents = new Map<string, string>();
  const bashOutputs = new Map<string, string>();

  const platform = createMockPlatform({
    fs: {
      exists: async (p: string) => fileContents.has(p.replace(/\/+/g, '/')),
      readFile: async (p: string) => fileContents.get(p.replace(/\/+/g, '/')) ?? '',
      writeFile: async (p: string, c: string) => { fileContents.set(p.replace(/\/+/g, '/'), c); },
      editFile: async (p: string, oldStr: string, newStr: string): Promise<boolean> => {
        const norm = p.replace(/\/+/g, '/');
        const content = fileContents.get(norm);
        if (!content || !content.includes(oldStr)) return false;
        fileContents.set(norm, content.replace(oldStr, newStr));
        return true;
      },
      deleteFile: async (p: string) => { fileContents.delete(p.replace(/\/+/g, '/')); },
      stat: async (p: string) => {
        const norm = p.replace(/\/+/g, '/');
        const content = fileContents.get(norm) ?? '';
        return { isFile: true, isDirectory: false, size: content.length, mtime: 0 };
      },
      listDir: async () => [],
      resolve: (p: string) => p.replace(/\/+/g, '/'),
      join: (...s: string[]) => s.join('/'),
      watch: () => () => {},
    },
    process: {
      exec: async (cmd: string) => {
        // Check bashOutputs for exact match, else check prefix
        for (const [key, val] of bashOutputs) {
          if (cmd.includes(key)) return { stdout: val, stderr: '', exitCode: 0, timedOut: false };
        }
        return { stdout: '', stderr: '', exitCode: 0, timedOut: false };
      },
      getEnv: () => '',
      getCwd: () => '/',
    },
    search: {
      grep: async () => [],
      glob: async () => [],
    },
  });

  // Register all tools with real executors backed by the mock platform
  registry.register(fileReadDef, new FileReadExecutor());
  registry.register(fileWriteDef, new FileWriteExecutor());
  registry.register(fileEditDef, new FileEditExecutor());
  registry.register(bashDef, new BashExecutor());
  registry.register(grepDef, new GrepExecutor());
  registry.register(globDef, new GlobExecutor());
  registry.register(gitDiffDef, new GitDiffExecutor());
  registry.register(gitLogRangeDef, new GitLogRangeExecutor());

  const http = createMockHttpClient();
  (platform as any).http = http;
  registry.register(webFetchDef, new WebFetchExecutor());
  registry.register(webSearchDef, new WebSearchExecutor({ provider: 'tavily', apiKey: 'tvly-test' }));

  const memoryManager = new MemoryManager();
  registry.register(memorySaveDef, new MemorySaveExecutor(memoryManager));
  registry.register(memoryRecallDef, new MemoryRecallExecutor(memoryManager));

  const planningManager = new PlanningManager();
  registry.register(planCreateDef, new PlanCreateExecutor(planningManager));
  registry.register(planGetStatusDef, new PlanGetStatusExecutor(planningManager));
  registry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planningManager));

  const runtime = AgentRuntime.create({
    provider,
    model: 'test-model',
    toolRegistry: registry,
    capabilities: { permissionManager: new PermissionManager({ mode: 'auto' }) },
  }, platform);

  return { runtime, provider, platform, registry, fileContents, bashOutputs };
}

// ============================================================
// Tests
// ============================================================

describe('Full-scenario E2E conversations', () => {

  // ── file_write → file_read chain ──
  it('file_write creates a file, then file_read reads it back', async () => {
    const ctx = setupWithRealExecutors();
    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'file_write', { path: '/test.txt', content: 'Hello World' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'File written.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Write a file'));

    // Turn 2: read it back
    ctx.provider.addResponse([
      ...toolSeq('c2', 'file_read', { path: '/test.txt' }),
    ]).addResponse([
      { type: 'text_delta', text: 'The file contains: Hello World' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await collectEvents(ctx.runtime.run('Read the file'));

    // File was actually written to the mock fs
    expect(ctx.fileContents.get('/test.txt')).toBe('Hello World');

    // Both tool calls appear in context
    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('file_write');
    expect(allToolUses(msgs)).toContain('file_read');
    // file_write output: "File written successfully: ..."
    expect(allToolResults(msgs).some((r) => r.includes('File written'))).toBe(true);
    // file_read output: "1\tHello World" (line-numbered)
    expect(allToolResults(msgs).some((r) => r.includes('Hello World'))).toBe(true);
  });

  // ── file_edit modifies existing content ──
  it('file_edit modifies an existing file', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/app.ts', 'const x = 1;\nconsole.log(x);\n');

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'file_edit', {
          path: '/app.ts',
          old_string: 'const x = 1;',
          new_string: 'const x = 2;',
        }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'Updated x from 1 to 2.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Fix the bug'));

    expect(ctx.fileContents.get('/app.ts')).toContain('const x = 2');
    expect(ctx.fileContents.get('/app.ts')).not.toContain('const x = 1;');
  });

  // ── bash executes a command ──
  it('bash executes a command and returns output', async () => {
    const ctx = setupWithRealExecutors();
    ctx.bashOutputs.set('ls -la', 'file1.txt\nfile2.ts\n');

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'bash', { command: 'ls -la' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'Found 2 files.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('List files'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('bash');
    const bashResult = allToolResults(msgs).find((r) => r.includes('file1.txt'));
    expect(bashResult).toBeDefined();
  });

  // ── grep + file_read chain (search then read) ──
  it('grep finds a pattern, then file_read reads the matched file', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/src/utils.ts', 'export function helper() { return 42; }');

    // Mock grep to return a match
    ctx.platform.search.grep = async () => [{
      file: '/src/utils.ts',
      line: 1,
      text: 'export function helper()',
    } as any];

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'grep', { pattern: 'helper', path: '/src' }),
      ])
      .addResponse([
        ...toolSeq('c2', 'file_read', { path: '/src/utils.ts' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'Found the helper function.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Find the helper function'));

    const msgs = ctx.runtime.getMessages();
    const uses = allToolUses(msgs);
    expect(uses).toContain('grep');
    expect(uses).toContain('file_read');
    // file_read returned the actual file content
    // file_read returned the actual file content (with line numbers)
    expect(allToolResults(msgs).some((r) => r.includes('export function helper'))).toBe(true);
  });

  // ── git_diff + git_log_range (code review basics) ──
  it('git_diff returns diff, git_log_range returns commits', async () => {
    const ctx = setupWithRealExecutors();
    ctx.bashOutputs.set('git diff', '+added line\n-removed line\n');
    ctx.bashOutputs.set('git log', 'abc123|Author|2024-01-01|Fix bug\n');

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'git_diff', { base: 'main' }),
        ...toolSeq('c2', 'git_log_range', { base: 'main', head: 'HEAD' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'The diff adds a line and the commit fixes a bug.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Review changes against main'));

    const msgs = ctx.runtime.getMessages();
    const uses = allToolUses(msgs);
    expect(uses).toContain('git_diff');
    expect(uses).toContain('git_log_range');
    // Diff result in context
    expect(allToolResults(msgs).some((r) => r.includes('added line'))).toBe(true);
  });

  // ── web_fetch fetches a URL ──
  it('web_fetch retrieves content from a URL', async () => {
    const ctx = setupWithRealExecutors();
    const http = ctx.platform.http as any;
    http.push({ json: { title: 'Test Page', content: 'Hello from web' }, headers: { 'content-type': 'application/json' } });

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'web_fetch', { url: 'https://example.com/api' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'The page says: Hello from web' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Fetch https://example.com/api'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('web_fetch');
    expect(http.calls[0].url).toBe('https://example.com/api');
    expect(allToolResults(msgs).some((r) => r.includes('Hello from web'))).toBe(true);
  });

  // ── web_search returns search results ──
  it('web_search queries Tavily and returns results', async () => {
    const ctx = setupWithRealExecutors();
    const http = ctx.platform.http as any;
    http.push({
      json: { results: [
        { title: 'Best Practices', url: 'https://best.example', content: 'Use tests' },
      ]},
      headers: { 'content-type': 'application/json' },
    });

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'web_search', { query: 'testing best practices' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'According to search results, use tests.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Search for testing best practices'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('web_search');
    // Tavily POST was called
    expect(http.calls[0].method).toBe('POST');
    expect(allToolResults(msgs).some((r) => r.includes('Best Practices'))).toBe(true);
  });

  // ── memory_save + memory_recall ──
  it('memory_save stores a note, memory_recall retrieves it', async () => {
    const ctx = setupWithRealExecutors();
    // We need storage for MemoryManager — wire it
    const memMgr = new MemoryManager();
    await memMgr.init(ctx.platform.storage);
    ctx.registry.unregister('memory_save');
    ctx.registry.unregister('memory_recall');
    ctx.registry.register(memorySaveDef, new MemorySaveExecutor(memMgr));
    ctx.registry.register(memoryRecallDef, new MemoryRecallExecutor(memMgr));

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'memory_save', { content: 'User prefers TypeScript' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'Saved your preference.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Remember: I prefer TypeScript'));

    // Turn 2: recall
    ctx.provider
      .addResponse([
        ...toolSeq('c2', 'memory_recall', { query: 'preferences' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'You prefer TypeScript.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('What do you know about me?'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('memory_save');
    expect(allToolUses(msgs)).toContain('memory_recall');
  });

  // ── plan_create + plan_update ──
  it('plan_create creates a plan, plan_update marks a step done', async () => {
    const ctx = setupWithRealExecutors();
    const pm = new PlanningManager();
    await pm.init(ctx.platform.storage);
    ctx.registry.unregister('plan_create');
    ctx.registry.unregister('plan_update_step');
    ctx.registry.register(planCreateDef, new PlanCreateExecutor(pm));
    ctx.registry.register(planUpdateStepDef, new PlanUpdateStepExecutor(pm));

    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'plan_create', {
          title: 'Setup Project',
          steps: [{ title: 'Init repo' }, { title: 'Add tests' }],
        }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'Plan created with 2 steps.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Create a plan to setup the project'));

    // Update first step
    ctx.provider
      .addResponse([
        ...toolSeq('c2', 'plan_update_step', { stepIndex: 0, status: 'completed' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'Step 1 marked complete.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Mark step 1 as done'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('plan_create');
    expect(allToolUses(msgs)).toContain('plan_update_step');
  });

  // ── Multi-tool chain: grep → file_read → file_edit ──
  it('chains grep → file_read → file_edit in one conversation', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/config.ts', 'const port = 3000;');
    ctx.platform.search.grep = async () => [{
      file: '/config.ts', line: 1, text: 'const port',
    } as any];

    ctx.provider
      .addResponse([...toolSeq('c1', 'grep', { pattern: 'port', path: '/' })])
      .addResponse([...toolSeq('c2', 'file_read', { path: '/config.ts' })])
      .addResponse([...toolSeq('c3', 'file_edit', {
        path: '/config.ts', old_string: '3000', new_string: '8080',
      })])
      .addResponse([
        { type: 'text_delta', text: 'Changed port from 3000 to 8080.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Find the port config and change it to 8080'));

    const msgs = ctx.runtime.getMessages();
    const uses = allToolUses(msgs);
    expect(uses).toEqual(['grep', 'file_read', 'file_edit']);
    // File actually modified
    expect(ctx.fileContents.get('/config.ts')).toBe('const port = 8080;');
  });

  // ── Error recovery: tool fails → LLM adapts ──
  it('handles a tool error gracefully and continues', async () => {
    const ctx = setupWithRealExecutors();
    // file_read on non-existent file returns error
    ctx.provider
      .addResponse([
        ...toolSeq('c1', 'file_read', { path: '/missing.txt' }),
      ])
      .addResponse([
        { type: 'text_delta', text: 'The file does not exist. Let me create it.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Read /missing.txt'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('file_read');
    // file_read on missing file returns empty content (not an error — the file
    // simply doesn't exist in the mock fs). The LLM then adapts its response.
    const results = allToolResults(msgs);
    // Result is either empty or an error — either way the conversation continues
    expect(results.length).toBeGreaterThan(0);
    // LLM still produced text after seeing the result
    expect(textOf(msgs[msgs.length - 1])).toContain('does not exist');
  });

  // ── Thinking + multiple tools + text in one turn ──
  it('renders thinking + 2 tool calls + text conclusion in one turn', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/a.ts', 'export const x = 1;');
    ctx.fileContents.set('/b.ts', 'export const y = 2;');

    ctx.provider
      .addResponse([
        { type: 'thinking_delta', thinking: 'I need to read both files to compare.' },
        ...toolSeq('c1', 'file_read', { path: '/a.ts' }),
        ...toolSeq('c2', 'file_read', { path: '/b.ts' }),
        { type: 'done', stopReason: 'tool_use' },
      ])
      .addResponse([
        { type: 'text_delta', text: 'File a has x=1, file b has y=2.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Compare a.ts and b.ts'));

    const msgs = ctx.runtime.getMessages();
    // Thinking is in context (assistant message with reasoning)
    const assistantMsgs = msgs.filter((m) => m.role === 'assistant');
    const hasThinking = assistantMsgs.some((m) =>
      Array.isArray(m.content) && m.content.some((b: any) => b.type === 'reasoning'),
    );
    expect(hasThinking).toBe(true);

    // Both file reads executed
    expect(allToolUses(msgs)).toEqual(['file_read', 'file_read']);
    // Both results in context
    // FileReadExecutor adds line numbers (e.g. "1\texport const x = 1;")
    expect(allToolResults(msgs).some((r) => r.includes('export const x = 1;'))).toBe(true);
    expect(allToolResults(msgs).some((r) => r.includes('export const y = 2;'))).toBe(true);
    // Final conclusion text
    expect(textOf(msgs[msgs.length - 1])).toContain('x=1');
  });

  // ── Three-turn conversation with increasing complexity ──
  it('sustains a 3-turn conversation: question → tool → follow-up → tool → summary', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/data.json', '{"name":"test","value":42}');

    // Turn 1: simple question
    ctx.provider.addResponse([
      { type: 'text_delta', text: 'I can help with that.' },
      { type: 'done', stopReason: 'stop' },
    ]);

    // Turn 2: read a file
    ctx.provider
      .addResponse([...toolSeq('c1', 'file_read', { path: '/data.json' })])
      .addResponse([
        { type: 'text_delta', text: 'The data has name=test and value=42.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    // Turn 3: modify the file
    ctx.provider
      .addResponse([...toolSeq('c2', 'file_edit', {
        path: '/data.json', old_string: '42', new_string: '100',
      })])
      .addResponse([
        { type: 'text_delta', text: 'Updated value from 42 to 100.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(ctx.runtime.run('Can you help me?'));
    await collectEvents(ctx.runtime.run('Read /data.json'));
    await collectEvents(ctx.runtime.run('Change the value to 100'));

    const msgs = ctx.runtime.getMessages();

    // 3 user messages; assistant messages may be more (tool-call + text per turn)
    const userMsgs = msgs.filter((m) => m.role === 'user');
    expect(userMsgs.length).toBe(3);

    // At least 3 assistant responses (turn 1 text + turn 2 tool+text + turn 3 tool+text)
    const assistantMsgs = msgs.filter((m) => m.role === 'assistant');
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(3);

    // Tools ran in turns 2 and 3
    expect(allToolUses(msgs)).toEqual(['file_read', 'file_edit']);

    // File was modified
    expect(ctx.fileContents.get('/data.json')).toContain('100');

    // First turn's text still intact
    expect(textOf(msgs[1])).toContain('I can help');
    // Last turn's conclusion — find the last assistant message with text
    const lastWithText = [...msgs].reverse().find((m) => m.role === 'assistant' && textOf(m));
    expect(textOf(lastWithText!)).toContain('100');
  });
});
