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

describe('AutoReviewerManager xargs invalid batch sizes', () => {
  it('keeps zero max-args and max-lines batches user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -n0 rm -rf',
      'printf "/\\0" | xargs -0 -L0 rm -rf',
      'printf "/\\0" | xargs -0 --max-args=0 rm -rf',
      'printf "/\\0" | xargs -0 --max-lines=0 rm -rf',
      "printf '/\\0' | xargs -0 -n0 sh -c 'rm -rf \"$1\"' sh",
      "printf '/\\0' | xargs -0 -L0 sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps nonnumeric max-args and max-lines batches user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -n nope rm -rf',
      'printf "/\\0" | xargs -0 -L nope rm -rf',
      'printf "/\\0" | xargs -0 --max-args=nope rm -rf',
      'printf "/\\0" | xargs -0 --max-lines=nope rm -rf',
      "printf '/\\0' | xargs -0 -n nope sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('still denies valid max-args and max-lines batches with root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -n1 rm -rf',
      'printf "/\\0" | xargs -0 -L1 rm -rf',
      'printf "/\\0" | xargs -0 --max-args=1 rm -rf',
      'printf "/\\0" | xargs -0 --max-lines=1 rm -rf',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });
});
