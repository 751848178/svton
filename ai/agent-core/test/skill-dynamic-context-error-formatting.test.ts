import { describe, expect, it, vi } from 'vitest';
import { resolveSkillDynamicContext } from '../src/agent/skill-dynamic-context.utils';
import { createMockPlatform } from './helpers';

describe('dynamic skill context error formatting', () => {
  it('normalizes non-Error command execution failures', async () => {
    const platform = createMockPlatform({
      process: {
        exec: vi.fn(async () => {
          throw { code: 'context_down' };
        }),
      },
      capabilities: { process: true },
    });

    const result = await resolveSkillDynamicContext('Context: !`pwd`', {
      platform,
      workingDir: '/repo',
    });

    expect(result).toBe('Context: [Error: Unknown error]');
    expect(result).not.toContain('[object Object]');
  });
});
