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

describe('AutoReviewerManager rm shell parameter default targets', () => {
  it('denies rm targets that default shell variables to root or home', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf "${TARGET:-/}"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('rm -rf "${TARGET-/}"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('rm -fr "${TARGET:-$HOME}"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies shell command string rm targets that default shell variables dangerously', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('bash -c \'rm -rf "${TARGET:-/}"\'')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('bash -c \'rm -fr "${TARGET:-$HOME}"\'')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('leaves safe shell variable default rm targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf "${TARGET:-./cache}"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("rm -rf '${TARGET:-/}'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('bash -c \'rm -rf "${TARGET:-./cache}"\'')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
