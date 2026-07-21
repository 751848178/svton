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

describe('AutoReviewerManager xargs invalid numeric options', () => {
  it('keeps invalid max-procs and replacement numeric options user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -P nope rm -rf',
      'printf "/\\0" | xargs -0 --max-procs=nope rm -rf',
      'printf "/\\0" | xargs -0 -IROOT -R0 rm -rf ROOT',
      'printf "/\\0" | xargs -0 -IROOT -R nope rm -rf ROOT',
      'printf "/\\0" | xargs -0 -IROOT -S nope rm -rf ROOT',
      "printf '/\\0' | xargs -0 -P nope sh -c 'rm -rf \"$1\"' sh",
      "printf '/\\0' | xargs -0 -IROOT -R0 sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '/\\0' | xargs -0 -IROOT -S nope sh -c 'rm -rf \"$1\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('still denies valid zero-valued max-procs and replsize options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/\\0" | xargs -0 -P0 rm -rf',
      'printf "/\\0" | xargs -0 --max-procs=0 rm -rf',
      'printf "/\\0" | xargs -0 -IROOT -R1 rm -rf ROOT',
      'printf "/\\0" | xargs -0 -IROOT -S0 rm -rf ROOT',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });
});
