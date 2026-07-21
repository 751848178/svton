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

describe('AutoReviewerManager nested function return static assignments', () => {
  it('propagates return out of nested function bodies', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('f(){ if true; then target=/; return; fi; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ { target=/; return; target=/tmp/project; }; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ case x in x) target=/; return; target=/tmp/project;; esac; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ for x in a b; do target=/; return; target=/tmp/project; done; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ while true; do target=/; return; target=/tmp/project; done; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ until false; do target=/; return; target=/tmp/project; done; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(
      manager.review(bashContext('f(){ eval "target=/; return; target=/tmp/project"; target=/tmp/project; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('skips post-return assignments and keeps nested return status', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(
      manager.review(bashContext('target=/; f(){ if true; then target=/tmp/project; return; fi; target=/; }; f; rm -rf "$target"')),
    ).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(
      manager.review(bashContext('f(){ if true; then return 1; fi; target=/tmp/project; }; f || target=/; find "$target" -delete')),
    ).resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-find-delete-root' });
  });
});
