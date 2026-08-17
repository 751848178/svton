import { containsReleaseBuildArtifactSecretText } from "./release-build-artifact-secret.utils";

describe("release build artifact secret detection", () => {
  it("permits compiled runtime syntax and dependency package names", () => {
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/app.js",
        'let accessToken = resolveToken(); const header = `Bearer ${accessToken}`;',
      ),
    ).toBe(false);
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/package.json",
        JSON.stringify({ dependencies: { jsonwebtoken: "9.0.2" } }),
      ),
    ).toBe(false);
  });

  it("rejects strong credentials in executable output", () => {
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/app.js",
        "Authorization: Bearer ghp_12345678901234567890",
      ),
    ).toBe(true);
  });

  it("distinguishes private-key parser markers from a complete private key", () => {
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/runtime.node",
        "\0-----BEGIN PRIVATE KEY-----\0-----END PRIVATE KEY-----",
      ),
    ).toBe(false);
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/runtime.pem",
        [
          "-----BEGIN PRIVATE KEY-----",
          "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=",
          "-----END PRIVATE KEY-----",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("rejects literal secrets in structured and shell configuration", () => {
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/config.json",
        JSON.stringify({ accessToken: "sentinel-credential" }),
      ),
    ).toBe(true);
    expect(
      containsReleaseBuildArtifactSecretText(
        "dist/runtime.sh",
        "JWT_SECRET=sentinel-jwt node server.js",
      ),
    ).toBe(true);
  });
});
