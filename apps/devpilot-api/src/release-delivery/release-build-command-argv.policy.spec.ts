import { parseControlledBuildArgv } from "./release-build-command-argv.policy";

describe("parseControlledBuildArgv", () => {
  it("parses quoted arguments without invoking a shell", () => {
    expect(parseControlledBuildArgv('node -e "console.log(1)"')).toEqual({
      executable: "node",
      args: ["-e", "console.log(1)"],
    });
  });

  it.each([
    "node build.js && rm -rf dist",
    "node $(echo build.js)",
    "sh build.sh",
  ])("rejects shell syntax or a non-allowlisted executable: %s", (command) => {
    expect(() => parseControlledBuildArgv(command)).toThrow();
  });
});
