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

describe('AutoReviewerManager rm commands installed through trap', () => {
  it('denies dangerous recursive rm commands installed as exit traps', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap 'rm -rf /' EXIT"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("trap -- 'cd / && rm -rf .' 0"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("trap 'rm -fr ~' TERM"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(
      manager.review(bashContext("trap \"$(printf 'rm -rf /')\" EXIT")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not deny trap strings that do not execute dangerous rm commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap 'echo rm -rf /' EXIT"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("trap - EXIT"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("trap 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("trap -- 'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('checks trap actions against later shell state', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext("trap f EXIT; f(){ rm -rf /; }"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('trap "f /" EXIT; f(){ rm -rf "$1"; }'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(
      manager.review(bashContext("f(){ rm -rf /tmp/project; }; trap f EXIT; f(){ rm -rf /; }")),
    ).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("trap 'rm -rf .' EXIT; cd /"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("trap f EXIT; f(){ rm -rf /tmp/project; }"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });
});
