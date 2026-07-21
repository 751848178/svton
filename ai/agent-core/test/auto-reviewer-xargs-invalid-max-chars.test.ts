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

describe('AutoReviewerManager xargs invalid max-chars values', () => {
  it('keeps zero and nonnumeric max-chars values user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -s0 rm -rf',
      'printf "/\\0" | xargs -0 -s nope rm -rf',
      'printf "/\\0" | xargs -0 --max-chars=0 rm -rf',
      'printf "/\\0" | xargs -0 --max-chars=nope rm -rf',
      "printf '/\\0' | xargs -0 -s0 sh -c 'rm -rf \"$1\"' sh",
      "printf '/\\0' | xargs -0 -s nope sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('still denies valid max-chars values with root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -s1024 rm -rf',
      'printf "/\\0" | xargs -0 --max-chars=1024 rm -rf',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });
});
