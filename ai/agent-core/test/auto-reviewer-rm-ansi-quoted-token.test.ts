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

describe('AutoReviewerManager ANSI-C quoted rm tokens', () => {
  it('denies recursive force rm when options or targets use ANSI-C quotes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("rm $'-rf' /"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("rm -rf $'/'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps non-dangerous ANSI-C quoted rm-looking text user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("rm $'-rf' /tmp/project"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("echo rm $'-rf' /"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("rm $'-fr' $'~'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
