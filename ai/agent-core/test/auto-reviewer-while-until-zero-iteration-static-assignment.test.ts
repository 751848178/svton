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

describe('AutoReviewerManager zero-iteration while/until static assignments', () => {
  it('applies condition side effects before skipped loop bodies', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('while target=/; false; do target=/tmp/project; done; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('until target=/; true; do target=/tmp/project; done; find "$target" -delete')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('target=/; while target=/tmp/project; false; do target=/; done; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('target=/; until target=/tmp/project; true; do target=/; done; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('treats zero-iteration loops as successful commands for && assignments', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('while false; do target=/tmp/project; done && target=/; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('until true; do target=/tmp/project; done && target=/; find "$target" -delete')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });
});
