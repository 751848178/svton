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

describe('AutoReviewerManager shell command env prefix assignments', () => {
  it('denies shell command strings that receive root targets from env prefixes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/ bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('target=/ sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('keeps scoped shell command env prefix targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/tmp/project bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('target=/tmp/project sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('denies env-wrapped shell command strings that receive root targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('env target=/ bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('env target=/ sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('env -i target=/ bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('target=/ env bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('keeps scoped env-wrapped shell command targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('env target=/tmp/project bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('env target=/tmp/project sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('denies exported parent variables inherited by shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('declare -x target=/; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('denies exported parent variables inherited through unrelated command env prefixes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target=/; other=1 bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('set -a; target=/; other=1 sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('export target=/; env other=1 bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('keeps explicit command env prefix overrides and cleared env wrappers user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target=/; target=/tmp/project bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('export target=/; env -i other=1 bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('export target=/; env -u target bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('denies export attributes inherited after later static assignments', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target; target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('declare -x target; target=/; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });

  it('denies allexport assignments inherited by shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('set -a; target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('set -o allexport; target=/; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
    await expect(
      manager.review(bashContext('set -a; target=/; set +a; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('set -a; declare +x target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('does not inherit unexported parent variables into shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('export target=/tmp/project; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('set -a; target=/tmp/project; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });

  it('does not inherit explicitly unexported parent variables into shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('export target=/; export -n target; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('declare -x target=/; declare +x target; sh -c \'find "$target" -delete\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('set -a; set +a; target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('set -a; export -n target=/; bash -c \'rm -rf "$target"\'')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
