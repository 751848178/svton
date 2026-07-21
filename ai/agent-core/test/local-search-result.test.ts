import { describe, expect, it } from 'vitest';
import { GlobExecutor, GrepExecutor } from '../src/tool/builtins/search';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeGrepCall(): ToolCall {
  return {
    id: 'grep-result',
    name: 'grep',
    arguments: { pattern: 'needle', path: '.' },
  };
}

function makeGlobCall(): ToolCall {
  return {
    id: 'glob-result',
    name: 'glob',
    arguments: { pattern: '**/*.ts', path: '.' },
  };
}

function makeGrepCtx(): ToolContext {
  const platform = createMockPlatform({
    search: {
      grep: async () => [
        { file: { bad: true }, line: '12', text: 123 } as any,
      ],
    },
  });
  return { platform, sessionId: 's', workingDir: '/repo' };
}

function makeGlobCtx(): ToolContext {
  const platform = createMockPlatform({
    search: {
      glob: async () => [
        'src/ok.ts',
        { file: 'src/bad.ts' } as any,
      ],
    },
  });
  return { platform, sessionId: 's', workingDir: '/repo' };
}

function makeThrowingGrepCtx(): ToolContext {
  const platform = createMockPlatform({
    search: {
      grep: async () => {
        throw { code: 'grep_down' };
      },
    },
  });
  return { platform, sessionId: 's', workingDir: '/repo' };
}

function makeThrowingGlobCtx(): ToolContext {
  const platform = createMockPlatform({
    search: {
      glob: async () => {
        throw { code: 'glob_down' };
      },
    },
  });
  return { platform, sessionId: 's', workingDir: '/repo' };
}

describe('local search result handling', () => {
  it('rejects malformed grep backend matches before returning success', async () => {
    const result = await new GrepExecutor().execute(makeGrepCall(), makeGrepCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error searching');
    expect(result.output).toContain('invalid grep result');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      pattern: 'needle',
      path: '/repo/.',
    });
  });

  it('normalizes non-Error grep backend failures', async () => {
    const result = await new GrepExecutor().execute(makeGrepCall(), makeThrowingGrepCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error searching: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      pattern: 'needle',
      path: '/repo/.',
    });
  });

  it('rejects malformed glob backend file paths before returning success', async () => {
    const result = await new GlobExecutor().execute(makeGlobCall(), makeGlobCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error searching files');
    expect(result.output).toContain('invalid glob result');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      pattern: '**/*.ts',
      path: '/repo/.',
    });
  });

  it('normalizes non-Error glob backend failures', async () => {
    const result = await new GlobExecutor().execute(makeGlobCall(), makeThrowingGlobCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error searching files: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      pattern: '**/*.ts',
      path: '/repo/.',
    });
  });
});
