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

describe('AutoReviewerManager Node direct static argv', () => {
  it('denies dangerous rm through static Node direct process argv', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('node -e \'const cmd="rm"; const args=["-rf", "/"]; require("node:child_process").execFileSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm"; const args=["-rf", "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm"; require("node:child_process").spawnSync(cmd, ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const args=["-rf", "/"]; require("node:child_process").spawnSync("rm", args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {spawnSync: s}=require("node:child_process"); const cmd="rm"; const args=["-rf", "/"]; s(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp=require("node:child_process"); const cmd="rm"; const args=["-rf", "/"]; cp["spawnSync"](cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag="-rf"; const target="/"; require("node:child_process").spawnSync("rm", [flag, target])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag="-rf"; const target="/"; const args=[flag, target]; require("node:child_process").spawnSync("rm", args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {spawnSync: s}=require("node:child_process"); const flag="-rf"; const target="/"; s("rm", [flag, target])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {spawnSync}=require("node:child_process"); const cmd="rm"; const flag="-rf"; const target="/"; const args=[flag, target]; spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(`rm`, [`-rf`, `/`])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag=`-rf`; const target=`/`; require("node:child_process").spawnSync("rm", [flag, target])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`rm`, [String.raw`-rf`, String.raw`/`])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag=String.raw`-rf`; const target=String.raw`/`; const args=[flag, target]; require("node:child_process").spawnSync(String.raw`rm`, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r".concat("m"), ["-r".concat("f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const r="r"; const f="f"; require("node:child_process").spawnSync(r.concat("m"), ["-r".concat(f), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag="-r".concat("f"); const target="/"; const args=[flag, target]; require("node:child_process").spawnSync("r".concat("m"), args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r" + "m", ["-r" + "f", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const r="r"; const f="f"; require("node:child_process").spawnSync(r + "m", ["-r" + f, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag="-r" + "f"; const target="/"; const args=[flag, target]; require("node:child_process").spawnSync("rm", args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("r" + "m"), [("-r" + "f"), ("/")])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const r="r"; const f="f"; require("node:child_process").spawnSync(((r) + "m"), [("-r" + (f)), ("/")])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag=("-r" + "f"); const target=("/"); const args=[(flag), (target)]; require("node:child_process").spawnSync(("rm"), args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("safe", "rm"), [("noop", "-rf"), ("/")])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const r="r"; const f="f"; require("node:child_process").spawnSync(("safe", (r + "m")), [("noop", ("-r" + f)), ("/")])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag=("noop", "-rf"); const target=("/"); const args=[("unused", flag), (target)]; require("node:child_process").spawnSync(("noop", "rm"), args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('keeps unresolved or safe Node direct process argv user-reviewable', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(cmd, args); const cmd="rm"; const args=["-rf", "/"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let cmd="rm"; const args=["-rf", "/"]; cmd=getCommand(); require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd="rm"; const args=["--version"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("rm", [flag, target]); const flag="-rf"; const target="/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let flag="-rf"; const target="/"; flag=getFlag(); require("node:child_process").spawnSync("rm", [flag, target])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const flag="--version"; require("node:child_process").spawnSync("rm", [flag])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("safe", "rm"), [("noop", "--version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(`rm`, [`--version`])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const flag="-rf"; require("node:child_process").spawnSync(`rm`, [`${flag}`, `/`])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r" + "m", ["--" + "version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("rm", [flag + "f", "/"]); const flag="-r"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let flag="-r"; flag=getFlag(); require("node:child_process").spawnSync("rm", [flag + "f", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const flag="-r"; require("node:child_process").spawnSync("rm", [`${flag}` + "f", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("r" + "m"), [("--" + "version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("rm"), [(getFlag()), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const flag="-r"; require("node:child_process").spawnSync(("rm"), [(`${flag}` + "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync((getDecoy(), "rm"), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("rm"), [("noop", getFlag()), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`rm`, [String.raw`--version`])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r".concat("m"), ["--".concat("version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`rm ${getFlag()}`, ["/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const raw=String.raw; require("node:child_process").spawnSync(raw`rm`, ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r".concat(getCommandTail()), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(cmd.concat("m"), ["-rf", "/"]); const cmd="r"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
