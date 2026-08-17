import { describe, expect, it, vi } from 'vitest';
import { selectNativeToolUpdate } from '../src/agent/native-tool-event-selectors.utils';
import { createSecretRedactor } from '../src/agent/secret-redactor.utils';
import { BashExecutor } from '../src/tool/builtins/shell';
import type { ToolContext } from '../src/tool/types';

describe('timeline core boundary', () => {
  it('preserves real partial result content and stable call identity', () => {
    const update = selectNativeToolUpdate({
      type: 'tool_execution_update',
      toolCallId: 'call-1',
      toolName: 'bash',
      args: { command: 'printf ok' },
      partialResult: {
        content: [{ type: 'text', text: 'actual partial' }],
        details: { callId: 'spoofed', metadata: { phase: 1 } },
      },
    });
    expect(update).toMatchObject({
      callId: 'call-1',
      name: 'bash',
      partialResult: {
        callId: 'call-1',
        output: 'actual partial',
        metadata: { phase: 1 },
      },
    });
  });

  it('redacts nested public arguments and progress before client projection', () => {
    const update = selectNativeToolUpdate({
      type: 'tool_execution_update',
      toolCallId: 'call-secret',
      toolName: 'tool',
      args: { password: 'raw-password', nested: { accessToken: 'raw-token' } },
      partialResult: {
        content: [{ type: 'text', text: 'token=raw-progress-token' }],
        details: {},
      },
    });
    expect(JSON.stringify(update)).not.toContain('raw-password');
    expect(JSON.stringify(update)).not.toContain('raw-token');
    expect(JSON.stringify(update)).not.toContain('raw-progress-token');
  });

  it('redacts structured command streams as well as aggregate output', () => {
    const token = `ghp_${'a'.repeat(36)}`;
    const result = createSecretRedactor()(
      { id: 'c1', name: 'bash', arguments: {} },
      {
        callId: 'c1',
        output: token,
        metadata: { stdout: token, nested: { stderr: token } },
      },
    );
    expect(JSON.stringify(result)).not.toContain(token);
    expect(result.metadata).toMatchObject({
      stdout: '[REDACTED:github-token]',
      nested: { stderr: '[REDACTED:github-token]' },
    });
  });

  it('keeps separate ExecResult outcome fields without parsing combined output', async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: 'out', stderr: 'bad', exitCode: 7, signal: 'SIGTERM', timedOut: false,
    });
    const context = {
      platform: { process: { exec } },
      sessionId: 's1',
      workingDir: '/work',
    } as unknown as ToolContext;
    const result = await new BashExecutor().execute(
      { id: 'c1', name: 'bash', arguments: { command: 'false' } },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.metadata).toMatchObject({
      command: 'false', cwd: '/work', stdout: 'out', stderr: 'bad',
      exitCode: 7, signal: 'SIGTERM', timedOut: false,
    });
    expect(typeof result.metadata?.durationMs).toBe('number');
  });

  it('marks signal-only termination failed while retaining null exit and signal', async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: 'partial', stderr: '', exitCode: null, signal: 'SIGTERM', timedOut: false,
    });
    const context = {
      platform: { process: { exec } }, sessionId: 's1', workingDir: '/work',
    } as unknown as ToolContext;
    const result = await new BashExecutor().execute(
      { id: 'signal-only', name: 'bash', arguments: { command: 'sleep 10' } },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('[signal: SIGTERM]');
    expect(result.metadata).toMatchObject({ exitCode: null, signal: 'SIGTERM', timedOut: false });
  });
});
