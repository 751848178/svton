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

describe('AutoReviewerManager loop-control IFS word splitting', () => {
  it('stops applying unreachable side effects after IFS-split break and continue', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(
        bashContext('target=/tmp/project; for item in a b; do target=/; break${IFS}; target=/tmp/project; done; rm -rf "$target"'),
      ),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(
        bashContext('target=/tmp/project; for item in a b; do target=/; continue${IFS}; target=/tmp/project; done; find "$target" -delete'),
      ),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('keeps safe IFS-split loop exits user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(
        bashContext('target=/; for item in a b; do target=/tmp/project; break${IFS}; target=/; done; rm -rf "$target"'),
      ),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(
        bashContext('target=/; for item in a b; do target=/tmp/project; continue${IFS}; target=/; done; rm -rf "$target"'),
      ),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
