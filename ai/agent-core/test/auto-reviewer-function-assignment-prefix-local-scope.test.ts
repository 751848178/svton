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

describe('AutoReviewerManager function assignment-prefix local scope', () => {
  it('applies assignment-prefix values inside function calls without leaking them', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ rm -rf "$target"; }; target=/ f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ find "$target" -delete; }; target=/ f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('target=/tmp/project; f(){ target=/; }; target=/tmp/project f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('keeps declare and typeset assignments local to functions by default', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; f(){ declare target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('target=/tmp/project; f(){ declare target=/; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('target=/; f(){ typeset target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ declare target=/; rm -rf "$target"; }; f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });
});
