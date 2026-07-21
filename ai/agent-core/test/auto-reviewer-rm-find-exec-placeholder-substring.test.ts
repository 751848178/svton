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

describe('AutoReviewerManager find exec rm placeholder substrings', () => {
  it('denies root-equivalent rm targets built from GNU find placeholder substrings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'find / -maxdepth 0 -exec rm -rf {}/.. \\;',
      "find / -maxdepth 0 -exec sh -c 'rm -rf \"$1\"' sh {}/.. \\;",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('keeps scoped placeholder substring targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('find /tmp/project -maxdepth 0 -exec rm -rf {}/child \\;')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
