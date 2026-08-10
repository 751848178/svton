import { formatReleaseRuntimeEnvironment } from "./release-runtime-environment.utils";

describe("formatReleaseRuntimeEnvironment", () => {
  it("is deterministic, dotenv-compatible, and safe to source as POSIX shell", () => {
    expect(
      formatReleaseRuntimeEnvironment({
        Z_VALUE: "plain",
        A_VALUE: "space $HOME ' quote",
      }),
    ).toBe(`A_VALUE='space $HOME '"'"' quote'\nZ_VALUE=plain`);
  });

  it("rejects keys that cannot be safely sourced", () => {
    expect(() =>
      formatReleaseRuntimeEnvironment({ "BAD-KEY": "value" }),
    ).toThrow(/变量键无效/);
  });
});
