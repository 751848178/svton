import { assertSafeArtifactPath } from "./release-build-artifact-policy";

describe("release build artifact reserved paths", () => {
  it.each([".devpilot", ".devpilot/runtime.env", "dist/.devpilot/state"])(
    "rejects reserved target-control path %s",
    (path) => {
      expect(() => assertSafeArtifactPath(path, !path.includes("."))).toThrow(
        expect.objectContaining({
          detail: expect.objectContaining({ code: "ARTIFACT_UNSAFE_ENTRY" }),
        }),
      );
    },
  );
});
