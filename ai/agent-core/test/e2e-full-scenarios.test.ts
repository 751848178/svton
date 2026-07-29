/**
 * Full-scenario E2E conversation tests (Pi-backed runtime).
 *
 * Covers EVERY tool type in realistic conversation flows, plus the key
 * multi-tool chains and mixed scenarios.
 *
 * Strategy: a fauxProvider-backed `Models` collection scripts the exact LLM
 * behaviour (which tools to call, what text to emit), while each tool
 * executor runs against a mock platform (in-memory fs / process / search /
 * http). This verifies the full Pi-owned pipeline without a real LLM.
 */
import { describe, it, expect } from 'vitest';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { PermissionManager } from '../src/permission/manager';
import {
  fileReadDef, FileReadExecutor,
  fileWriteDef, FileWriteExecutor,
  fileEditDef, FileEditExecutor,
  bashDef, BashExecutor,
  grepDef, GrepExecutor,
  gitDiffDef, GitDiffExecutor,
  gitLogRangeDef, GitLogRangeExecutor,
  webSearchDef, WebSearchExecutor,
  webFetchDef, WebFetchExecutor,
  memorySaveDef, MemorySaveExecutor,
  memoryRecallDef, MemoryRecallExecutor,
  planCreateDef, PlanCreateExecutor,
  planUpdateStepDef, PlanUpdateStepExecutor,
} from '../src/tool/builtins';
import { MemoryManager } from '../src/memory/manager';
import { PlanningManager } from '../src/planning/manager';
import {
  createMockModels,
  createMockPlatform,
  createMockHttpClient,
  collectEvents,
  fauxAssistantMessage,
  fauxToolCall,
  fauxText,
  fauxThinking,
  type MockModelsHandle,
} from './helpers';
import type { ChatMessage } from '../src/provider/types';

// ── Helpers ──────────────────────────────────────────────

function textOf(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }
  return '';
}

function allToolResults(msgs: ChatMessage[]): string[] {
  return msgs
    .filter((m) => m.role === 'tool')
    .flatMap((m) => {
      if (!Array.isArray(m.content)) return [];
      return m.content.filter((b: any) => b.type === 'tool_result').map((b: any) => b.output);
    });
}

function allToolUses(msgs: ChatMessage[]): string[] {
  return msgs
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => {
      if (!Array.isArray(m.content)) return [];
      return m.content.filter((b: any) => b.type === 'tool_use').map((b: any) => b.name);
    });
}

/** Script a tool-call LLM response. */
const toolResp = (name: string, args: Record<string, unknown>) =>
  fauxAssistantMessage([fauxToolCall(name, args)]);
/** Script a text LLM response. */
const textResp = (text: string) => fauxAssistantMessage([fauxText(text)]);

interface TestSetup {
  runtime: SvtonAgentRuntime;
  mock: MockModelsHandle;
  platform: ReturnType<typeof createMockPlatform>;
  registry: ToolRegistry;
  fileContents: Map<string, string>;
  bashOutputs: Map<string, string>;
}

function setupWithRealExecutors(): TestSetup {
  const mock = createMockModels();
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

  registry.register(fileReadDef, new FileReadExecutor());
  registry.register(fileWriteDef, new FileWriteExecutor());
  registry.register(fileEditDef, new FileEditExecutor());
  registry.register(bashDef, new BashExecutor());
  registry.register(grepDef, new GrepExecutor());
  registry.register(gitDiffDef, new GitDiffExecutor());
  registry.register(gitLogRangeDef, new GitLogRangeExecutor());

  const http = createMockHttpClient();
  (platform as any).http = http;
  registry.register(webFetchDef, new WebFetchExecutor());
  registry.register(webSearchDef, new WebSearchExecutor({ provider: 'tavily', apiKey: 'tvly-test' }));

  const runtime = SvtonAgentRuntime.create(
    {
      models: mock.models,
      piModel: mock.model,
      model: 'test-model',
      toolRegistry: registry,
      capabilities: { permissionManager: new PermissionManager({ mode: 'auto' }) },
    },
    platform,
  );

  return { runtime, mock, platform, registry, fileContents, bashOutputs };
}

