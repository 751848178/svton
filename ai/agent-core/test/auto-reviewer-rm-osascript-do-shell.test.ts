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

describe('AutoReviewerManager osascript do shell script', () => {
  it('denies dangerous shell commands embedded in static AppleScript', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('osascript -e \'do shell script "rm -rf /"\''))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/osascript -l AppleScript -e \'do shell script "rm -rf /"\'')))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext('osascript \'-edo shell script "rm -rf /"\'')))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext('osascript -e \'set cmd to "rm -rf /"\' -e \'do shell script cmd\'')))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    await expect(manager.review(bashContext('caffeinate osascript -e \'do shell script "rm -rf /"\'')))
      .resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
  });

  it('does not treat non-executing osascript forms as shell launch', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('osascript -l JavaScript -e \'do shell script "rm -rf /"\'')))
      .resolves.toMatchObject({
        verdict: 'ask_user',
      });
    await expect(manager.review(bashContext('osascript -h -e \'do shell script "rm -rf /"\''))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('osascript -e \'display dialog "do shell script \\"rm -rf /\\""\'"')))
      .resolves.toMatchObject({
        verdict: 'ask_user',
      });
    await expect(manager.review(bashContext('osascript -e \'set cmd to "rm -rf /"\' -e \'display dialog cmd\'')))
      .resolves.toMatchObject({
        verdict: 'ask_user',
      });
    await expect(manager.review(bashContext('osascript ./cleanup.scpt rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
