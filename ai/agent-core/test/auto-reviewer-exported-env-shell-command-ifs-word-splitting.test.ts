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

describe('AutoReviewerManager exported env shell-command IFS word splitting', () => {
  it('denies exported parent variables inherited by IFS-split shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target=/; bash${IFS}-c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('declare${IFS}-x${IFS}target=/; sh${IFS}-c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('keeps unexported or overridden IFS-split shell command strings user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; bash${IFS}-c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('export target=/; target=/tmp/project bash${IFS}-c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(
      manager.review(bashContext('export target=/; env${IFS}-u${IFS}target${IFS}bash${IFS}-c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
