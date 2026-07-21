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

describe('AutoReviewerManager launchctl execution wrapper', () => {
  it('denies dangerous shell commands after launchctl execution subcommands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("launchctl asuser 501 /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("launchctl bsexec 0 /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("launchctl bsexec nope /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("/bin/launchctl asuser 501 /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not treat non-executing launchctl forms as command launch', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("launchctl help asuser /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("launchctl asuser nope /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("launchctl asuser -1 /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('launchctl asuser 501'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('launchctl bsexec 0'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("launchctl print system /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});

describe('AutoReviewerManager launchctl submit wrapper', () => {
  it('denies dangerous shell commands submitted as launchd jobs', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("launchctl submit -l codex.test -- /bin/sh -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext("launchctl submit -l codex.test /bin/sh -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext("launchctl submit -lcodex.test -- /bin/sh -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext("launchctl submit -l codex.test -p/bin/sh -- sh -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext("launchctl submit -l codex.test -p /bin/sh /bin/sh -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
  });

  it('does not treat launchctl submit option failures as command launch', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("launchctl submit -- /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("launchctl submit -h -l codex.test -- /bin/sh -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'ask_user',
      });
    await expect(manager.review(bashContext("launchctl submit -l codex.test -p /bin/sh -- -c 'rm -rf /'")))
      .resolves.toMatchObject({
        verdict: 'ask_user',
      });
  });
});
