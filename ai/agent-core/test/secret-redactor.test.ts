/**
 * PI010-R1 — Secret redactor leak tests.
 *
 * The previous default redactor was an identity no-op, so raw secrets flowed
 * from tool output into the model transcript/audit log. These tests prove the
 * real scrubber (`secret-redactor.utils`) detects and replaces structured
 * secret shapes, leaves non-secret text alone, and is the default installed on
 * `ToolExecutionService` (so the no-bypass execution path is covered).
 */
import { describe, it, expect } from 'vitest';
import {
  createSecretRedactor,
  redactPublicArguments,
  redactSecrets,
} from '../src/agent/secret-redactor.utils';
import { ToolExecutionService } from '../src/agent/tool-executor';
import { ToolRegistry, PermissionManager } from '@svton/agent-core';
import { buildAgentTools, type ToolEventSink } from '../src/agent/pi-tool-adapter';
import type { SvtonToolDefinition } from '../src/tool/types';
import type { IPlatform } from '@svton/agent-platform';

const sink: ToolEventSink = () => {};
const call = (name: string) => ({ id: `${name}-1`, name, arguments: {} as Record<string, unknown> });

function def(name: string): SvtonToolDefinition {
  return { name, description: `${name} tool`, parameters: { type: 'object', properties: {} } };
}

function mockPlatform(): IPlatform {
  return {
    sandbox: { createProfile: () => ({ kind: 'none' }) },
    execute: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
  } as unknown as IPlatform;
}

describe('redactSecrets — pattern coverage', () => {
  it('scrubs an AWS access key id', () => {
    expect(redactSecrets('key=AKIAIOSFODNN7EXAMPLE done')).toBe('key=[REDACTED:aws-key] done');
  });

  it('scrubs a labeled AWS secret access key (label preserved)', () => {
    const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'; // 40 chars
    expect(redactSecrets(`aws_secret_access_key=${secret}`)).toBe('aws_secret_access_key=[REDACTED:aws-secret]');
    expect(redactSecrets(`aws_secret_access_key=${secret}`)).not.toContain(secret);
  });

  it('scrubs a Bearer token (label preserved)', () => {
    expect(redactSecrets('Authorization: Bearer abcdef1234567890abcdef==')).toBe('Authorization: Bearer [REDACTED:bearer]');
  });

  it('scrubs a GitHub personal access token', () => {
    const tok = 'ghp_' + 'a'.repeat(36);
    expect(redactSecrets(`token: ${tok}`)).toBe('token: [REDACTED:github-token]');
  });

  it('scrubs a Slack token', () => {
    expect(redactSecrets('xoxb-1234567890-abcdefghij')).toBe('[REDACTED:slack-token]');
  });

  it('scrubs a Stripe live key', () => {
    expect(redactSecrets('sk_live_' + 'a'.repeat(24))).toBe('[REDACTED:stripe-key]');
  });

  it('scrubs a Google API key', () => {
    expect(redactSecrets('AIza' + 'a'.repeat(35))).toBe('[REDACTED:google-api-key]');
  });

  it('scrubs a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3ODkw.sig12345678';
    expect(redactSecrets(`auth=${jwt}`)).toBe('auth=[REDACTED:jwt]');
  });

  it('scrubs a PEM private key block', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
    expect(redactSecrets(pem)).toBe('[REDACTED:private-key]');
  });

  it('scrubs a labeled generic api_key (label preserved)', () => {
    expect(redactSecrets('api_key: ' + 'a'.repeat(24))).toBe('api_key: [REDACTED:api-key]');
  });

  it('is idempotent (redacting again is a no-op)', () => {
    const once = redactSecrets('AKIAIOSFODNN7EXAMPLE');
    expect(redactSecrets(once)).toBe(once);
  });

  it('leaves ordinary text untouched', () => {
    const txt = 'The build succeeded in 42s with no errors.';
    expect(redactSecrets(txt)).toBe(txt);
  });

  it('handles multiple secrets in one string', () => {
    const out = redactSecrets('AKIAIOSFODNN7EXAMPLE and ghp_' + 'b'.repeat(36));
    expect(out).toContain('[REDACTED:aws-key]');
    expect(out).toContain('[REDACTED:github-token]');
  });
});

