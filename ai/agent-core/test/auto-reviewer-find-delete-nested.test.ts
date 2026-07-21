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

describe('AutoReviewerManager nested find delete commands', () => {
  it('denies root find delete inside executed shell contexts', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      "bash -c 'find / -delete'",
      "sh -c 'find \"$1\" -delete' sh /",
      "eval 'find / -delete'",
      'f(){ find / -delete; }; f',
      "bash <<< 'find / -delete'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-find-delete-root',
      });
    }
  });

  it('keeps scoped or uninvoked nested find delete user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("bash -c 'find /tmp/project -delete'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('f(){ find / -delete; }'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
