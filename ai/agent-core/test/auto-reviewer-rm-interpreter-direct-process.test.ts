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

describe('AutoReviewerManager interpreter direct process execution', () => {
  it('denies dangerous literal argv arrays passed to interpreter process APIs', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\;\\ subprocess.run\\([\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"]\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(("rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\;\\ subprocess.Popen\\(\\(\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\)\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args=["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen(args=("rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(check=True, args=("rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\;\\ subprocess.run\\(args=\\[\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\]\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["rm", "-rf", "/"]; subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`python3 -c "import subprocess; argv=[\"rm\", \"-rf\", \"/\"]; subprocess.run(argv)"`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=("rm", "-rf", "/"); subprocess.Popen(argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["rm", "-rf", "/"]; subprocess.run(args=argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["not-rm", "-rf", "/"]; subprocess.run(argv, executable="rm")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; subprocess.run(["not-rm", "-rf", "/"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; argv=["not-rm", "-rf", "/"]; subprocess.run(args=argv, executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="-rf"; subprocess.run(["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; target="/"; subprocess.run(["rm", "-rf", target])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="-rf"; argv=["rm", flag, "/"]; subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run([b"rm", b"-rf", b"/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run([r"rm", r"-rf", r"/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd=u"rm"; flag=u"-rf"; subprocess.run([cmd, flag, u"/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run([f"rm", f"-rf", f"/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd=f"rm"; flag=f"-rf"; subprocess.run([cmd, flag, f"/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["r" "m", "-r" "f", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="r" "m"; flag="-r" "f"; subprocess.run([cmd, flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["sh", "-c", "rm -rf /"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess as sp; sp.run(["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess as sp; argv=["rm", "-rf", "/"]; sp.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import run; run(["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from subprocess import Popen as pop; pop(args=("rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\ as\\ sp\\;\\ sp.run\\(\\[\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\]\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "-rf", "/"], executable="rm")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen(args=("not-rm", "-rf", "/"), executable="/bin/rm")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(check=True, executable="rm", args=("not-rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\;\\ subprocess.run\\([\\"not-rm\\",\\ \\"-rf\\",\\ \\"/\\"\\],\\ executable=\\"rm\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnvp(os.P_WAIT, "rm", ["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; exe="rm"; os.spawnlp(os.P_WAIT, exe, "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; exe="/bin/rm"; os.spawnvp(os.P_WAIT, exe, ["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=["rm", "-rf", "/"]; os.spawnvp(os.P_WAIT, "rm", argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=("rm", "-rf", "/"); os.spawnvpe(os.P_WAIT, "rm", argv, os.environ)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=["rm", "-rf", "/"]; os.execvp("rm", argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; exe="/bin/rm"; argv=["rm", "-rf", "/"]; os.execvp(exe, argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; os.spawnvp(os.P_WAIT, "rm", ["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; os.spawnlp(os.P_WAIT, "rm", "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; target="/"; os.execlp("rm", "rm", "-rf", target)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; exe="/bin/rm"; os.spawnlp(os.P_WAIT, exe, "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, r"rm", r"rm", r"-rf", r"/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, b"rm", b"rm", b"-rf", b"/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, f"rm", f"rm", f"-rf", f"/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "r" "m", "r" "m", "-r" "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os as o; o.execlp("rm", "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from os import execlp as ex; flag="-rf"; ex("rm", "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from os import execvp as ev; ev("rm", ("rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -esystem\\(\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'exec(["rm", "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["/bin/rm", "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -esystem\\(\\[\\"rm\\",\\ \\"rm\\"\\],\\ \\"-rf\\",\\ \\"/\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn("/bin/rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("sh", "-c", "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -eexec\\(\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec {"rm"} "rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"/bin/rm"} "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system("sh", "-c", "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execFileSync("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process").execFileSync("sh", ["-c", "rm -rf /"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {spawnSync: s} = require("child_process"); s("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const {execFileSync: e} = require("node:child_process"); e("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'require("child_process")["spawnSync"]("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const cp = require("node:child_process"); cp["execFileSync"]("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process")["spawnSync"]; s("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { spawnSync as s } from "node:child_process"; s("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { execFileSync as e } from "child_process"; e("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import * as cp from "node:child_process"; cp["spawnSync"]("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
  });

  it('does not treat missing code or non-dangerous argv arrays as root deletion', async () => {
    const manager = new AutoReviewerManager({
      mode: 'auto_review',
      rules: BUILTIN_RULES,
    });

    await expect(manager.review(bashContext('python3 -c'))).resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -econsole.log("rm -rf /")'))).resolves.toMatchObject({
      verdict: 'ask_user',
    });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", "--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(("rm", "--version"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(args=("rm", "--version"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "--version"], executable="rm")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess as sp; sp.run(["rm", "--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["rm", "--version"]; subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`python3 -c "import subprocess; argv=[\"rm\", \"--version\"]; subprocess.run(argv)"`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; subprocess.run(["not-rm", "--version"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "-rf", "/"], executable=exe); exe="rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; exe=get_exe(); subprocess.run(["not-rm", "-rf", "/"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="--version"; subprocess.run(["rm", flag])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run([b"rm", b"--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm"; subprocess.run([f"{cmd}", f"-rf", f"/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["r" "m", "--" "version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["sh", "-c", "rm --version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="r"; subprocess.run([f"{cmd}" "m", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", flag, "/"]); flag="-rf"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="-rf"; flag=get_flag(); subprocess.run(["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(argv); argv=["rm", "-rf", "/"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["rm", "-rf", "/"]; argv=get_argv(); subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", "rm", "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="--version"; os.spawnlp(os.P_WAIT, "rm", "rm", flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "not-rm", "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=["rm", "--version"]; os.spawnvp(os.P_WAIT, "rm", argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.execlp("rm", "rm", flag, "/"); flag="-rf"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.execvp("rm", argv); argv=["rm", "-rf", "/"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; flag=get_flag(); os.spawnlp(os.P_WAIT, "rm", "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=["rm", "-rf", "/"]; argv=get_argv(); os.spawnvp(os.P_WAIT, "rm", argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "rm"], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["not-rm", "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'spawn("rm", "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "rm", "--version"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"not-rm"} "rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process").spawnSync("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; s("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'const s = require("child_process").spawnSync; process("rm", ["-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node -e \'require("child_process")["spawnSync"]("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('node --input-type=module -e \'import { spawnSync as s } from "node:child_process"; s("rm", ["--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
  });
});
