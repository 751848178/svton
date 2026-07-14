import { describe, it, expect } from 'vitest';
import {
  PermissionManager,
  type PermissionMode,
  type PermissionRule,
  type PermissionDecision,
  type ToolCall,
} from '@svton/agent-core';

// Helpers
const readTool = (name: string = 'file_read'): ToolCall => ({
  id: '1',
  name,
  arguments: { path: '/some/file.ts' },
});

const editTool = (name: string = 'file_edit'): ToolCall => ({
  id: '2',
  name,
  arguments: { path: '/some/file.ts', content: 'hello' },
});

const writeTool = (): ToolCall => ({
  id: '3',
  name: 'file_write',
  arguments: { path: '/some/file.ts', content: 'new content' },
});

const bashTool = (): ToolCall => ({
  id: '4',
  name: 'bash',
  arguments: { command: 'rm -rf /' },
});

const grepTool = (): ToolCall => ({
  id: '5',
  name: 'grep',
  arguments: { pattern: 'TODO', path: '/src' },
});

const globTool = (): ToolCall => ({
  id: '6',
  name: 'glob',
  arguments: { pattern: '**/*.ts' },
});

const webSearchTool = (): ToolCall => ({
  id: '7',
  name: 'web_search',
  arguments: { query: 'test' },
});

const webFetchTool = (): ToolCall => ({
  id: '8',
  name: 'web_fetch',
  arguments: { url: 'https://example.com' },
});

