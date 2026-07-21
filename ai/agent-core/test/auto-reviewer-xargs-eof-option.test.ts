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

describe('AutoReviewerManager xargs optional eof option', () => {
  it('denies root targets after defaulted long eof option', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf '/\\n' | xargs --eof rm -rf")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('preserves explicit eof values and scoped target behavior', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf '/\\n' | xargs --eof=STOP rm -rf",
      "printf '/\\n' | xargs -E STOP rm -rf",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }

    await expect(
      manager.review(bashContext("printf '/tmp/project\\n' | xargs --eof rm -rf")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('honors null-delimited eof markers for default and BSD placement input', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "printf 'STOP\\0/\\0' | xargs -0 -E STOP rm -rf",
      "printf 'STOP\\0/\\0' | xargs -0 -E STOP sh -c 'rm -rf \"$2\"' sh",
      "printf 'STOP\\0/\\0' | xargs -0 -E STOP -JROOT sh -c 'rm -rf \"$2\"' sh ROOT",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }

    await expect(
      manager.review(bashContext("printf '/\\0STOP\\0other\\0' | xargs -0 -E STOP rm -rf")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps null-delimited line replacement input independent from eof markers', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("printf 'STOP\\0/\\0' | xargs -0 -E STOP -IROOT sh -c 'rm -rf \"$1\"' sh ROOT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });
});
