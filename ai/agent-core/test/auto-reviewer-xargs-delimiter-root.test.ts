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

describe('AutoReviewerManager xargs delimiter root targets', () => {
  it('denies delimiter-separated recursive force rm root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/X" | xargs -d X rm -rf',
      'printf "/X" | xargs --delimiter X rm -rf',
      'printf "/X" | xargs --delimiter=X rm -rf',
      'xargs -d X -a <(printf "/X") rm -rf',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('denies delimiter-separated replacement root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('printf "/X" | xargs -d X -I{} rm -rf {}')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('printf "/X" | xargs -d X -I{} find {} -delete')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('keeps delimiter-separated scoped targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'printf "/tmp/projectX" | xargs -d X rm -rf',
      'printf "/tmp/projectX" | xargs --delimiter=X rm -rf',
      'printf "/tmp/projectX" | xargs -d X -I{} find {} -delete',
      'xargs --delimiter=X --arg-file=<(printf "/tmp/projectX") rm -rf',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });
});
