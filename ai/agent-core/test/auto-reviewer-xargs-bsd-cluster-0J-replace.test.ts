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

describe('AutoReviewerManager BSD xargs clustered 0J replacement option', () => {
  it('denies root targets replaced into shell positionals by clustered -0J', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf '/\\0' | xargs -0JROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps scoped clustered -0J replacement targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf '/tmp/project\\0' | xargs -0JROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
