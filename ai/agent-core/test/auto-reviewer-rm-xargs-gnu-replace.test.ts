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

describe('AutoReviewerManager GNU xargs replace rm targets', () => {
  it('denies recursive force rm targets substituted by GNU xargs replace options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf / | xargs -i{} sh -c 'rm -rf \"$1\"' sh {}",
      "printf / | xargs -i sh -c 'rm -rf \"$1\"' sh {}",
      "printf / | xargs --replace sh -c 'rm -rf \"$1\"' sh {}",
      'printf "/.*\\n" | xargs -iROOT rm -fr ROOT',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps safe GNU xargs replace targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf /tmp/project | xargs -i{} sh -c 'rm -rf \"$1\"' sh {}")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
