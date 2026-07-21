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

describe('AutoReviewerManager xargs combined r0 lower replace option', () => {
  it('denies root targets replaced into shell positionals by GNU combined -r0i', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/\\0' | xargs -r0iROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '/\\0' | xargs -r0i sh -c 'rm -rf \"$1\"' sh {}",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps scoped combined -r0i replacement targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext(
        "printf '/tmp/project\\0' | xargs -r0iROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      )),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
