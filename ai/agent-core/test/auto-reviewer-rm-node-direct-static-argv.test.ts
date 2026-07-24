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
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(`r${"m"}`, [`-r${"f"}`, `/`])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const flag=`-rf`; const target=`/`; require("node:child_process").spawnSync("rm", [flag, target])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`rm`, [String.raw`-rf`, String.raw`/`])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`r${"m"}`, [String.raw`-r${"f"}`, String.raw`/`])\'')))
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
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(true ? "rm" : "noop", [true ? "-rf" : "--version", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=true ? "r" + "m" : "noop"; const flag=true ? "-r" + "f" : "--version"; const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(true && "rm", [true && "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=false || "r" + "m"; const flag=false || "-r" + "f"; const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(null ?? "rm", [null ?? "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=null ?? "r" + "m"; const flag=null ?? "-r" + "f"; const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(["r", "m"].join(""), [["-r", "f"].join(""), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=["r", "m"].join(""); const flag=["-r", "f"].join(""); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".slice(1), ["x-rf".slice(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm".slice(1); const flag="x-rf".slice(1); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".substring(1), ["x-rf".substring(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm".substring(1); const flag="x-rf".substring(1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrmx".substring(1, 3), ["x-rfx".substring(1, 4), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".substr(1), ["x-rf".substr(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm".substr(1); const flag="x-rf".substr(1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrmx".substr(1, 2), ["x-rfx".substr(1, 3), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["slice"](1), ["x-rf"["slice"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["substring"](1), ["x-rf"["substring"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["substr"](1), ["x-rf"["substr"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm"["slice"](1); const flag="x-rf"["slice"](1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"?.slice(1), ["x-rf"?.slice(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"?.substring(1), ["x-rf"?.substring(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"?.["substr"](1), ["x-rf"?.["substr"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm"?.slice(1); const flag="x-rf"?.["slice"](1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".slice?.(1), ["x-rf".slice?.(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".substring?.(1), ["x-rf".substring?.(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["substr"]?.(1), ["x-rf"["substr"]?.(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm"?.slice?.(1); const flag="x-rf"?.["slice"]?.(1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["sl" + "ice"](1), ["x-rf"["sl" + "ice"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["sub" + "string"](1), ["x-rf"["sub" + "string"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["sub" + "str"](1), ["x-rf"["sub" + "str"](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm"?.["sl" + "ice"]?.(1); const flag="x-rf"?.["sl" + "ice"]?.(1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"[`slice`](1), ["x-rf"[`slice`](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"[`substring`](1), ["x-rf"[`substring`](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"[`substr`](1), ["x-rf"[`substr`](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="xrm"?.[`slice`]?.(1); const flag="x-rf"?.[`slice`]?.(1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm ".trim(), [" -rf ".trim(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm".trimStart(), [" -rf".trimStart(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("rm ".trimEnd(), ["-rf ".trimEnd(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=" rm ".trim(); const flag=" -rf ".trim(); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "["trim"](), [" -rf "["trim"](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm"["trimStart"](), ["-rf "["trimEnd"](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "?.trim(), [" -rf "?.trim(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm ".trim?.(), [" -rf ".trim?.(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "?.["trim"]?.(), [" -rf "?.["trim"]?.(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "["tr" + "im"](), [" -rf "["tr" + "im"](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm"["trim" + "Start"](), ["-rf "["trim" + "End"](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "?.["tr" + "im"]?.(), [" -rf "?.["tr" + "im"]?.(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "[`trim`](), [" -rf "[`trim`](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm"[`trimStart`](), ["-rf "[`trimEnd`](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "?.[`trim`]?.(), [" -rf "?.[`trim`]?.(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" xrm ".trim().slice(1), [" x-rf ".trim().slice(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" xrm".trimStart().substring(1), [" x-rf".trimStart().substring(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm ".trimEnd().substr(1), ["x-rf ".trimEnd().substr(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=" xrm ".trim().slice(1); const flag=" x-rf ".trim().slice(1); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("x".concat("rm").slice(1), ["x".concat("-rf").slice(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm".concat(" ").trim(), [" -rf".concat(" ").trim(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd="x".concat("rm").slice(1); const flag=" -rf".concat(" ").trim(); require("node:child_process").spawnSync(cmd, [flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.call("r", "m"), [String.prototype.concat.call("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.apply("r", ["m"]), [String.prototype.concat.apply("-r", ["f"]), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat["call"]("r", "m"), [String.prototype.concat["call"]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat["ca" + "ll"]("r", "m"), [String.prototype.concat["ca" + "ll"]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat?.["call"]?.("r", "m"), [String.prototype.concat?.["call"]?.("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat[`call`]("r", "m"), [String.prototype.concat[`call`]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat["ca" + `ll`]("r", "m"), [String.prototype.concat[`ca` + "ll"]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat?.[`call`]?.("r", "m"), [String.prototype.concat?.[`call`]?.("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["prototype"].concat.call("r", "m"), [String["prototype"].concat.call("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype["concat"].call("r", "m"), [String.prototype["concat"].call("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["proto" + "type"]["con" + "cat"]["call"]("r", "m"), [String["proto" + "type"]["con" + "cat"]["call"]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String?.["prototype"]?.["concat"]?.["call"]?.("r", "m"), [String?.["prototype"]?.["concat"]?.["call"]?.("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.bind("r", "m")(), [String.prototype.concat.bind("-r", "f")(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.bind("r")("m"), [String.prototype.concat.bind("-r")("f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.bind.call(String.prototype.concat, "r", "m")(), [String.prototype.concat.bind.call(String.prototype.concat, "-r", "f")(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.bind.apply(String.prototype.concat, ["r", "m"])(), [String.prototype.concat.bind.apply(String.prototype.concat, ["-r", "f"])(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode(114, 109), [String.fromCharCode(45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode(114, 109); const flag=String.fromCharCode(45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode?.(114, 109), [String.fromCharCode?.(45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode?.(114, 109); const flag=String.fromCharCode?.(45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String?.fromCharCode(114, 109), [String?.fromCharCode(45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String?.fromCharCode(114, 109); const flag=String?.fromCharCode(45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String?.["fromCharCode"](114, 109), [String?.["fromCharCode"](45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String?.["fromCharCode"](114, 109); const flag=String?.["fromCharCode"](45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["fromCharCode"](114, 109), [String["fromCharCode"](45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String["fromCharCode"](114, 109); const flag=String["fromCharCode"](45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["from" + "CharCode"](114, 109), [String["from" + "CharCode"](45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String["from" + "CharCode"](114, 109); const flag=String["from" + "CharCode"](45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCodePoint(114, 109), [String.fromCodePoint(45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCodePoint(114, 109); const flag=String.fromCodePoint(45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.call(null, 114, 109), [String.fromCharCode.call(null, 45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.call(null, 114, 109); const flag=String.fromCharCode.call(null, 45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode["call"](null, 114, 109), [String.fromCharCode["call"](null, 45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode["call"](null, 114, 109); const flag=String.fromCharCode["call"](null, 45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode["ca" + "ll"](null, 114, 109), [String.fromCharCode["ca" + "ll"](null, 45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode["ca" + "ll"](null, 114, 109); const flag=String.fromCharCode["ca" + "ll"](null, 45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode?.["call"](null, 114, 109), [String.fromCharCode?.["call"](null, 45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode?.["call"](null, 114, 109); const flag=String.fromCharCode?.["call"](null, 45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode?.call(null, 114, 109), [String.fromCharCode?.call(null, 45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode?.call(null, 114, 109); const flag=String.fromCharCode?.call(null, 45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.call?.(null, 114, 109), [String.fromCharCode.call?.(null, 45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.call?.(null, 114, 109); const flag=String.fromCharCode.call?.(null, 45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.apply(null, [114, 109]), [String.fromCharCode.apply(null, [45, 114, 102]), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.apply(null, [114, 109]); const flag=String.fromCharCode.apply(null, [45, 114, 102]); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.apply?.(null, [114, 109]), [String.fromCharCode.apply?.(null, [45, 114, 102]), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.apply?.(null, [114, 109]); const flag=String.fromCharCode.apply?.(null, [45, 114, 102]); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null, 114, 109)(), [String.fromCharCode.bind(null, 45, 114, 102)(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.bind(null, 114, 109)(); const flag=String.fromCharCode.bind(null, 45, 114, 102)(); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind?.(null, 114, 109)(), [String.fromCharCode.bind?.(null, 45, 114, 102)(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.bind?.(null, 114, 109)(); const flag=String.fromCharCode.bind?.(null, 45, 114, 102)(); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null, 114)(109), [String.fromCharCode.bind(null, 45)(114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.bind(null, 114)(109); const flag=String.fromCharCode.bind(null, 45)(114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null)(114, 109), [String.fromCharCode.bind(null)(45, 114, 102), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.bind(null)(114, 109); const flag=String.fromCharCode.bind(null)(45, 114, 102); const args=[flag, "/"]; require("node:child_process").spawnSync(cmd, args)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.call(null, "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.call(null, "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.call?.(null, "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.call?.(null, "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.apply(null, ["rm", ["-rf", "/"]])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.apply(null, ["rm", ["-rf", "/"]])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.apply?.(null, ["rm", ["-rf", "/"]])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.apply?.(null, ["rm", ["-rf", "/"]])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execFileSync.apply(null, ["rm", ["-rf", "/"]])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null, "rm", ["-rf", "/"])()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.bind(null, "rm", ["-rf", "/"])()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind?.(null, "rm", ["-rf", "/"])()\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null)("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.bind(null)("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.bind?.(null)("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null, "rm")(["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s.bind(null, "rm")(["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execFileSync.bind(null, "rm")(["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync?.("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s=require("node:child_process").spawnSync; s?.("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process")["spawnSync"]?.("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp=require("node:child_process"); cp["spawnSync"]?.("rm", ["-rf", "/"])\'')))
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
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".slice(1), ["x--version".slice(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const index=1; require("node:child_process").spawnSync("xrm".slice(index), ["x-rf".slice(index), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".substring(1), ["x--version".substring(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const index=1; require("node:child_process").spawnSync("xrm".substring(index), ["x-rf".substring(index), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".substr(1), ["x--version".substr(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const start=1; require("node:child_process").spawnSync("xrm".substr(start), ["x-rf".substr(start), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["slice"](1), ["x--version"["slice"](1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const key="slice"; require("node:child_process").spawnSync("xrm"[key](1), ["x-rf"[key](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"?.slice(1), ["x--version"?.slice(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const index=1; require("node:child_process").spawnSync("xrm"?.slice(index), ["x-rf"?.slice(index), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm".slice?.(1), ["x--version".slice?.(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const index=1; require("node:child_process").spawnSync("xrm".slice?.(index), ["x-rf".slice?.(index), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"["sl" + "ice"](1), ["x--version"["sl" + "ice"](1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const part="ice"; require("node:child_process").spawnSync("xrm"["sl" + part](1), ["x-rf"["sl" + part](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"[`slice`](1), ["x--version"[`slice`](1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("xrm"[`sl${"ice"}`](1), ["x-rf"[`sl${"ice"}`](1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm ".trim(), [" --version ".trim()])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const method="trim"; require("node:child_process").spawnSync(" rm "[method](), [" -rf "[method](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "["trim"](), [" --version "["trim"]()])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "["tr" + "im"](), [" --version "["tr" + "im"]()])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const part="im"; require("node:child_process").spawnSync(" rm "["tr" + part](), [" -rf "["tr" + part](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "[`trim`](), [" --version "[`trim`]()])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" rm "[`tr${"im"}`](), [" -rf "[`tr${"im"}`](), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(" xrm ".trim().slice(1), [" x--version ".trim().slice(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const index=1; require("node:child_process").spawnSync(" xrm ".trim().slice(index), [" x-rf ".trim().slice(index), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("x".concat("rm").slice(1), ["x".concat("--version").slice(1)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const tail=getTail(); require("node:child_process").spawnSync("x".concat(tail).slice(1), ["x".concat("-rf").slice(1), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.call("r", "m"), [String.prototype.concat.call("--", "version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.call("r", getTail()), [String.prototype.concat.call("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const parts=getParts(); require("node:child_process").spawnSync(String.prototype.concat.apply("r", parts), [String.prototype.concat.apply("-r", ["f"]), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat["call"]("r", "m"), [String.prototype.concat["call"]("--", "version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat[`call`]("r", "m"), [String.prototype.concat[`call`]("--", "version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat[`ca${"ll"}`]("r", "m"), [String.prototype.concat[`call`]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const key=getKey(); require("node:child_process").spawnSync(String.prototype.concat[key]("r", "m"), [String.prototype.concat["call"]("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["prototype"]["concat"].call("r", "m"), [String["prototype"]["concat"].call("--", "version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const key=getKey(); require("node:child_process").spawnSync(String[key].concat.call("r", "m"), [String["prototype"].concat.call("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype[`con${"cat"}`].call("r", "m"), [String.prototype["concat"].call("-r", "f"), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const parts=getParts(); require("node:child_process").spawnSync(String.prototype.concat["apply"]("r", parts), [String.prototype.concat["apply"]("-r", ["f"]), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.bind("r", "m")(), [String.prototype.concat.bind("--")("version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const r=getReceiver(); require("node:child_process").spawnSync(String.prototype.concat.bind(r, "m")(), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const tail=getTail(); require("node:child_process").spawnSync(String.prototype.concat.bind("r")(tail), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.prototype.concat.bind.call(String.prototype.concat, "r", "m")(), [String.prototype.concat.bind.call(String.prototype.concat, "--")("version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const fn=getFn(); require("node:child_process").spawnSync(String.prototype.concat.bind.call(fn, "r", "m")(), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const parts=getParts(); require("node:child_process").spawnSync(String.prototype.concat.bind.apply(String.prototype.concat, parts)(), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("rm", [flag, target]); const flag="-rf"; const target="/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'let flag="-rf"; const target="/"; flag=getFlag(); require("node:child_process").spawnSync("rm", [flag, target])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const flag="--version"; require("node:child_process").spawnSync("rm", [flag])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(("safe", "rm"), [("noop", "--version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(false ? "rm" : "noop", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cond=getCond(); require("node:child_process").spawnSync(cond ? "rm" : "noop", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(false && "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cond=getCond(); require("node:child_process").spawnSync(cond && "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("safe" ?? "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd=getCommand(); require("node:child_process").spawnSync(cmd ?? "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(["r", "m"].join(""), [["--", "version"].join("")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const sep=getSeparator(); require("node:child_process").spawnSync(["r", "m"].join(sep), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode(114, 109), [String.fromCharCode(45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const codes=[114, 109]; require("node:child_process").spawnSync(String.fromCharCode(...codes), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode?.(114, 109), [String.fromCharCode?.(45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("node:child_process").spawnSync(holder.fromCharCode?.(114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String?.fromCharCode(114, 109), [String?.fromCharCode(45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("node:child_process").spawnSync(holder?.fromCharCode(114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String?.["fromCharCode"](114, 109), [String?.["fromCharCode"](45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("node:child_process").spawnSync(holder?.["fromCharCode"](114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["fromCharCode"](114, 109), [String["fromCharCode"](45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const key=getKey(); require("node:child_process").spawnSync(String[key](114, 109), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String["from" + "CharCode"](114, 109), [String["from" + "CharCode"](45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const suffix=getSuffix(); require("node:child_process").spawnSync(String["from" + suffix](114, 109), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCodePoint(114, 109), [String.fromCodePoint(45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const codes=[114, 109]; require("node:child_process").spawnSync(String.fromCodePoint(...codes), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.call(null, 114, 109), [String.fromCharCode.call(null, 45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const receiver=getReceiver(); require("node:child_process").spawnSync(String.fromCharCode.call(receiver, 114, 109), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode["call"](null, 114, 109), [String.fromCharCode["call"](null, 45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const receiver=getReceiver(); require("node:child_process").spawnSync(String.fromCharCode["call"](receiver, 114, 109), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode["ca" + "ll"](null, 114, 109), [String.fromCharCode["ca" + "ll"](null, 45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const suffix="ll"; require("node:child_process").spawnSync(String.fromCharCode["ca" + suffix](null, 114, 109), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode?.["call"](null, 114, 109), [String.fromCharCode?.["call"](null, 45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("node:child_process").spawnSync(holder?.["call"](null, 114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode?.call(null, 114, 109), [String.fromCharCode?.call(null, 45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder=null; require("node:child_process").spawnSync(holder?.call(null, 114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.call?.(null, 114, 109), [String.fromCharCode.call?.(null, 45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("node:child_process").spawnSync(holder.call?.(null, 114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.apply(null, [114, 109]), [String.fromCharCode.apply(null, [45, 45, 118, 101, 114, 115, 105, 111, 110])])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const codes=[114, 109]; require("node:child_process").spawnSync(String.fromCharCode.apply(null, codes), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.apply?.(null, [114, 109]), [String.fromCharCode.apply?.(null, [45, 45, 118, 101, 114, 115, 105, 111, 110])])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("node:child_process").spawnSync(holder.apply?.(null, [114, 109]) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null, 114, 109)(), [String.fromCharCode.bind(null, 45, 45, 118, 101, 114, 115, 105, 111, 110)()])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd=String.fromCharCode.bind(null, 114, 109); require("node:child_process").spawnSync(cmd, ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind?.(null, 114, 109)(), [String.fromCharCode.bind?.(null, 45, 45, 118, 101, 114, 115, 105, 111, 110)()])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const holder={}; require("node:child_process").spawnSync(holder.bind?.(null, 114, 109) ?? "echo", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null, 114)(109), [String.fromCharCode.bind(null, 45, 45)(118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const code=getCode(); require("node:child_process").spawnSync(String.fromCharCode.bind(null, 114)(code), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null)(114, 109), [String.fromCharCode.bind(null)(45, 45, 118, 101, 114, 115, 105, 111, 110)])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.fromCharCode.bind(null)(), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(`rm`, [`--version`])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(`r${"m"}`, [`--${"version"}`])\'')))
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
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`r${"m"}`, [String.raw`--${"version"}`])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r".concat("m"), ["--".concat("version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(String.raw`rm ${getFlag()}`, ["/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const flag="-rf"; require("node:child_process").spawnSync(String.raw`rm`, [String.raw`${flag}`, String.raw`/`])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const raw=String.raw; require("node:child_process").spawnSync(raw`rm`, ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync("r".concat(getCommandTail()), ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync(cmd.concat("m"), ["-rf", "/"]); const cmd="r"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.call(null, "rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd=getCommand(); require("node:child_process").spawnSync.call(null, cmd, ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.call?.(null, "rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const cmd=getCommand(); require("node:child_process").spawnSync.call?.(null, cmd, ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.apply(null, ["rm", ["--version"]])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const args=getArgs(); require("node:child_process").spawnSync.apply(null, args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.apply?.(null, ["rm", ["--version"]])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const args=getArgs(); require("node:child_process").spawnSync.apply?.(null, args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null, "rm", ["--version"])()\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null, "rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind?.(null, "rm", ["--version"])()\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null)("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync.bind(null, "rm")(["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const args=getArgs(); require("node:child_process").spawnSync.bind(null, "rm")(args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const args=getArgs(); require("node:child_process").spawnSync.bind?.(null, "rm")(args)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process").spawnSync?.("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const missing=undefined; missing?.("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("node:child_process")["spawnSync"]?.("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const maybe={}; maybe["spawnSync"]?.("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
