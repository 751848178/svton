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

describe('AutoReviewerManager function exported shell command strings', () => {
  it('denies parent exported variables inherited by function shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target=/; f(){ bash -c \'rm -rf "$target"\'; }; f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('declare -x target=/; f(){ sh -c \'find "$target" -delete\'; }; f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('denies function-exported variables inherited by later shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ export target=/; }; f; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ export target=/; }; f; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('denies function-local exported variables only while the function is active', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ local -x target=/; bash -c \'rm -rf "$target"\'; }; f')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ local -x target=/; }; f; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('f(){ declare -x target=/; }; f; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('keeps unexported and scoped exported function shell command strings user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; f(){ bash -c \'rm -rf "$target"\'; }; f')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('export target=/tmp/project; f(){ sh -c \'find "$target" -delete\'; }; f')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