// ============================================================
// Auto mode
// ============================================================
describe('PermissionManager - auto mode', () => {
  it('allows all tool calls without approval', () => {
    const pm = new PermissionManager({ mode: 'auto' });
    const decision = pm.check(bashTool());
    expect(decision).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows read tools without approval', () => {
    const pm = new PermissionManager({ mode: 'auto' });
    expect(pm.check(readTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows edit tools without approval', () => {
    const pm = new PermissionManager({ mode: 'auto' });
    expect(pm.check(editTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows write tools without approval', () => {
    const pm = new PermissionManager({ mode: 'auto' });
    expect(pm.check(writeTool())).toEqual({ allowed: true, needsApproval: false });
  });
});

// ============================================================
// Read-only mode
// ============================================================
describe('PermissionManager - read_only mode', () => {
  it('allows file_read without approval', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    expect(pm.check(readTool('file_read'))).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows grep without approval', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    expect(pm.check(grepTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows glob without approval', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    expect(pm.check(globTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows web_search without approval', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    expect(pm.check(webSearchTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows web_fetch without approval', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    expect(pm.check(webFetchTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('denies file_write with reason', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    const decision = pm.check(writeTool());
    expect(decision.allowed).toBe(false);
    expect(decision.needsApproval).toBe(false);
    expect(decision.reason).toBe('Read-only mode');
  });

  it('denies file_edit with reason', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    const decision = pm.check(editTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Read-only mode');
  });

  it('denies bash with reason', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Read-only mode');
  });
});

// ============================================================
// Plan mode
// ============================================================
describe('PermissionManager - plan mode', () => {
  it('allows read tools without approval', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    expect(pm.check(readTool())).toEqual({ allowed: true, needsApproval: false });
    expect(pm.check(grepTool())).toEqual({ allowed: true, needsApproval: false });
    expect(pm.check(globTool())).toEqual({ allowed: true, needsApproval: false });
    expect(pm.check(webSearchTool())).toEqual({ allowed: true, needsApproval: false });
    expect(pm.check(webFetchTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows tools marked read-only by metadata', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    expect(pm.check(readTool('git_diff'), { readOnlyHint: true, destructiveHint: false })).toEqual({
      allowed: true,
      needsApproval: false,
    });
  });

  it('denies write tools with reason', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    const decision = pm.check(writeTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Plan mode - no modifications allowed');
  });

  it('denies edit tools with reason', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    const decision = pm.check(editTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Plan mode - no modifications allowed');
  });

  it('denies bash with reason', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Plan mode - no modifications allowed');
  });
});

// ============================================================
// Default mode
// ============================================================
describe('PermissionManager - default mode', () => {
  it('allows read tools without approval', () => {
    const pm = new PermissionManager({ mode: 'default' });
    const decision = pm.check(readTool());
    expect(decision).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows read-only annotated tools without approval', () => {
    const pm = new PermissionManager({ mode: 'default' });
    expect(pm.check(readTool('git_log_range'), { readOnlyHint: true })).toEqual({
      allowed: true,
      needsApproval: false,
    });
  });

  it('allows grep without approval', () => {
    const pm = new PermissionManager({ mode: 'default' });
    expect(pm.check(grepTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows glob without approval', () => {
    const pm = new PermissionManager({ mode: 'default' });
    expect(pm.check(globTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('asks approval for write tools', () => {
    const pm = new PermissionManager({ mode: 'default' });
    const decision = pm.check(writeTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
    expect(decision.reason).toBe('Requires approval');
  });

  it('asks approval for edit tools', () => {
    const pm = new PermissionManager({ mode: 'default' });
    const decision = pm.check(editTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
  });

  it('asks approval for bash', () => {
    const pm = new PermissionManager({ mode: 'default' });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
  });
});

// ============================================================
// Accept-edits mode
// ============================================================
describe('PermissionManager - accept_edits mode', () => {
  it('allows read tools without approval', () => {
    const pm = new PermissionManager({ mode: 'accept_edits' });
    expect(pm.check(readTool())).toEqual({ allowed: true, needsApproval: false });
    expect(pm.check(grepTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows file_write without approval', () => {
    const pm = new PermissionManager({ mode: 'accept_edits' });
    expect(pm.check(writeTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('allows file_edit without approval', () => {
    const pm = new PermissionManager({ mode: 'accept_edits' });
    expect(pm.check(editTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('asks approval for non-read non-edit tools', () => {
    const pm = new PermissionManager({ mode: 'accept_edits' });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
    expect(decision.reason).toBe('Requires approval');
  });
});

// ============================================================
// Rule matching
// ============================================================
describe('PermissionManager - rule matching', () => {
  it('matches by exact tool name', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash', effect: 'deny' }],
    });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Denied by rule: bash');
  });

  it('does not match unrelated tool names', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash', effect: 'deny' }],
    });
    const decision = pm.check(writeTool());
    // writeTool requires approval in default mode (no rule match)
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
  });

  it('matches pattern "Tool(specifier)" with glob', () => {
    // Use default mode so rules are actually evaluated (auto short-circuits)
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash(*git*)', effect: 'deny' }],
    });
    const gitCall: ToolCall = {
      id: '10',
      name: 'bash',
      arguments: { command: 'git commit -m "fix"' },
    };
    const decision = pm.check(gitCall);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Denied by rule: bash(*git*)');
  });

  it('does not match pattern when tool name differs', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash(*git*)', effect: 'deny' }],
    });
    // Different tool name; file_read is a read tool so allowed without approval
    const decision = pm.check(readTool('file_read'));
    expect(decision).toEqual({ allowed: true, needsApproval: false });
  });

  it('does not match pattern when specifier does not match', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash(*git*)', effect: 'deny' }],
    });
    const npmCall: ToolCall = {
      id: '11',
      name: 'bash',
      arguments: { command: 'npm install' },
    };
    // Arguments don't contain "git", so pattern won't match
    // Falls back to default mode: bash requires approval
    const decision = pm.check(npmCall);
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
  });

  it('matches wildcard "*" specifier', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash(*)', effect: 'ask' }],
    });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
    expect(decision.reason).toBe('Requires approval: bash(*)');
  });

  it('matches "?" single character glob', () => {
    const pm = new PermissionManager({
      mode: 'default',
      // The specifier is matched against JSON.stringify(arguments).
      // JSON.stringify({ command: 'git status' }) = '{"command":"git status"}'
      // Pattern '{"command":"?it *"}' -> '{"command":"git status"}' matches
      rules: [{ tool: 'bash({"command":"?it *"})', effect: 'deny' }],
    });
    const gitCall: ToolCall = {
      id: '12',
      name: 'bash',
      arguments: { command: 'git status' },
    };
    const decision = pm.check(gitCall);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Denied by rule: bash({"command":"?it *"})');
  });
});

// ============================================================
// Rule precedence
// ============================================================
describe('PermissionManager - rule precedence', () => {
  it('deny takes precedence over allow', () => {
    // Use default mode so rules are evaluated (auto short-circuits)
    const pm = new PermissionManager({
      mode: 'default',
      rules: [
        { tool: 'bash', effect: 'allow' },
        { tool: 'bash', effect: 'deny' },
      ],
    });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Denied by rule: bash');
  });

  it('deny takes precedence over ask', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [
        { tool: 'bash', effect: 'ask' },
        { tool: 'bash', effect: 'deny' },
      ],
    });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(false);
  });

  it('ask takes precedence over allow', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [
        { tool: 'bash', effect: 'allow' },
        { tool: 'bash', effect: 'ask' },
      ],
    });
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
    expect(decision.reason).toBe('Requires approval: bash');
  });

  it('rules take precedence over mode defaults', () => {
    const pm = new PermissionManager({
      mode: 'read_only',
      rules: [{ tool: 'bash', effect: 'allow' }],
    });
    const decision = pm.check(bashTool());
    expect(decision).toEqual({ allowed: true, needsApproval: false });
  });

  it('deny rule overrides mode that would allow', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'file_read', effect: 'deny' }],
    });
    const decision = pm.check(readTool());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Denied by rule: file_read');
  });
});

