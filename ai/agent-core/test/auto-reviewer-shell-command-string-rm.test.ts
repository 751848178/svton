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

describe('AutoReviewerManager shell command string rm variants', () => {
  it('denies dangerous rm commands nested inside shell command strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('bash -c "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("sh -ec 'rm -fr ~'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('env bash -c "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("builtin command bash -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("builtin exec bash -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("env -S \"bash -c 'rm -fr $HOME'\"")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(
      manager.review(bashContext("bash -c 'rm -rf \"$1\"' bash /")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("sh -c 'rm -fr \"$@\"' sh /..")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("bash -c 'rm -rf \"$@\"/*' bash /")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("bash -c 'rm -fr \"${@}\"/.*' bash /")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("sh -c 'rm -rf \"$*\"/*' sh /")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('bash -c \'rm -rf "${1:-/}"\' bash')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('bash -c \'rm -fr "${1:-$HOME}"\' bash')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(
      manager.review(bashContext('bash -c \'rm -rf "${2-/}"\' bash safe')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext('bash -c \'rm -rf "${1:-/}"\' bash ./cache')),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('distinguishes command query options from shell execution wrappers', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("command -v bash -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("command -V bash -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("command -p bash -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("command -- bash -c 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });
});
