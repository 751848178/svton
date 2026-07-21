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

describe('AutoReviewerManager remote shell xargs max-args batching', () => {
  it('keeps single-invocation default xargs shell positionals user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe /\\n' | xargs sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies root targets in later xargs max-args shell invocations', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf 'safe /\\n' | xargs -n1 sh -c 'rm -rf \"$1\"' sh",
      "printf 'safe other /\\n' | xargs --max-args=2 sh -c 'rm -rf \"$1\"' sh",
      "printf 'safe other /\\n' | xargs -rn2 sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });
});
