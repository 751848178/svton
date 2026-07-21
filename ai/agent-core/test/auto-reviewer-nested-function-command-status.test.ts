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

describe('AutoReviewerManager nested function command status static assignments', () => {
  it('uses nested function status for && and || dangerous assignments', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });
    const cases = [
      ['group true &&', 'f(){ true; }; { f && target=/; }; rm -rf "$target"', 'bash-rm-rf-root'],
      ['group false ||', 'f(){ false; }; { f || target=/; }; find "$target" -delete', 'bash-find-delete-root'],
      ['if true &&', 'f(){ true; }; if true; then f && target=/; fi; rm -rf "$target"', 'bash-rm-rf-root'],
      ['case false ||', 'f(){ false; }; case x in x) f || target=/;; esac; find "$target" -delete', 'bash-find-delete-root'],
      ['for true &&', 'f(){ true; }; for item in x; do f && target=/; done; rm -rf "$target"', 'bash-rm-rf-root'],
      ['eval false ||', 'f(){ false; }; eval "f || target=/"; find "$target" -delete', 'bash-find-delete-root'],
      ['nested definition &&', '{ f(){ true; } && target=/; }; rm -rf "$target"', 'bash-rm-rf-root'],
    ] as const;

    for (const [, command, ruleId] of cases) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId,
      });
    }
  });

  it('preserves nested safe overwrites gated by function status', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });
    const commands = [
      'target=/; f(){ true; }; { f && target=/tmp/project; }; rm -rf "$target"',
      'target=/; f(){ false; }; { f || target=/tmp/project; }; rm -rf "$target"',
      'target=/; f(){ true; }; if true; then f && target=/tmp/project; fi; rm -rf "$target"',
      'target=/; f(){ false; }; eval "f || target=/tmp/project"; rm -rf "$target"',
    ];

    for (const command of commands) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({ verdict: 'ask_user' });
    }
  });
});
