import { resolveDeploymentConfig } from "./deployment-config-resolution.utils";

describe("resolveDeploymentConfig", () => {
  it("prefers explicit overrides, then service lifecycle configuration", () => {
    const result = resolveDeploymentConfig(
      {
        deployment: {
          workingDirectory: "/srv/project",
          migrationCommand: "legacy migrate",
        },
        stackProfile: { buildCommand: "pnpm build" },
      },
      {
        preStartCheckCommand: "docker compose config --quiet",
        migrationCommand: "prisma migrate deploy",
        initializationCommand: "node dist/bootstrap.js",
        deployCommand: "docker compose up -d",
      },
      {
        migrationCommand: "prisma migrate deploy --schema prisma/schema.prisma",
      },
    );

    expect(result).toMatchObject({
      workingDirectory: "/srv/project",
      buildCommand: "pnpm build",
      preStartCheckCommand: "docker compose config --quiet",
      migrationCommand: "prisma migrate deploy --schema prisma/schema.prisma",
      initializationCommand: "node dist/bootstrap.js",
      deployCommand: "docker compose up -d",
    });
  });
});