// ============================================================
// Tests
// ============================================================

describe('Full-scenario E2E conversations (Pi-backed)', () => {
  it('file_write creates a file, then file_read reads it back', async () => {
    const ctx = setupWithRealExecutors();
    ctx.mock.addResponse(toolResp('file_write', { path: '/test.txt', content: 'Hello World' }));
    ctx.mock.addResponse(textResp('File written.'));

    await collectEvents(ctx.runtime.run('Write a file'));

    ctx.mock.addResponse(toolResp('file_read', { path: '/test.txt' }));
    ctx.mock.addResponse(textResp('The file contains: Hello World'));

    await collectEvents(ctx.runtime.run('Read the file'));

    expect(ctx.fileContents.get('/test.txt')).toBe('Hello World');
    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('file_write');
    expect(allToolUses(msgs)).toContain('file_read');
    expect(allToolResults(msgs).some((r) => r.includes('File written'))).toBe(true);
    expect(allToolResults(msgs).some((r) => r.includes('Hello World'))).toBe(true);
  });

  it('file_edit modifies an existing file', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/app.ts', 'const x = 1;\nconsole.log(x);\n');

    ctx.mock.addResponse(toolResp('file_edit', { path: '/app.ts', old_string: 'const x = 1;', new_string: 'const x = 2;' }));
    ctx.mock.addResponse(textResp('Updated x from 1 to 2.'));

    await collectEvents(ctx.runtime.run('Fix the bug'));

    expect(ctx.fileContents.get('/app.ts')).toContain('const x = 2');
    expect(ctx.fileContents.get('/app.ts')).not.toContain('const x = 1;');
  });

  it('bash executes a command and returns output', async () => {
    const ctx = setupWithRealExecutors();
    ctx.bashOutputs.set('ls -la', 'file1.txt\nfile2.ts\n');

    ctx.mock.addResponse(toolResp('bash', { command: 'ls -la' }));
    ctx.mock.addResponse(textResp('Found 2 files.'));

    await collectEvents(ctx.runtime.run('List files'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('bash');
    expect(allToolResults(msgs).find((r) => r.includes('file1.txt'))).toBeDefined();
  });

  it('grep finds a pattern, then file_read reads the matched file', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/src/utils.ts', 'export function helper() { return 42; }');
    ctx.platform.search.grep = async () => [{ file: '/src/utils.ts', line: 1, text: 'export function helper()' } as any];

    ctx.mock.addResponse(toolResp('grep', { pattern: 'helper', path: '/src' }));
    ctx.mock.addResponse(toolResp('file_read', { path: '/src/utils.ts' }));
    ctx.mock.addResponse(textResp('Found the helper function.'));

    await collectEvents(ctx.runtime.run('Find the helper function'));

    const msgs = ctx.runtime.getMessages();
    const uses = allToolUses(msgs);
    expect(uses).toContain('grep');
    expect(uses).toContain('file_read');
    expect(allToolResults(msgs).some((r) => r.includes('export function helper'))).toBe(true);
  });

  it('git_diff returns diff, git_log_range returns commits', async () => {
    const ctx = setupWithRealExecutors();
    ctx.bashOutputs.set('git diff', '+added line\n-removed line\n');
    ctx.bashOutputs.set('git log', 'abc123|Author|2024-01-01|Fix bug\n');

    ctx.mock.addResponse(fauxAssistantMessage([fauxToolCall('git_diff', { base: 'main' }), fauxToolCall('git_log_range', { base: 'main', head: 'HEAD' })]));
    ctx.mock.addResponse(textResp('The diff adds a line and the commit fixes a bug.'));

    await collectEvents(ctx.runtime.run('Review changes against main'));

    const msgs = ctx.runtime.getMessages();
    const uses = allToolUses(msgs);
    expect(uses).toContain('git_diff');
    expect(uses).toContain('git_log_range');
    expect(allToolResults(msgs).some((r) => r.includes('added line'))).toBe(true);
  });

  it('web_fetch retrieves content from a URL', async () => {
    const ctx = setupWithRealExecutors();
    const http = ctx.platform.http as any;
    http.push({ json: { title: 'Test Page', content: 'Hello from web' }, headers: { 'content-type': 'application/json' } });

    ctx.mock.addResponse(toolResp('web_fetch', { url: 'https://example.com/api' }));
    ctx.mock.addResponse(textResp('The page says: Hello from web'));

    await collectEvents(ctx.runtime.run('Fetch https://example.com/api'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('web_fetch');
    expect(http.calls[0].url).toBe('https://example.com/api');
    expect(allToolResults(msgs).some((r) => r.includes('Hello from web'))).toBe(true);
  });

  it('web_search queries Tavily and returns results', async () => {
    const ctx = setupWithRealExecutors();
    const http = ctx.platform.http as any;
    http.push({ json: { results: [{ title: 'Best Practices', url: 'https://best.example', content: 'Use tests' }] }, headers: { 'content-type': 'application/json' } });

    ctx.mock.addResponse(toolResp('web_search', { query: ' \ntesting best practices\t ', max_results: 1 }));
    ctx.mock.addResponse(textResp('According to search results, use tests.'));

    await collectEvents(ctx.runtime.run('Search for testing best practices'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('web_search');
    expect(http.calls[0].method).toBe('POST');
    expect(JSON.parse(http.calls[0].body)).toMatchObject({ query: 'testing best practices', max_results: 1 });
    expect(allToolResults(msgs).some((r) => r.includes('Best Practices'))).toBe(true);
  });

  it('memory_save stores a note, memory_recall retrieves it', async () => {
    const ctx = setupWithRealExecutors();
    const memMgr = new MemoryManager();
    await memMgr.init(ctx.platform.storage);
    ctx.registry.unregister('memory_save');
    ctx.registry.unregister('memory_recall');
    ctx.registry.register(memorySaveDef, new MemorySaveExecutor(memMgr));
    ctx.registry.register(memoryRecallDef, new MemoryRecallExecutor(memMgr));

    ctx.mock.addResponse(toolResp('memory_save', { content: 'User prefers TypeScript' }));
    ctx.mock.addResponse(textResp('Saved your preference.'));

    await collectEvents(ctx.runtime.run('Remember: I prefer TypeScript'));
    await memMgr.saveAutoMemory('Project uses pnpm', 'general');

    ctx.mock.addResponse(toolResp('memory_recall', { query: 'TypeScript' }));
    ctx.mock.addResponse(textResp('You prefer TypeScript.'));

    await collectEvents(ctx.runtime.run('What do you know about me?'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('memory_save');
    expect(allToolUses(msgs)).toContain('memory_recall');
    const results = allToolResults(msgs);
    const recallResult = results[results.length - 1];
    expect(recallResult).toContain('User prefers TypeScript');
    expect(recallResult).not.toContain('pnpm');
  });

  it('plan_create creates a plan, plan_update marks a step done', async () => {
    const ctx = setupWithRealExecutors();
    const pm = new PlanningManager();
    await pm.init(ctx.platform.storage);
    ctx.registry.unregister('plan_create');
    ctx.registry.unregister('plan_update_step');
    ctx.registry.register(planCreateDef, new PlanCreateExecutor(pm));
    ctx.registry.register(planUpdateStepDef, new PlanUpdateStepExecutor(pm));

    ctx.mock.addResponse(toolResp('plan_create', { title: 'Setup Project', steps: [{ title: 'Init repo' }, { title: 'Add tests' }] }));
    ctx.mock.addResponse(textResp('Plan created with 2 steps.'));

    await collectEvents(ctx.runtime.run('Create a plan to setup the project'));

    ctx.mock.addResponse(toolResp('plan_update_step', { stepIndex: 0, status: 'completed' }));
    ctx.mock.addResponse(textResp('Step 1 marked complete.'));

    await collectEvents(ctx.runtime.run('Mark step 1 as done'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('plan_create');
    expect(allToolUses(msgs)).toContain('plan_update_step');
  });

  it('chains grep → file_read → file_edit in one conversation', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/config.ts', 'const port = 3000;');
    ctx.platform.search.grep = async () => [{ file: '/config.ts', line: 1, text: 'const port' } as any];

    ctx.mock.addResponse(toolResp('grep', { pattern: 'port', path: '/' }));
    ctx.mock.addResponse(toolResp('file_read', { path: '/config.ts' }));
    ctx.mock.addResponse(toolResp('file_edit', { path: '/config.ts', old_string: '3000', new_string: '8080' }));
    ctx.mock.addResponse(textResp('Changed port from 3000 to 8080.'));

    await collectEvents(ctx.runtime.run('Find the port config and change it to 8080'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toEqual(['grep', 'file_read', 'file_edit']);
    expect(ctx.fileContents.get('/config.ts')).toBe('const port = 8080;');
  });

  it('handles a tool error gracefully and continues', async () => {
    const ctx = setupWithRealExecutors();
    ctx.mock.addResponse(toolResp('file_read', { path: '/missing.txt' }));
    ctx.mock.addResponse(textResp('The file does not exist. Let me create it.'));

    await collectEvents(ctx.runtime.run('Read /missing.txt'));

    const msgs = ctx.runtime.getMessages();
    expect(allToolUses(msgs)).toContain('file_read');
    const results = allToolResults(msgs);
    expect(results.length).toBeGreaterThan(0);
    expect(textOf(msgs[msgs.length - 1])).toContain('does not exist');
  });

  it('renders thinking + 2 tool calls + text conclusion in one turn', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/a.ts', 'export const x = 1;');
    ctx.fileContents.set('/b.ts', 'export const y = 2;');

    ctx.mock.addResponse(fauxAssistantMessage([fauxThinking('I need to read both files to compare.'), fauxToolCall('file_read', { path: '/a.ts' }), fauxToolCall('file_read', { path: '/b.ts' })]));
    ctx.mock.addResponse(textResp('File a has x=1, file b has y=2.'));

    await collectEvents(ctx.runtime.run('Compare a.ts and b.ts'));

    const msgs = ctx.runtime.getMessages();
    const assistantMsgs = msgs.filter((m) => m.role === 'assistant');
    const hasThinking = assistantMsgs.some((m) => Array.isArray(m.content) && m.content.some((b: any) => b.type === 'reasoning'));
    expect(hasThinking).toBe(true);
    expect(allToolUses(msgs)).toEqual(['file_read', 'file_read']);
    expect(allToolResults(msgs).some((r) => r.includes('export const x = 1;'))).toBe(true);
    expect(allToolResults(msgs).some((r) => r.includes('export const y = 2;'))).toBe(true);
    expect(textOf(msgs[msgs.length - 1])).toContain('x=1');
  });

  it('sustains a 3-turn conversation: question → tool → follow-up → tool → summary', async () => {
    const ctx = setupWithRealExecutors();
    ctx.fileContents.set('/data.json', '{"name":"test","value":42}');

    ctx.mock.addResponse(textResp('I can help with that.'));
    ctx.mock.addResponse(toolResp('file_read', { path: '/data.json' }));
    ctx.mock.addResponse(textResp('The data has name=test and value=42.'));
    ctx.mock.addResponse(toolResp('file_edit', { path: '/data.json', old_string: '42', new_string: '100' }));
    ctx.mock.addResponse(textResp('Updated value from 42 to 100.'));

    await collectEvents(ctx.runtime.run('Can you help me?'));
    await collectEvents(ctx.runtime.run('Read /data.json'));
    await collectEvents(ctx.runtime.run('Change the value to 100'));

    const msgs = ctx.runtime.getMessages();
    const userMsgs = msgs.filter((m) => m.role === 'user');
    expect(userMsgs.length).toBe(3);
    const assistantMsgs = msgs.filter((m) => m.role === 'assistant');
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(3);
    expect(allToolUses(msgs)).toEqual(['file_read', 'file_edit']);
    expect(ctx.fileContents.get('/data.json')).toContain('100');
    expect(textOf(msgs[1])).toContain('I can help');
    const lastWithText = [...msgs].reverse().find((m) => m.role === 'assistant' && textOf(m));
    expect(textOf(lastWithText!)).toContain('100');
  });
});
