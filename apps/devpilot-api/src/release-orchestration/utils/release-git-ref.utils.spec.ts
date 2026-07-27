/**
 * resolveGitRef 单元测试（invest-3 §B.2）：通过注入 execFile 替身覆盖
 * 成功 / 超时 / 非零退出 / 输出畸形 四种路径。
 *
 * resolveGitRef 的契约：永不抛错，失败一律返回 null（调用方据此
 * 抛 RELEASE_GIT_UNRESOLVABLE）。
 */
import { resolveGitRef } from "./release-git-ref.utils";

describe("resolveGitRef (git ls-remote parser)", () => {
  it("parses first SHA from ls-remote stdout", async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout:
        "abc123def456789012345678901234567890abcd\trefs/heads/main\n" +
        "deadbeef\trefs/heads/main^{}\n",
      stderr: "",
    });
    const r = await resolveGitRef(
      "git@example.com:repo.git",
      "main",
      execFile as never,
    );
    expect(r).toEqual({ commitSha: "abc123def456789012345678901234567890abcd" });
    expect(execFile).toHaveBeenCalledWith(
      "git",
      ["ls-remote", "git@example.com:repo.git", "main"],
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("returns null on non-zero exit / unreachable repo", async () => {
    const execFile = jest.fn().mockRejectedValue(new Error("Repository not found"));
    expect(
      await resolveGitRef("git@example.com:nope.git", "main", execFile as never),
    ).toBeNull();
  });

  it("returns null on empty / malformed output", async () => {
    expect(
      await resolveGitRef(
        "repo",
        "main",
        jest.fn().mockResolvedValue({ stdout: "", stderr: "" }) as never,
      ),
    ).toBeNull();
    expect(
      await resolveGitRef(
        "repo",
        "main",
        jest.fn().mockResolvedValue({ stdout: "\n\n  \n", stderr: "" }) as never,
      ),
    ).toBeNull();
    // 首 token 非 SHA
    expect(
      await resolveGitRef(
        "repo",
        "main",
        jest
          .fn()
          .mockResolvedValue({ stdout: "not-a-sha\trefs/heads/main\n", stderr: "" }) as never,
      ),
    ).toBeNull();
  });

  it("returns null on timeout (execFile rejects with killed err)", async () => {
    const execFile = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("Timed out"), { killed: true }));
    expect(await resolveGitRef("repo", "main", execFile as never)).toBeNull();
  });

  it("returns null when repo or branch missing", async () => {
    const execFile = jest.fn();
    expect(await resolveGitRef("", "main", execFile as never)).toBeNull();
    expect(await resolveGitRef("repo", "", execFile as never)).toBeNull();
    expect(execFile).not.toHaveBeenCalled();
  });
});
