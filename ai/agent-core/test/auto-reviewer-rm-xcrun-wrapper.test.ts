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

describe('AutoReviewerManager xcrun wrapper', () => {
  it('denies dangerous shell commands after executing xcrun options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("xcrun /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("xcrun --run /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("xcrun --sdk macosx /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("xcrun --no-cache /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("xcrun --log --run /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("/usr/bin/xcrun /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not treat non-executing xcrun modes as command launch', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("xcrun --find /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("xcrun --help /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("xcrun --version /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("xcrun --show-sdk-path /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("xcrun --definitely-invalid /bin/sh -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
