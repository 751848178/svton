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

describe('AutoReviewerManager find delete trap commands', () => {
  it('denies find delete commands installed through traps', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap 'find / -delete' EXIT"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext("trap -- 'cd / && find . -delete' 0"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext("trap \"$(printf 'find / -delete')\" EXIT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('denies trap actions that invoke destructive shell functions', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("f(){ find / -delete; }; trap f EXIT"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext("function f { cd / && find . -delete; }; trap -- f 0")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext('f(){ find "$1" -delete; }; trap "f /" EXIT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext('f(){ cd "$1" && find . -delete; }; trap "f /" EXIT')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
  });

  it('keeps non-destructive and incomplete trap commands user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap 'echo find / -delete' EXIT"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("f(){ find /tmp/project -delete; }; trap f EXIT"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("trap 'find / -delete'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('checks trap actions against later static working directory changes', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap 'find . -delete' EXIT; cd /"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext("trap 'find . -delete' EXIT; cd /tmp/project")),
    ).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('checks trap actions against later shell function definitions', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap f EXIT; f(){ find / -delete; }"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext('trap "f /" EXIT; f(){ find "$1" -delete; }')),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(
      manager.review(bashContext("f(){ find /tmp/project -delete; }; trap f EXIT; f(){ find / -delete; }")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-find-delete-root',
    });
    await expect(manager.review(bashContext("trap f EXIT; f(){ find /tmp/project -delete; }"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
