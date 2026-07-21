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

describe('AutoReviewerManager xargs optional max-lines options', () => {
  it('denies root targets after defaulted max-lines options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/\\n' | xargs -l rm -rf",
      "printf '/\\n' | xargs --max-lines rm -rf",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('preserves explicit max-lines values and scoped target behavior', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/\\n' | xargs -l2 rm -rf",
      "printf '/\\n' | xargs --max-lines=2 rm -rf",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }

    await expect(
      manager.review(bashContext("printf '/tmp/project\\n' | xargs -l rm -rf")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
