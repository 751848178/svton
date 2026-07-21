import { describe, expect, it } from 'vitest';
import { AutoReviewerManager, BUILTIN_RULES } from '../src/auto-reviewer';
import type { ReviewContext } from '../src/auto-reviewer/types';

function bashContext(command: string): ReviewContext {
  return {
    toolCall: {
      id: 'call-1',
      name: 'bash',
      arguments: { command },
    },
    toolName: 'bash',
    args: { command },
    workingDir: '/project',
  };
}

describe('AutoReviewerManager find exec rm files0-from start paths', () => {
  it('denies recursive force rm targets from static files0-from root starts', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('find -files0-from <(printf "/\\0") -maxdepth 0 -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps scoped and unknown files0-from starts user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('find -files0-from <(printf "/tmp/project\\0") -maxdepth 0 -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('find -files0-from roots.nul -maxdepth 0 -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
