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

describe('AutoReviewerManager xargs replacement followed by batch options', () => {
  it('denies root targets split by max-args after line replacement', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe /\\n' | xargs -IROOT -n2 sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });

    await expect(
      manager.review(bashContext("printf 'safe /\\n' | xargs -n2 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('keeps max-lines batches after line replacement user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe\\n/\\n' | xargs -IROOT -L2 sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });

    await expect(
      manager.review(bashContext("printf 'safe\\n/\\n' | xargs -L2 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies root chunks from max-args before line replacement', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf 'safe /\\n' | xargs -n1 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf 'safe other /\\n' | xargs -n2 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }

    await expect(
      manager.review(bashContext("printf 'safe /\\n' | xargs -n2 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
