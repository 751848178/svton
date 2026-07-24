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
    await expect(manager.review(bashContext(String.raw`python3 -c 'import subprocess; subprocess.run(["r${String.fromCharCode(92, 10)}m", "-r${String.fromCharCode(92, 10)}f", "/"])'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`python3 -c 'import subprocess; subprocess.run(["""r${String.fromCharCode(92, 10)}m""", """-r${String.fromCharCode(92, 10)}f""", """/"""])'`)))
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
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv: list[str] = ["rm", "-rf", "/"]; subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv: tuple[str, str, str] = ("rm", "-rf", "/"); subprocess.Popen(argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["rm", "-rf", "/"]; subprocess.run(args=argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv: list[str] = ["rm", "-rf", "/"]; subprocess.run(args=argv)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["not-rm", "-rf", "/"]; subprocess.run(argv, executable="rm")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "-rf", "/"], executable=("rm"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; subprocess.run(["not-rm", "-rf", "/"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; subprocess.run(["not-rm", "-rf", "/"], executable=(exe))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe: str = "rm"; subprocess.run(["not-rm", "-rf", "/"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; argv=["not-rm", "-rf", "/"]; subprocess.run(args=argv, executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; argv=["not-rm", "-rf", "/"]; subprocess.Popen(args=argv, executable=(exe))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="-rf"; subprocess.run(["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag: str = "-rf"; subprocess.run(["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; target="/"; subprocess.run(["rm", "-rf", target])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", ("-rf"), ("/")])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="-rf"; subprocess.call(["rm", (flag), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; p=subprocess.Popen(("rm", ("-rf"), ("/"))); p.wait()\'')))
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
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["r" + "m", "-r" + "f", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="r" + "m"; flag="-r" + "f"; subprocess.run([cmd, flag, "/"])\'')))
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
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "-rf", "/"], executable="r" + "m")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.Popen(args=("not-rm", "-rf", "/"), executable="/bin/rm")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(check=True, executable="rm", args=("not-rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -cimport\\ subprocess\\;\\ subprocess.run\\([\\"not-rm\\",\\ \\"-rf\\",\\ \\"/\\"\\],\\ executable=\\"rm\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", ("rm"), ("-rf"), ("/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.execlp("rm", ("rm"), ("-rf"), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnvp(os.P_WAIT, "rm", ["rm", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; exe="rm"; os.spawnlp(os.P_WAIT, exe, "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; exe="rm"; os.spawnlp(os.P_WAIT, (exe), ("rm"), "-rf", "/")\'')))
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
    await expect(manager.review(bashContext('python3 -c \'import os; os.posix_spawn("/bin/rm", ["rm", "-rf", "/"], os.environ)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.posix_spawnp("rm", ["rm", "-rf", "/"], os.environ)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.posix_spawnp("r" + "m", ["r" + "m", "-r" + "f", "/"], os.environ)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; os.spawnvp(os.P_WAIT, "rm", ["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; os.spawnlp(os.P_WAIT, "rm", "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; os.spawnlp(os.P_WAIT, "rm", ("rm"), (flag), "/")\'')))
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
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "r" + "m", "r" + "m", "-r" + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'import os as o; o.execlp("rm", "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from os import execlp as ex; flag="-rf"; ex("rm", "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('python3 -c \'from os import execvp as ev; ev("rm", ("rm", "-rf", "/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(%q{rm}, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(%Q{rm}, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(*%w[rm -rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(*%W[rm -rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(*%w[rm -rf], "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("rm", *%w[-rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system({"SVTON_A912"=>"system"}, "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("r" + "m", "-r" + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "-rf"; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r" + "m"; flag = "-r" + "f"; exec((cmd), (flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r".concat("m"); flag = "-r".concat("f"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("r".concat("m"), "-r".concat("f"), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r".concat("m"); flag = "-".concat("r", "f"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("r".concat("m"), "-".concat("r", "f"), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m"); flag = "-"; flag.concat("r", "f"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m"); flag = "-"; flag.concat("r"); flag << "f"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "m"; cmd.prepend("r"); flag = "f"; flag.prepend("-r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "m"; cmd.prepend("r"); flag = "f"; flag.prepend("-", "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("m".prepend("r"), "f".prepend("-r"), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("m".prepend("r"), "f".prepend("-", "r"), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo"; cmd.replace("rm"); flag = "--version"; flag.replace("-rf"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo"; cmd.replace("r"); cmd.concat("m"); flag = "--version"; flag.replace("-"); flag.concat("r", "f"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("echo".replace("rm"), "--version".replace("-rf"), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; flag = "-r"; flag << "f"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; system(cmd, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; flag = "-"; flag << "r" << "f"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; flag = "-"; flag << "f".prepend("r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; flag = "-"; flag << ("f".prepend("r")); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(1, "m"); flag = "-f"; flag.insert(1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert("x".length, "m"); flag = "-f"; flag.insert("x".bytesize, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\x78".length, "m"); flag = "-f"; flag.insert("\x78".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\x7".length, "m"); flag = "-f"; flag.insert("\x7".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\cA".length, "m"); flag = "-f"; flag.insert("\cA".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\C-A".length, "m"); flag = "-f"; flag.insert("\C-A".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\c?".length, "m"); flag = "-f"; flag.insert("\C-?".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\n".length, "m"); flag = "-f"; flag.insert("\n".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\t".length, "m"); flag = "-f"; flag.insert("\t".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\r".length, "m"); flag = "-f"; flag.insert("\r".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\f".length, "m"); flag = "-f"; flag.insert("\f".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\v".length, "m"); flag = "-f"; flag.insert("\v".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\a".length, "m"); flag = "-f"; flag.insert("\a".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\e".length, "m"); flag = "-f"; flag.insert("\e".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\s".length, "m"); flag = "-f"; flag.insert("\s".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\b".length, "m"); flag = "-f"; flag.insert("\b".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\\".length, "m"); flag = "-f"; flag.insert("\\".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\"".length, "m"); flag = "-f"; flag.insert("\"".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\170".length, "m"); flag = "-f"; flag.insert("\170".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u0078".length, "m"); flag = "-f"; flag.insert("\u0078".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78}".length, "m"); flag = "-f"; flag.insert("\u{78}".bytesize(), "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78 78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78 78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78  78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78  78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{ 78 78 }".length - 1, "m"); flag = "-f"; flag.insert("\u{ 78 78 }".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78${'\t'}78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78${'\t'}78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78${'\n'}78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78${'\n'}78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78${'\r'}78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78${'\r'}78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78${'\f'}78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78${'\f'}78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\u{78${'\v'}78}".length - 1, "m"); flag = "-f"; flag.insert("\u{78${'\v'}78}".bytesize() - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\M-a\M-a".length - 1, "m"); flag = "-f"; flag.insert("\M-a\M-a".length - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\M-a\M-a".bytesize - 1, "m"); flag = "-f"; flag.insert("\M-a\M-a".bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\M-\C-A\M-\C-A".length - 1, "m"); flag = "-f"; flag.insert("\M-\C-A\M-\C-A".bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("\C-\M-A\C-\M-A".length - 1, "m"); flag = "-f"; flag.insert("\C-\M-A\C-\M-A".bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("x${String.fromCharCode(92, 10)}x".length - 1, "m"); flag = "-f"; flag.insert("x${String.fromCharCode(92, 10)}x".bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert("x${String.fromCharCode(92, 13, 10)}x".length - 1, "m"); flag = "-f"; flag.insert("x${String.fromCharCode(92, 13, 10)}x".bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert(%Q[x${String.fromCharCode(92, 10)}x].length - 1, "m"); flag = "-f"; flag.insert(%Q[x${String.fromCharCode(92, 10)}x].bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "r"; cmd.insert(%Q[x${String.fromCharCode(92, 13, 10)}x].length - 1, "m"); flag = "-f"; flag.insert(%Q[x${String.fromCharCode(92, 13, 10)}x].bytesize - 1, "r"); exec(cmd, flag, "/")'`)))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert("x".length(), "m"); flag = "-f"; flag.insert("x".bytesize(), "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(("x").length, "m"); flag = "-f"; flag.insert(("x").bytesize(), "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(%q(x).length, "m"); flag = "-f"; flag.insert(%q{x}.bytesize, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(+1, "m"); flag = "-f"; flag.insert(+1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(+ 1, "m"); flag = "-f"; flag.insert(+ 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(++1, "m"); flag = "-f"; flag.insert(- -1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(+0_1, "m"); flag = "-f"; flag.insert(0_1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(+0o1, "m"); flag = "-f"; flag.insert(0b1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(+0d1, "m"); flag = "-f"; flag.insert(0D1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert((+1), "m"); flag = "-f"; flag.insert((+1), "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(((+1)), "m"); flag = "-f"; flag.insert(((+1)), "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(0 + 1, "m"); flag = "-f"; flag.insert(2 - 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(0 + 1 + 0, "m"); flag = "-f"; flag.insert(3 - 1 - 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(+(0 + 1), "m"); flag = "-f"; flag.insert(+(2 - 1), "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(1 * 1, "m"); flag = "-f"; flag.insert(1 * 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(2 / 2, "m"); flag = "-f"; flag.insert(2 / 2, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(5 % 2, "m"); flag = "-f"; flag.insert(4 % 3, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(2 ** 0, "m"); flag = "-f"; flag.insert(3 ** 0, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "m"; cmd.insert(-2 ** 2 + 2, "r"); flag = "-f"; flag.insert(-2 ** 2 + 2, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(1 << 0, "m"); flag = "-f"; flag.insert(4 >> 2, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(2 << -1, "m"); flag = "-f"; flag.insert(2 << -1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(3 & 1, "m"); flag = "-f"; flag.insert(5 & 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(3 ^ 2, "m"); flag = "-f"; flag.insert(5 ^ 4, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(1 | 0, "m"); flag = "-f"; flag.insert(1 | 0, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~(-2), "m"); flag = "-f"; flag.insert(~(-2), "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~-2, "m"); flag = "-f"; flag.insert(~-2, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~-2 ** 1, "m"); flag = "-f"; flag.insert(~-2 ** 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~+0 ** 1, "m"); flag = "-f"; flag.insert(~+1 ** 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~++0 ** 1, "m"); flag = "-f"; flag.insert(~++1 ** 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~+-2 ** 1, "m"); flag = "-f"; flag.insert(~+-2 ** 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~--0 ** 1, "m"); flag = "-f"; flag.insert(~--1 ** 1, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(-1, "m"); flag = "-f"; flag.insert(-2, "r"); exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd << "m"; system(cmd, "-" << "rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "rm", "-rf"; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "r" + "m", "-r" + "f"; exec((cmd), (flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["rm", "-rf"]; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["r" + "m", "-r" + "f"]; exec((cmd), (flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = %w[rm -rf]; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = %W[rm -rf]; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo"; flag = "--version"; cmd, flag = %w[rm -rf]; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'argv = ["rm", "-rf"]; cmd, flag = argv; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'argv = %w[rm -rf]; cmd, flag = argv; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'argv = ["r" + "m", "-r" + "f"]; cmd, flag = argv; exec((cmd), (flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'argv = ["echo", "--version"]; argv = ["rm", "-rf"]; cmd, flag = argv; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -esystem\\(\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", %q{custom-rm}], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system([%q{rm}, "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["r" + "m", "custom-rm"], "-r" + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; pid = spawn([cmd, "custom-rm"], "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r" + "m"; pid = Process.spawn([(cmd), "custom-rm"], "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "rm", "-rf"; pid = Process.spawn([cmd, "custom-rm"], flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["rm", "-rf"]; pid = Process.spawn([cmd, "custom-rm"], flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = %w[rm -rf]; pid = Process.spawn([cmd, "custom-rm"], flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'argv = ["rm", "-rf"]; cmd, flag = argv; pid = Process.spawn([cmd, "custom-rm"], flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm",], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system((["rm", "custom-rm"]), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(%w[rm custom-rm], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm"], *%w[-rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'flag="-rf"; system(["rm", "custom-rm"], (flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system([*%w[rm custom-rm]], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system([*%w[rm], "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'exec(["rm", "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["/bin/rm", "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -esystem\\(\\[\\"rm\\",\\ \\"rm\\"\\],\\ \\"-rf\\",\\ \\"/\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(["rm", "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(["rm", "custom-rm"], "-rf", *%w[/])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn([*%w[rm custom-rm]], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(["rm", *%w[custom-rm]], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn([*%w[rm], "custom-rm",], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(([*%w[rm], "custom-rm"]), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(%w[rm custom-rm], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(["rm", %Q{custom-rm}], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn(["rm", "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn(["rm", "custom-rm"], *%W[-rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn([*%W[rm custom-rm]], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn([*%W[rm], %q{custom-rm}], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn([*%W[rm custom-rm],], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn(([*%W[rm custom-rm]]), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn(%W[rm custom-rm], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pair=["rm", "custom-rm"]; system(pair, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; pair = [cmd, "custom-rm"]; pid = spawn(pair, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pair=%w[rm custom-rm]; pid=spawn(pair, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pair=[*%w[rm], "custom-rm"]; pid=Process.spawn(pair, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=["rm", "custom-rm"]; system(PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; PAIR = [cmd, "custom-rm"]; pid = spawn(PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=%w[rm custom-rm]; pid=spawn(PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'COMMAND_PAIR=[*%w[rm], "custom-rm"]; pid=Process.spawn(COMMAND_PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'@pair=["rm", "custom-rm"]; system(@pair, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'@@pair=%w[rm custom-rm]; pid=spawn(@@pair, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'$pair=[*%w[rm], "custom-rm"]; pid=Process.spawn($pair, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; M::PAIR=["rm", "custom-rm"]; system(M::PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; M::PAIR=%w[rm custom-rm]; pid=spawn(M::PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Outer=Module.new; Outer::Inner=Module.new; Outer::Inner::PAIR=[*%w[rm], "custom-rm"]; pid=Process.spawn(Outer::Inner::PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=["rm", "custom-rm"]; system(::PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; M::PAIR=%w[rm custom-rm]; pid=spawn(::M::PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Outer=Module.new; Outer::Inner=Module.new; Outer::Inner::PAIR=[*%w[rm], "custom-rm"]; pid=Process.spawn(::Outer::Inner::PAIR, "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pair=["rm", "custom-rm"]; system((pair), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; M::PAIR=%w[rm custom-rm]; pid=spawn((M::PAIR), "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=[*%w[rm], "custom-rm"]; pid=Process.spawn((::PAIR), "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm"], ("-rf"), ("/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pid=spawn(%w[rm custom-rm], ("-rf"), ("/")); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pid=Process.spawn([*%w[rm], "custom-rm"], ("-rf"), "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn(["rm", "custom-" + "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn(["r" + "m", "custom-rm"], "-r" + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn({"SVTON_A912"=>"pair"}, ["r" + "m", "custom-rm"], "-r" + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "-rf"; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "rm", "-rf"; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["rm", "-rf"]; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = %w[rm -rf]; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'argv = %w[rm -rf]; cmd, flag = argv; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'flag="-rf"; pid=spawn("rm", (flag), "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn(*%w[rm -rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn("rm", *%w[-rf /])\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'spawn({"SVTON_A912"=>"spawn"}, "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "-rf"; pid = spawn({"SVTON_A992"=>"ok"}, cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r" + "m"; flag = "-r" + "f"; pid = Process.spawn((cmd), (flag), "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn("r" + "m", "-r" + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pid=spawn("rm", ("-rf"), ("/")); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'pid=Process.spawn("r" + "m", ("-r" + "f"), "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system(%q{rm}, (%q{-rf}), ("/"))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'Process.spawn("/bin/rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('ruby -e \'system("sh", "-c", "rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec("rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system(q{rm}, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system(qw{rm -rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system(qw{rm -rf}, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system("rm", qw{-rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system("r" . "m", "-r" . "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm"; my $flag = "-rf"; system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "r" . "m"; my $flag = "-r" . "f"; exec(($cmd), ($flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'our $cmd = "rm"; our $flag = "-rf"; system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'local $cmd = "r" . "m"; local $flag = "-r" . "f"; exec(($cmd), ($flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'use feature "state"; state $cmd = "rm"; state $flag = "-rf"; exec($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'use feature "state"; state $cmd = "rm"; state $flag = "-rf"; system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd) = "rm"; my ($flag) = "-rf"; system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd) = "r" . "m"; my ($flag) = "-r" . "f"; exec(($cmd), ($flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ("rm", "-rf"); system($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ("r" . "m", "-r" . "f"); exec(($cmd), ($flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = qw[rm -rf]; exec($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = qw[rm -rf]; system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = (qw[rm -rf]); exec($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = (qw[rm -rf]); system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = (((qw[rm -rf]))); exec($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ((qw[rm -rf])); system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, undef, $flag) = qw[rm ignored -rf]; exec($cmd, $flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, undef, $flag) = ((qw[rm ignored -rf])); system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = "rm", "safe"; system($cmd, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = "r" . "m", "safe"; exec(($cmd), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -eexec\\(\\"rm\\",\\ \\"-rf\\",\\ \\"/\\"\\)')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "custom-rm", qw{-rf /}\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "custom-rm", "-rf", qw{/}\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { q{rm} } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { qw{rm} } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { qw{rm} } "custom-rm", qw{-rf /}\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { (qw{rm}) } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { (("rm")) } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { (("r" . "m")) } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec { ((qw{rm})) } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec {"rm"} "rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec { qw{rm} } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec {"rm"} "custom-rm", qw{-rf /}\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec(qw{rm -rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec("rm", qw{-rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system((qw{rm -rf /}))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec((qw{rm -rf /}))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system("rm", (qw{-rf /}))\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"r" . "m"} "custom-rm", "-r" . "f", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'exec {("r" . "m")} "custom-rm", "-r" . "f", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "custom-rm", ("-rf"), ("/")\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"r" . "m"} "custom-rm", ("-r" . "f"), "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system { qw{rm} } "custom-rm", (qw{-rf /})\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'system {"/bin/rm"} "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm"; system {$cmd} "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "r" . "m"; exec {($cmd)} "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'$cmd="rm"; system { (($cmd)) } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $flag = "-rf"; system {"rm"} "custom-rm", ($flag), "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm"; my $flag = "-r" . "f"; system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'our $cmd = "rm"; local $flag = "-rf"; system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd) = "rm"; my ($flag) = "-rf"; system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ("rm", "-rf"); system {$cmd} "custom-rm", $flag, "/"\'')))
      .resolves.toMatchObject({ verdict: 'deny', ruleId: 'bash-rm-rf-root' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = "rm", "safe"; system {$cmd} "custom-rm", "-rf", "/"\'')))
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
    await expect(manager.review(bashContext(String.raw`python3 -c 'import subprocess; subprocess.run([r"""r${String.fromCharCode(92, 10)}m""", r"""-r${String.fromCharCode(92, 10)}f""", r"""/"""])'`)))
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
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv: list[str] = ["rm", "--version"]; subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`python3 -c "import subprocess; argv=[\"rm\", \"--version\"]; subprocess.run(argv)"`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; subprocess.run(["not-rm", "--version"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "--version"], executable=("rm"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "-rf", "/"], executable=exe); exe="rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; exe=get_exe(); subprocess.run(["not-rm", "-rf", "/"], executable=exe)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; exe="rm"; exe=get_exe(); subprocess.run(["not-rm", "-rf", "/"], executable=(exe))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["not-rm", "-rf", "/"], executable=("rm").upper())\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="--version"; subprocess.run(["rm", flag])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag: str = "--version"; subprocess.run(["rm", flag])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", ("--version")])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run([b"rm", b"--version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="rm"; subprocess.run([f"{cmd}", f"-rf", f"/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["r" "m", "--" "version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["r" + "m", "--" + "version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["sh", "-c", "rm --version"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run("rm -rf /")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; cmd="r"; subprocess.run([f"{cmd}" "m", "-rf", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", flag, "/"]); flag="-rf"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", flag + "f", "/"]); flag="-r"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag="-rf"; flag=get_flag(); subprocess.run(["rm", flag, "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; flag=get_flag(); subprocess.run(["rm", flag + "f", "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(argv); argv=["rm", "-rf", "/"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; argv=["rm", "-rf", "/"]; argv=get_argv(); subprocess.run(argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess\\ndef get_flag(): return "-rf"\\nflag="-rf"; flag=get_flag(); subprocess.run(["rm", (flag), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import subprocess; subprocess.run(["rm", ("-rf").upper(), "/"])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", "rm", "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", ("rm"), ("--version"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="--version"; os.spawnlp(os.P_WAIT, "rm", "rm", flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "not-rm", "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=["rm", "--version"]; os.spawnvp(os.P_WAIT, "rm", argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.posix_spawnp("rm", ["rm", "--version"], os.environ)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=get_argv(); os.posix_spawnp("rm", argv, os.environ)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.execlp("rm", "rm", flag, "/"); flag="-rf"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.execvp("rm", argv); argv=["rm", "-rf", "/"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; flag=get_flag(); os.spawnlp(os.P_WAIT, "rm", "rm", flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; flag="-rf"; flag=get_flag(); os.spawnlp(os.P_WAIT, "rm", ("rm"), (flag), "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; os.spawnlp(os.P_WAIT, "rm", ("rm"), ("-rf").upper(), "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('python3 -c \'import os; argv=["rm", "-rf", "/"]; argv=get_argv(); os.spawnvp(os.P_WAIT, "rm", argv)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "rm"], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", %q{custom-rm}], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm"], *%w[--version /])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm",], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system((["rm", "custom-rm"]), "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(%w[rm custom-rm], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pair=["rm", "custom-rm"]; system(pair, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=["rm", "custom-rm"]; system(PAIR, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'@pair=["rm", "custom-rm"]; system(@pair, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; M::PAIR=["rm", "custom-rm"]; system(M::PAIR, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=["rm", "custom-rm"]; system(::PAIR, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pair=["rm", "custom-rm"]; system((pair), "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm"], ("--version"))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system([*%w[rm custom-rm]], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system([*%w[rm], "custom-rm"], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'flag="-rf"; system(["rm", "custom-rm"], *%W[#{flag} /])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system([*%W[#{cmd} custom-rm]], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system([*%W[#{cmd}], "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system([*%W[#{cmd}], "custom-rm",], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system(([*%W[#{cmd}], "custom-rm"]), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system(%W[#{cmd} custom-rm], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; pair=%W[#{cmd} custom-rm]; system(pair, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pair=["rm", "custom-rm"]; pair=get_pair(); system(pair, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(pair, "-rf", "/"); pair=["rm", "custom-rm"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; PAIR=%W[#{cmd} custom-rm]; system(PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=["rm", "custom-rm"]; PAIR=get_pair(); system(PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(PAIR, "-rf", "/"); PAIR=["rm", "custom-rm"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; @pair=%W[#{cmd} custom-rm]; system(@pair, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'@pair=["rm", "custom-rm"]; @pair=get_pair(); system(@pair, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(@pair, "-rf", "/"); @pair=["rm", "custom-rm"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; M=Module.new; M::PAIR=%W[#{cmd} custom-rm]; system(M::PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; M::PAIR=["rm", "custom-rm"]; M::PAIR=get_pair(); system(M::PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'M=Module.new; system(M::PAIR, "-rf", "/"); M::PAIR=["rm", "custom-rm"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; PAIR=%W[#{cmd} custom-rm]; system(::PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'PAIR=["rm", "custom-rm"]; PAIR=get_pair(); system(::PAIR, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(::PAIR, "-rf", "/"); PAIR=["rm", "custom-rm"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; pair=%W[#{cmd} custom-rm]; system((pair), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pair=["rm", "custom-rm"]; pair=get_pair(); system((pair), "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system((pair), "-rf", "/"); pair=["rm", "custom-rm"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["rm", "custom-rm"], ("-rf").upcase, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(["not-rm", "rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'spawn(["rm", "custom-rm"], "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; pid = spawn([cmd, "custom-rm"], "--version"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "echo"; cmd = get_cmd; pid = spawn([cmd, "custom-rm"], "-rf", "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid = spawn([cmd, "custom-rm"], "-rf", "/"); Process.wait(pid); cmd = "rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'spawn({"SVTON_A912"=>"safe"}, "rm", "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd=get_cmd(); Process.spawn([cmd, "custom-rm"], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'argv0=get_argv0(); system(["rm", argv0], "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'env=get_env(); spawn(env, "rm", "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'spawn("rm", "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid=spawn("rm", ("--version")); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--"; flag.concat("version"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.concat("m"); flag = "--"; flag.concat("ver"); flag << "sion"; pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "version"; flag.prepend("--"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "version"; flag.prepend("-", "-"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--"; flag << "sion".prepend("ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(+2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(+ 2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(--2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0_2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0x2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0d2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert((2), "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\t\t".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\r\r".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\f\f".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\v\v".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\a\a".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\e\e".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\s\s".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext(String.raw`ruby -e 'cmd = "rm"; flag = "--sion"; flag.insert("\b\b".bytesize(), "ver"); pid = spawn(cmd, flag); Process.wait(pid)'`)))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(((2)), "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(-5, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0 + 1 + 1, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(+(1 + 1), "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(6 & 2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(6 ^ 4, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(0 | 2, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~(-3), "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~-3, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~-2 ** 2 - 1, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; flag.insert(~+2 ** 2, ""); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; flag.insert(~++2 ** 2, ""); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~+-2 ** 2 - 1, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--sion"; flag.insert(~--2 ** 2 + 7, "ver"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(6 & 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(6 ^ 4, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(0 | 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(~(-3), middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -rf"; cmd = "rm /"; cmd.insert(~-3, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = "-"; cmd = "rm rf /"; cmd.insert(~-2 ** 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " /"; cmd = "rm -rf Xx"; cmd.insert(~+2 ** 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " /"; cmd = "rm -rf Xx"; cmd.insert(~++2 ** 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = "-"; cmd = "rm rf /"; cmd.insert(~+-2 ** 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'middle = " -"; cmd = "rmrf /"; cmd.insert(~--2 ** 2, middle); exec(cmd)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'mask = 1; cmd = "r"; cmd.insert(3 & mask, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'mask = 2; cmd = "r"; cmd.insert(3 ^ mask, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'mask = 0; cmd = "r"; cmd.insert(1 | mask, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'index = -2; cmd = "r"; cmd.insert(~index, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'index = 2; cmd = "r"; cmd.insert(~-index, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 1; cmd = "r"; cmd.insert(~-2 ** power, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~--2 ** 1, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 1; cmd = "r"; cmd.insert(~+0 ** power, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 1; cmd = "r"; cmd.insert(~++0 ** power, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 1; cmd = "r"; cmd.insert(~+-2 ** power, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(~--2 ** 1, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'power = 1; cmd = "r"; cmd.insert(~--0 ** power, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r"; cmd.insert(1 && 1, "m"); flag = "-rf"; exec(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "-rf"; flag.replace("--version"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "-rf"; flag.replace("--"); flag.concat("version"); pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "rm", "--version"; pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["rm", "--version"]; pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = %w[rm --version]; pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'argv = %w[rm --version]; cmd, flag = argv; pid = spawn(cmd, flag); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; flag = get_flag; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = "echo", "--version"; cmd, flag = get_pair; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = ["echo", "--version"]; cmd, flag = get_pair; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = %w[echo --version]; cmd, flag = get_pair; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'argv = %w[echo --version]; argv = get_pair; cmd, flag = argv; pid = spawn(cmd, flag, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid = spawn(cmd, "-rf", "/"); Process.wait(pid); cmd = "rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid = spawn(cmd, "-rf", "/"); Process.wait(pid); cmd, flag = "rm", "-rf"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid = spawn(cmd, "-rf", "/"); Process.wait(pid); cmd, flag = ["rm", "-rf"]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid = spawn(cmd, "-rf", "/"); Process.wait(pid); cmd, flag = %w[rm -rf]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd, flag = argv; pid = spawn(cmd, flag, "/"); Process.wait(pid); argv = %w[rm -rf]\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'name = "rm"; flag = "-rf"; cmd, arg = %W[#{name} #{flag}]; system(cmd, arg, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'name = "rm"; flag = "-rf"; argv = %W[#{name} #{flag}]; cmd, arg = argv; system(cmd, arg, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system("r" + "m", "--" + "version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r".concat("m"); flag = "--".concat("version"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "r".concat("m"); flag = "--".concat("ver", "sion"); system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--ver"; flag << "sion"; system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; system(cmd, flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'tail=get_tail(); system("rm", tail + "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd = "rm"; flag = "--version"; flag = get_flag; system(cmd, flag, "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(cmd, "-rf", "/"); cmd = "rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'pid=spawn("rm", ("-rf").upcase, "/"); Process.wait(pid)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system(%Q{#{cmd}}, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'cmd="rm"; system(*%W[#{cmd} -rf /])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'flag="-rf"; system("rm", *%W[#{flag} /])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(*%w[rm --version])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system("rm", *%w[--version /])\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('ruby -e \'system(%Q{rm}, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "rm", "--version"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system { (("rm")) } "custom-rm", "--version"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system("r" . "m", "--" . "version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'$tail=get_tail(); system("rm", $tail . "f", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"not-rm"} "rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system { qw{rm} } "custom-rm", "--version"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "custom-rm", ("--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system { qw{not-rm rm} } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "custom-rm", qw{--version /}\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system { qw{not-rm rm} } "custom-rm", qw{-rf /}\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"r" . "m"} "custom-rm", "--" . "version"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm"; system {$cmd} "custom-rm", "--version"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'our $cmd = "rm"; system($cmd, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd) = "rm"; system($cmd, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $flag) = ("rm", "--version"); system($cmd, $flag)\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my ($cmd, $unused) = "rm", "safe"; system($cmd, "--version")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, $flag, "/"); my ($cmd, $flag) = ("rm", "-rf")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, "-rf", "/"); my ($cmd) = "rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system($cmd, "-rf", "/"); our $cmd = "rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "echo"; $cmd = get_cmd(); system {$cmd} "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {$cmd} "custom-rm", "-rf", "/"; my $cmd = "rm"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'$tail=get_tail(); system {"r" . $tail} "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system { (("rm") x 1) } "custom-rm", "-rf", "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system {"rm"} "custom-rm", ("-rf") x 1, "/"\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'my $cmd = "rm"; system(qq{$cmd}, "-rf", "/")\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system(qw{rm --version})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system((qw{rm --version}))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system("rm", qw{--version /})\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'$args="-rf /"; system("rm", ($args))\'')))
      .resolves.toMatchObject({ verdict: 'ask_user' });
    await expect(manager.review(bashContext('perl -e \'system("rm", (qw{-rf /})[0], "/")\'')))
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
