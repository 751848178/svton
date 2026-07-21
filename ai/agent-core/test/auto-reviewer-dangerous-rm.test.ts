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

describe('AutoReviewerManager dangerous rm variants', () => {
  it('denies root deletion when force appears before recursive flag', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -fr /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('rm -fR /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps terminating or invalid rm long options user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'rm --help -rf /',
      'rm -rf --help /',
      'rm --version -rf /',
      'rm --definitely-invalid -rf /',
      'rm --recursive=always --force /',
      'rm --recursive --force=always /',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('denies root deletion through valid rm long options', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'rm --recursive --force /',
      'rm --force --recursive /',
      'rm --no-preserve-root --recursive --force /',
      'rm --interactive=never --recursive --force /',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'deny',
        ruleId: 'bash-rm-rf-root',
      });
    }
  });

  it('denies home deletion when force appears before recursive flag', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -fR $HOME'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -fr ~/"cache"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('keeps quoted literal tilde targets user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'rm -fr "~"',
      "rm -fr '~'",
      'rm -fr ""~',
      "rm -fr ''~",
      "rm -fr $''~",
      'rm -fr "~"/cache',
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('denies path-qualified rm commands targeting root or home', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('/bin/rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('/usr/bin/rm -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies rm commands launched through simple wrappers', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('sudo rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('command rm -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('env FOO=1 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env -- rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('sudo -u root rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('sudo -n rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('sudo -n -u root rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('sudo -u root -n rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('sudo -E rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('nice -n 5 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('nice -n5 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('nice --adjustment=5 rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('doas -u root rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('exec -a wipe rm -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('keeps env terminating options user-reviewable before rm execution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'env --help rm -rf /',
      'env --version rm -rf /',
      'env -i --help rm -rf /',
      'env -i --version rm -rf /',
      "env --help bash -c 'rm -rf /'",
      "env --version sh -c 'rm -rf /'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps wrapper terminating options user-reviewable before rm execution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'nice --help rm -rf /',
      'nice --version rm -rf /',
      'sudo -V rm -rf /',
      'sudo --version rm -rf /',
      'sudo --help rm -rf /',
      "nice --help bash -c 'rm -rf /'",
      "sudo -V bash -c 'rm -rf /'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps sudo validate and list modes user-reviewable before rm execution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'sudo -v rm -rf /',
      'sudo --validate rm -rf /',
      'sudo -l rm -rf /',
      'sudo --list rm -rf /',
      'sudo -n -v rm -rf /',
      'sudo -n -l rm -rf /',
      'sudo -nv rm -rf /',
      'sudo -nl rm -rf /',
      "sudo -v bash -c 'rm -rf /'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps sudo edit mode operands user-reviewable before rm execution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'sudo -e rm -rf /',
      'sudo --edit rm -rf /',
      'sudo -n -e rm -rf /',
      'sudo -ne rm -rf /',
      "sudo -e bash -c 'rm -rf /'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('keeps invalid nice adjustment wrappers user-reviewable before rm execution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    for (const command of [
      'nice -n nope rm -rf /',
      'nice -n -- rm -rf /',
      'nice -nnope rm -rf /',
      'nice --adjustment nope rm -rf /',
      'nice --adjustment=nope rm -rf /',
      "nice -n nope bash -c 'rm -rf /'",
    ]) {
      await expect(manager.review(bashContext(command))).resolves.toMatchObject({
        verdict: 'ask_user',
      });
    }
  });

  it('does not deny rm-like arguments that are not executed as commands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('echo rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('printf rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies dangerous rm command strings launched through eval', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('eval "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('eval "cd /; rm -rf ."'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not deny rm-looking eval arguments unless eval executes rm', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('eval "echo rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies eval-launched rm command strings produced by command substitution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('$(printf eval) "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('$(echo eval) "cd /; rm -rf ."'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not deny command-substituted eval unless it executes rm', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('$(printf eval) "echo rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies rm command strings delivered to shells through process substitution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('bash <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('source <(printf "cd /; rm -rf .")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('sh <(echo rm -fr ~)'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('bash < <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash -s -- arg < <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash - < <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env -S "bash -" < <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('source /dev/stdin < <(printf "cd /; rm -rf .")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash /dev/fd/3 3< <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash /proc/self/fd/4 4< <(printf "rm -fr ~")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('. /dev/fd/3 3< <(printf "cd /; rm -rf .")'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies rm command strings piped as literal output into shells', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('printf "rm -rf /" | bash'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | bash -s -- arg'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | bash -'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | env -S "bash -"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('printf "cd /; rm -rf ." | source /dev/stdin'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('echo rm -fr ~ | sh'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | bash /dev/stdin'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('printf "rm -fr ~" | bash /dev/fd/0'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('printf "cd /; rm -rf ." | source /dev/fd/0'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('denies rm here-doc scripts piped into shells', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext(`cat <<EOF | bash
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`cat <<EOF | source /dev/stdin
cd /; rm -rf .
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`cat <<EOF | sh
rm -fr ~
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext(`cat <<END-MARK | bash
rm -rf /
END-MARK`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`cat <<END-MARK | source /dev/stdin
cd /; rm -rf .
END-MARK`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`cat <<END-MARK | sh
rm -fr ~
END-MARK`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('does not deny process substitutions unless a shell executes a dangerous rm script', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cat <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash <(printf "echo rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('cat < <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -c "cat" < <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('cat /dev/fd/3 3< <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -c "cat" /dev/fd/3 3< <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | cat'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | bash -c "cat"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | cat /dev/stdin'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('printf "rm -rf /" | bash -c "cat" /dev/stdin'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`cat <<EOF | cat
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`cat <<EOF | bash -c "cat"
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`cat <<END-MARK | cat
rm -rf /
END-MARK`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`cat <<END-MARK | bash -c "cat"
rm -rf /
END-MARK`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies rm command strings delivered to shells through here-strings', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('bash <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('source /dev/stdin <<< "cd /; rm -rf ."'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("sh <<< \"$(printf 'rm -fr ~')\""))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext("bash <<< $'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("source /dev/stdin <<< $'cd /; rm -rf .'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("sh <<< $'rm -fr ~'"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('bash /dev/stdin <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash /dev/fd/0 <<< "rm -fr ~"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('source /dev/fd/0 <<< "cd /; rm -rf ."'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash /dev/fd/3 3<<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash -s -- arg <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash - <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env -S "bash -" <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('env --split-string "bash -s -- arg" <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('bash /proc/self/fd/4 4<<< "rm -fr ~"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('. /dev/fd/3 3<<< "cd /; rm -rf ."'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not deny here-strings unless a shell executes a dangerous rm script', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('cat <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash <<< "echo rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("cat <<< $'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext("bash -c 'cat' <<< $'rm -rf /'"))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('cat /dev/stdin <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -c "cat" /dev/stdin <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('cat /dev/fd/3 3<<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -c "cat" /dev/fd/3 3<<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -- -s <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -- - <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('env -S "bash -- -" <<< "rm -rf /"'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies rm command strings delivered to shells through here-docs', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext(`bash <<EOF
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`source /dev/stdin <<'EOF'
cd /; rm -rf .
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`sh <<-EOF
rm -fr ~
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext(`bash <<END-MARK
rm -rf /
END-MARK`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`source /dev/stdin <<END-MARK
cd /; rm -rf .
END-MARK`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`bash /dev/fd/3 3<<EOF
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext(`sh -s -- arg <<EOF
rm -fr ~
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext(`sh - <<EOF
rm -fr ~
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext(`env -S "sh -" <<EOF
rm -fr ~
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext(`. /dev/fd/3 3<<EOF
cd /; rm -rf .
EOF`))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
  });

  it('does not deny here-docs unless a shell executes a dangerous rm script', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext(`cat <<EOF
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`bash -c "cat" <<EOF
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`cat /dev/fd/3 3<<EOF
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`bash -c "cat" /dev/fd/3 3<<EOF
rm -rf /
EOF`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`cat <<END-MARK
rm -rf /
END-MARK`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext(`bash -c "cat" <<END-MARK
rm -rf /
END-MARK`))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('bash -c "cat" <(printf "rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies dangerous targets after earlier rm operands', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf ./cache /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('rm -rf ./cache $HOME'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies shell-quoted dangerous rm targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf "/"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('rm -rf "$HOME"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies braced home expansion rm targets', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf ${HOME}'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -rf "${HOME}"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies quoted home rm targets containing spaces', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf "$HOME/My Projects"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -rf "${HOME}/My Projects"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies quoted home rm targets containing command separators', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf "$HOME/Old; Archive"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -rf "${HOME}/Q2 & Q3"'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies quoted rm executable tokens targeting root or home', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('"rm" -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('"/bin/rm" -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies rm executable tokens resolved through command substitution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('$(which rm) -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('"$(command -v rm)" -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies rm executable tokens produced by literal command substitution', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('$(printf rm) -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('$(printf r)$(printf m) -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('"$(printf r)$(printf m)" -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('$(echo rm) -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies wrapper rm commands produced by literal command substitution word splitting', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('$(printf "sudo rm") -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('$(printf "env rm") -rf /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext('$(echo command rm) -fr ~'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('does not deny non-rm commands produced by literal command substitution word splitting', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('$(printf echo) rm -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('$(printf r)$(printf m) -rf /tmp/project'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('$(date)$(printf m) -rf /'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
  });

  it('denies quoted recursive force option tokens', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm "-rf" /'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-root',
    });
    await expect(manager.review(bashContext("rm '-fr' ~"))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });

  it('denies home targets when only the home expression path segment is quoted', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('rm -rf "$HOME"/Projects'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
    await expect(manager.review(bashContext('rm -rf "${HOME}"/*'))).resolves.toMatchObject({
      verdict: 'deny',
      ruleId: 'bash-rm-rf-home',
    });
  });
});