describe('createSecretRedactor — ToolResult contract', () => {
  const redactor = createSecretRedactor();
  const base = { callId: 'c1', output: '', isError: false, metadata: { k: 1 } };

  it('returns the same object when nothing is redacted', () => {
    const r = { ...base, output: 'plain text' };
    expect(redactor(call('t'), r)).toBe(r);
  });

  it('returns a new (copied) object with scrubbed output, preserving metadata', () => {
    const r = { ...base, output: 'AKIAIOSFODNN7EXAMPLE' };
    const out = redactor(call('t'), r);
    expect(out).not.toBe(r);
    expect(out.output).toBe('[REDACTED:aws-key]');
    expect(out.callId).toBe('c1');
    expect(out.isError).toBe(false);
    expect(out.metadata).toEqual({ k: 1 });
  });

  it('preserves control metadata while recursively scrubbing patterned values', () => {
    const token = `ghp_${'z'.repeat(36)}`;
    const out = redactor(call('t'), {
      ...base,
      metadata: {
        secretQuestionIds: ['token'], tokenCount: 2, totalTokens: 3,
        nested: { stdout: token },
      },
    });
    expect(out.metadata).toMatchObject({
      secretQuestionIds: ['token'], tokenCount: 2, totalTokens: 3,
      nested: { stdout: '[REDACTED:github-token]' },
    });
  });
});

describe('public tool argument redaction', () => {
  it('uses key-aware recursion without redacting ids or count telemetry', () => {
    const value = redactPublicArguments({
      password: 'short-password',
      nested: {
        accessToken: 'short-token', tokenCount: 2, totalTokens: 3,
        secretQuestionIds: ['token'],
      },
      command: 'curl --api-key short-cli-key',
    });
    expect(JSON.stringify(value)).not.toContain('short-password');
    expect(JSON.stringify(value)).not.toContain('short-token');
    expect(JSON.stringify(value)).not.toContain('short-cli-key');
    expect(value).toMatchObject({
      password: '[REDACTED:field]',
      nested: { tokenCount: 2, totalTokens: 3, secretQuestionIds: ['token'] },
    });
  });

  it('terminalizes cyclic branches while preserving non-cyclic shared values', () => {
    const shared = { tokenCount: 2 };
    const cyclic: Record<string, unknown> = {
      apiKey: 'raw-api-key', first: shared, second: shared,
    };
    cyclic.self = cyclic;

    const value = redactPublicArguments(cyclic);

    expect(value).toMatchObject({
      apiKey: '[REDACTED:field]', first: { tokenCount: 2 }, second: { tokenCount: 2 },
      self: '[circular]',
    });
    expect(() => JSON.stringify(value)).not.toThrow();
  });
});

describe('ToolExecutionService default redactor — leak protection on the execution path', () => {
  // A tool executor that returns a fixed output (optionally containing a secret).
  function leakingExecutor(output: string) {
    return { async execute(c: { id: string }) { return { callId: c.id, output, isError: false }; } };
  }

  it('does NOT leak an AWS key through the default execution path', async () => {
    const registry = new ToolRegistry();
    const platform = mockPlatform();
    const pending = new Map<string, { call: { id: string }; resolve: (v: boolean) => void; timestamp: number }>();
    registry.register(def('file_read'), leakingExecutor('config: AKIAIOSFODNN7EXAMPLE') as never);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pending as never,
    );
    const tool = buildAgentTools(registry, service, sink)[0];
    const result = await tool.execute(call('file_read').id, {});
    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(text).toContain('[REDACTED:aws-key]');
  });

  it('can be disabled by installing an identity redactor', async () => {
    const registry = new ToolRegistry();
    const platform = mockPlatform();
    const pending = new Map<string, { call: { id: string }; resolve: (v: boolean) => void; timestamp: number }>();
    registry.register(def('file_read'), leakingExecutor('AKIAIOSFODNN7EXAMPLE') as never);
    const service = new ToolExecutionService(
      registry, platform, '/project',
      new PermissionManager({ mode: 'auto' }), null, pending as never,
    );
    service.setRedactor((_c, r) => r); // identity override
    const tool = buildAgentTools(registry, service, sink)[0];
    const result = await tool.execute(call('file_read').id, {});
    expect((result.content[0] as { text: string }).text).toBe('AKIAIOSFODNN7EXAMPLE');
  });
});
