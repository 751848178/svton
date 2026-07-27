/**
 * Git ref 解析（F383 Slice 8a）：给定 gitRepo + branch，返回最新 commit SHA。
 *
 * 实现：`git ls-remote <repo> <branch>`，10s 超时；解析首行首个 token 为 SHA。
 * 任何错误（超时/非零退出/仓库不可达/输出畸形）都返回 null——
 * 调用方据此阻断 create/preview（RELEASE_GIT_UNRESOLVABLE）。
 *
 * 不抛错：null === "block create"。
 *
 * 未找到既有 git-ref fetcher（apps/devpilot-api/src 内仅有 spawnSync/execSync 的
 * openssl/ssh-live 用例），故直接用 child_process.execFile。
 *
 * execFile 通过可注入参数暴露，便于单元测试覆盖
 * （成功/超时/非零退出/畸形输出）而无需 node 内建模块 mock。
 */
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFileCb);
const GIT_LS_REMOTE_TIMEOUT_MS = 10_000;

// 可注入的 execFile 类型（测试替换；生产路径用 promisify(node:child_process)）。
export type GitExecFile = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

export async function resolveGitRef(
  gitRepo: string,
  branch: string,
  execFile: GitExecFile = execFileP,
): Promise<{ commitSha: string } | null> {
  if (!gitRepo || !branch) return null;
  try {
    const { stdout } = await execFile(
      "git",
      ["ls-remote", gitRepo, branch],
      { timeout: GIT_LS_REMOTE_TIMEOUT_MS, maxBuffer: 1 * 1024 * 1024 },
    );
    // 输出格式：<sha>\t<ref>\n 多行；取第一个非空行首 token。
    const firstLine = stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
    if (!firstLine) return null;
    const sha = firstLine.split(/\s+/)[0]?.trim();
    if (!sha || !/^[0-9a-fA-F]{7,64}$/.test(sha)) return null;
    return { commitSha: sha };
  } catch {
    return null;
  }
}
