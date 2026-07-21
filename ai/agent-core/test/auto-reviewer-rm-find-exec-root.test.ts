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

describe('AutoReviewerManager find exec rm root targets', () => {
  it('denies recursive force rm targets substituted from find root paths', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('find / -prune -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('find /.. -prune -exec rm -fr {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('find / -prune -exec rm -rf "{}" \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('find -H / -prune -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('find -L /.. -prune -exec rm -fr {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('find${IFS}/ -prune -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies recursive force rm targets passed through find exec shell positionals', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("find / -prune -exec sh -c 'rm -rf \"$1\"' sh {} \\;")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("find -L /.. -prune -exec sh -c 'rm -fr \"$@\"' sh {} \\;")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("bash -c 'find \"$1\" -prune -exec rm -rf {} \\;' bash /")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("find / -prune -exec sh -c 'rm -rf \"$@\"/*' sh {} \\;")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("find / -prune -exec sh -c 'rm -rf \"$0\"' {} \\;")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps scoped find exec shell argv0 targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext("find /tmp/project -prune -exec sh -c 'rm -rf \"$0\"' {} \\;")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('find${IFS}/tmp/project -prune -exec rm -rf {} \\;')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