// ============================================================
// setMode / getMode
// ============================================================
describe('PermissionManager - setMode / getMode', () => {
  it('defaults to "default" mode when no config provided', () => {
    const pm = new PermissionManager();
    expect(pm.getMode()).toBe('default');
  });

  it('returns configured mode', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    expect(pm.getMode()).toBe('plan');
  });

  it('setMode changes the mode', () => {
    const pm = new PermissionManager({ mode: 'read_only' });
    expect(pm.getMode()).toBe('read_only');

    pm.setMode('auto');
    expect(pm.getMode()).toBe('auto');

    // Now all tools should be allowed
    expect(pm.check(bashTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('mode change affects permission decisions', () => {
    const pm = new PermissionManager({ mode: 'auto' });
    // auto allows everything
    expect(pm.check(bashTool())).toEqual({ allowed: true, needsApproval: false });

    pm.setMode('read_only');
    // read_only denies bash
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(false);
  });
});

// ============================================================
// addRule / removeRule
// ============================================================
describe('PermissionManager - addRule / removeRule', () => {
  it('addRule adds a new rule that takes effect', () => {
    const pm = new PermissionManager({ mode: 'default' });
    // bash would normally ask approval
    expect(pm.check(bashTool()).needsApproval).toBe(true);

    pm.addRule({ tool: 'bash', effect: 'allow' });
    expect(pm.check(bashTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('removeRule removes an existing rule by tool name', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash', effect: 'deny' }],
    });
    // Rule denies bash
    expect(pm.check(bashTool()).allowed).toBe(false);

    pm.removeRule('bash');
    // Back to default mode: bash requires approval
    const decision = pm.check(bashTool());
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
  });

  it('removeRule does nothing if rule does not exist', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash', effect: 'deny' }],
    });
    pm.removeRule('nonexistent');
    // bash rule still in effect
    expect(pm.check(bashTool()).allowed).toBe(false);
  });

  it('addRule can add multiple rules', () => {
    // Use default mode so rules are evaluated (auto short-circuits)
    const pm = new PermissionManager({ mode: 'default' });
    pm.addRule({ tool: 'bash', effect: 'deny' });
    pm.addRule({ tool: 'file_write', effect: 'ask' });

    expect(pm.check(bashTool()).allowed).toBe(false);
    expect(pm.check(writeTool()).needsApproval).toBe(true);
    expect(pm.check(readTool())).toEqual({ allowed: true, needsApproval: false });
  });

  it('removeRule only removes the exact tool name match', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [
        { tool: 'bash', effect: 'deny' },
        { tool: 'file_write', effect: 'deny' },
      ],
    });
    pm.removeRule('bash');
    // bash no longer denied; falls back to default mode => requires approval
    const bashDecision = pm.check(bashTool());
    expect(bashDecision.allowed).toBe(true);
    expect(bashDecision.needsApproval).toBe(true);
    // file_write still denied by rule
    expect(pm.check(writeTool()).allowed).toBe(false);
  });
});

// ============================================================
// Constructor defaults
// ============================================================
describe('PermissionManager - constructor', () => {
  it('works with no arguments', () => {
    const pm = new PermissionManager();
    expect(pm.getMode()).toBe('default');
    // Default mode: reads allowed, others need approval
    expect(pm.check(readTool())).toEqual({ allowed: true, needsApproval: false });
    expect(pm.check(bashTool()).needsApproval).toBe(true);
  });

  it('works with empty config', () => {
    const pm = new PermissionManager({});
    expect(pm.getMode()).toBe('default');
  });

  it('works with rules only', () => {
    const pm = new PermissionManager({
      rules: [{ tool: 'bash', effect: 'deny' }],
    });
    expect(pm.getMode()).toBe('default');
    expect(pm.check(bashTool()).allowed).toBe(false);
  });

  it('works with mode only', () => {
    const pm = new PermissionManager({ mode: 'plan' });
    expect(pm.getMode()).toBe('plan');
  });
});
