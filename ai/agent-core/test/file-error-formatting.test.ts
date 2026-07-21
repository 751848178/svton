import { describe, expect, it } from 'vitest';
import {
  FileEditExecutor,
  FileReadExecutor,
  FileWriteExecutor,
} from '../src/tool/builtins/file';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
}

function makeReadThrowingCtx(): ToolContext {
  const platform = createMockPlatform({
    fs: {
      readFile: async () => {
        throw { code: 'read_down' };
      },
    },
  });
  return { platform, sessionId: 'session', workingDir: '/' };
}

function makeWriteThrowingCtx(): ToolContext {
  const platform = createMockPlatform({
    fs: {
      writeFile: async () => {
        throw { code: 'write_down' };
      },
    },
  });
  return { platform, sessionId: 'session', workingDir: '/' };
}

describe('file tool filesystem error formatting', () => {
  it('normalizes non-Error file_read failures', async () => {
    const result = await new FileReadExecutor().execute(
      makeCall('file_read', { path: '/tmp/example.txt', limit: 5 }),
      makeReadThrowingCtx(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error reading file: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      path: '/tmp/example.txt',
      startLine: 1,
      requestedLimit: 5,
    });
  });

  it('normalizes non-Error file_write failures', async () => {
    const result = await new FileWriteExecutor().execute(
      makeCall('file_write', { path: '/tmp/example.txt', content: 'hello' }),
      makeWriteThrowingCtx(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error writing file: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      path: '/tmp/example.txt',
      contentLength: 5,
    });
  });

  it('normalizes non-Error file_edit failures', async () => {
    const result = await new FileEditExecutor().execute(
      makeCall('file_edit', {
        path: '/tmp/example.txt',
        old_string: 'hello',
        new_string: 'hi',
      }),
      makeReadThrowingCtx(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error editing file: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      path: '/tmp/example.txt',
      replaceAll: false,
    });
  });
});
