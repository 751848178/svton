import { assertControlledBuildCommand } from "./release-build-command-policy";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";

describe("release build command policy", () => {
  it("appends terminal failure evidence after command output", () => {
    expect.assertions(3);
    try {
      assertControlledBuildCommand(
        "api",
        { kind: "completed", exitCode: 2, stdout: "", stderr: "" },
        ["[api] $ pnpm build", "stderr evidence"],
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ReleaseBuildExecutionError);
      const detail = (error as ReleaseBuildExecutionError).detail;
      expect(detail.logs).toEqual([
        "[api] $ pnpm build",
        "stderr evidence",
        "result failed: BUILD_COMMAND_FAILED api 构建失败（exit 2）",
      ]);
      expect(detail.status).toBe("failed");
    }
  });
});
