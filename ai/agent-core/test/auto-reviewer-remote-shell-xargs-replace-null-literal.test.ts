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

describe('AutoReviewerManager xargs null-delimited line replacement literals', () => {
  it('keeps null-delimited quoted and blanked roots user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '\"/\"\\0' | xargs -0 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf ' / \\0' | xargs -0 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT",
      "printf '\"/\"\\0' | xargs -0 sh -c 'rm -rf \"$1\"' sh",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('still denies plain null-delimited replacement roots', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf '/\\0' | xargs -0 -IROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("printf '/\\0' | xargs -0 sh -c 'rm -rf \"$1\"' sh")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });
});
