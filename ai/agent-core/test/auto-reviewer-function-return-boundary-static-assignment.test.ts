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

describe('AutoReviewerManager function return boundary static assignments', () => {
  it('treats negated return as exiting the current function', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; f(){ ! return 0; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ ! return 1; target=/tmp/project; }; f || target=/; find "$target" -delete')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('f(){ if true; then ! return 1; fi; target=/tmp/project; }; f || target=/; find "$target" -delete')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('does not treat return in subshell or pipeline segments as exiting the current function', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; f(){ ( return ); target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('target=/; f(){ return 1 | cat; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('target=/; f(){ return 1|cat; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
