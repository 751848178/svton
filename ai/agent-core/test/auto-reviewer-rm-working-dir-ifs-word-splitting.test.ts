import { describe, expect, it } from 'vitest';
import { AutoReviewerManager, BUILTIN_RULES } from '../src/auto-reviewer';
import type { ReviewContext } from '../src/auto-reviewer/types';

function bashContext(command: string, workingDir = '/project'): ReviewContext {
  return {
    toolCall: {
      id: 'call-1',
      name: 'bash',
      arguments: { command },
    },
    toolName: 'bash',
    args: { command },
    workingDir,
  };
}

describe('AutoReviewerManager rm working-dir IFS word splitting', () => {
  it('denies root-relative rm after IFS-split static cwd commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('cd${IFS}/; rm -rf .')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('cd${IFS}--${IFS}/; rm -rf .')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('pushd${IFS}/ >/dev/null; rm -rf .')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps project-scoped IFS-split cwd changes user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('cd${IFS}/project; rm -rf .')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies root rm targets from IFS-split pwd command substitutions', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('rm -rf "$(pwd${IFS})"', '/')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('rm -rf "$(pwd${IFS}-P)"', '/')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('rm -rf "$(pwd${IFS})"', '/project')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
