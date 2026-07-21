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

describe('AutoReviewerManager pipefail option IFS word splitting', () => {
  it('uses IFS-split pipefail state for pipeline assignment side effects', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('set${IFS}-o${IFS}pipefail; false | true || target=/; find "$target" -delete')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext('builtin${IFS}set${IFS}-o${IFS}pipefail; false | true || target=/; rm -rf "$target"')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('command${IFS}--${IFS}set${IFS}-o${IFS}pipefail; false | true || target=/; find "$target" -delete')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('keeps disabled or pipeline-local IFS-split pipefail state user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(
        bashContext('target=/; set${IFS}-o${IFS}pipefail; set${IFS}+o${IFS}pipefail; false | true && target=/tmp/project; rm -rf "$target"'),
      ),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('set${IFS}-o${IFS}pipefail | true; false | true || target=/; find "$target" -delete')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
