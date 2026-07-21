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

describe('AutoReviewerManager sandbox-exec wrapper', () => {
  it('denies dangerous commands after sandbox profiles', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("sandbox-exec -p '(version 1) (allow default)' rm -rf /")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext('sandbox-exec -f /tmp/profile.sb rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("sandbox-exec -D key=value -p '(version 1) (allow default)' rm -rf /")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext("/usr/bin/sandbox-exec -p '(version 1) (allow default)' rm -rf /")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
  });

  it('does not treat sandbox-exec option failures as command launch', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('sandbox-exec rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("sandbox-exec -h -p '(version 1) (allow default)' rm -rf /")))
      .resolves.toMatchObject({
        verdict: 'ask_user',
      });
    await expect(manager.review(bashContext("sandbox-exec -p '(version 1) (allow default)'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
