import { UnprocessableEntityException } from "@nestjs/common";
import { buildComponents } from "./release-build-config.utils";

describe("release build artifact configuration", () => {
  it("freezes service-keyed declared outputs and sorted public build values", () => {
    expect(
      buildComponents([
        application({
          buildCommand: "npm run build",
          artifactPaths: ["./dist", "dist"],
          buildEnvironment: {
            VITE_PUBLIC_URL: "https://example.test",
            NEXT_PUBLIC_API_URL: "https://api.example.test",
          },
        }),
      ]),
    ).toEqual([
      {
        key: "service-1",
        name: "app/api",
        workingDirectory: ".",
        buildCommand: "npm run build",
        artifactOutputs: ["dist"],
        buildEnvironment: {
          NEXT_PUBLIC_API_URL: "https://api.example.test",
          VITE_PUBLIC_URL: "https://example.test",
        },
      },
    ]);
  });

  it.each([
    [{ buildCommand: "npm run build" }, "artifactPaths"],
    [
      { buildCommand: "npm run build", artifactPaths: ["../dist"] },
      "仓库内子路径",
    ],
    [
      { buildCommand: "npm run build", artifactPaths: ["/dist"] },
      "制品输出路径无效",
    ],
    [
      {
        buildCommand: "npm run build",
        artifactPaths: ["dist"],
        buildEnvironment: { DATABASE_URL: "mysql://secret" },
      },
      "不是允许烘焙的公开变量",
    ],
    [
      {
        buildCommand: "npm run build",
        artifactPaths: ["dist"],
        buildEnvironment: {
          NEXT_PUBLIC_API_URL: "ghp_12345678901234567890",
        },
      },
      "秘密字面量",
    ],
  ])("rejects an unsafe artifact contract %#", (config, message) => {
    const build = () => buildComponents([application(config)]);
    expect(build).toThrow(UnprocessableEntityException);
    expect(build).toThrow(message);
  });
});

function application(deployConfig: Record<string, unknown>) {
  return {
    id: "application-1",
    name: "app",
    repoPath: ".",
    services: [{ id: "service-1", name: "api", deployConfig }],
  };
}
