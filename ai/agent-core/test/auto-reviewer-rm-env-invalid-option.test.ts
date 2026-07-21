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

describe('AutoReviewerManager env invalid options', () => {
  it('does not treat env option parser failures as command launch', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('env -Z rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env --definitely-invalid rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env -0 rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env -iZ rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('preserves executing env option forms', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('env -i rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env -v rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env -u PATH rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env -S "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env MARKER=1 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });
});
