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

describe('AutoReviewerManager home parameter expansions', () => {
  it('denies home-preserving parameter expansions in destructive deletes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf ${HOME:?}'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -fr ${HOME%/}'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('find ${HOME:?} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-home',
    });
    await expect(manager.review(bashContext('find ${HOME%/} -delete'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-home',
    });
  });

  it('keeps alternate HOME parameter words user-reviewable when they are scoped', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf ${HOME:+./cache}'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('find ${HOME:+./cache} -delete'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies home-preserving substring and empty trim expansions', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'rm -rf ${HOME:0}',
      'rm -rf ${HOME:0}/.cache',
      'find ${HOME:0} -delete',
      'find ${HOME##} -delete',
      'rm -fr ${HOME#}',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
      });
    }
  });
});
