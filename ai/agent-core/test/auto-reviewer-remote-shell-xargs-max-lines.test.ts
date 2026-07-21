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

describe('AutoReviewerManager remote shell xargs max-lines batching', () => {
  it('denies root targets in later xargs max-lines shell invocations', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf 'safe other\\n/\\n' | xargs -L1 sh -c 'rm -rf \"$1\"' sh",
      "printf 'safe other\\n/\\n' | xargs --max-lines=1 sh -c 'rm -rf \"$1\"' sh",
      "printf 'safe other\\n/\\n' | xargs -l sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps single-batch max-lines shell positionals user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe other\\n/\\n' | xargs -L2 sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('applies max-lines batching to null-delimited shell positionals', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe\\0/\\0' | xargs -0 -L1 sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("printf 'safe\\0/\\0' | xargs -0 -L1 sh -c 'rm -rf \"$2\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('applies post-replacement max-lines batching to null-delimited replacements', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(
        bashContext("printf 'safe\\0/\\0other\\0' | xargs -0 -IROOT -L2 sh -c 'rm -rf \"$1\"' sh ROOT"),
      ),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(
        bashContext("printf 'safe\\0/\\0other\\0' | xargs -0 -L2 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT"),
      ),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('continues physical input lines ending with a space before max-lines batching', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'safe \\n/\\n' | xargs -L1 sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext("printf 'safe\\n/\\n' | xargs -L1 sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });
});
