import { RepositoryParserService } from "./repository-parser.service";
import type { RepositoryInventory } from "./repository-parser.types";

describe("RepositoryParserService", () => {
  const parser = new RepositoryParserService();

  it("detects the Picshare delivery shape without treating the workspace root as a service", () => {
    const inventory = picshareInventory();
    const result = parser.parse(inventory);
    const byPath = new Map(
      result.services.map((service) => [service.path, service]),
    );

    expect(result.repository).toMatchObject({
      monorepo: true,
      packageManager: "pnpm",
      packageManagerVersion: "8.12.0",
    });
    expect(result.services.some((service) => service.name === "picshare")).toBe(
      false,
    );
    expect(byPath.get("apps/backend")).toMatchObject({
      role: "backend",
      deployable: true,
      framework: expect.arrayContaining(["NestJS", "Prisma"]),
      ports: expect.arrayContaining([3000]),
      databases: expect.arrayContaining(["mysql", "redis"]),
      container: expect.objectContaining({ buildContext: "." }),
    });
    expect(byPath.get("apps/admin")).toMatchObject({
      role: "admin",
      deployable: true,
      framework: expect.arrayContaining(["Next.js"]),
      ports: expect.arrayContaining([3001]),
      container: expect.objectContaining({ buildContext: "." }),
    });
    expect(byPath.get("apps/mobile")).toMatchObject({
      role: "mobile",
      deployable: false,
      artifactOnly: true,
    });
    expect(byPath.get("packages/types")).toMatchObject({
      role: "shared",
      deployable: false,
    });
    expect(result.composeCandidates.map((item) => item.file)).toEqual([
      "docker-compose.yml",
      "docker-compose.devpilot.yml",
    ]);
    expect(result.migrationEvidence).toMatchObject({
      applicable: true,
      databaseKinds: ["mysql", "redis"],
    });
    expect(
      byPath.get("apps/backend")?.healthChecks.map((item) => item.path),
    ).toEqual(expect.arrayContaining(["/api/health/readiness", "/api"]));
    expect(result.warnings).toContain(
      "检测到 2 份 Compose 配置，应用前必须确认部署目标。",
    );
  });
});

function picshareInventory(): RepositoryInventory {
  const manifests: Record<string, string> = {
    "package.json": JSON.stringify({
      name: "picshare",
      private: true,
      packageManager: "pnpm@8.12.0",
    }),
    "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    "apps/backend/package.json": JSON.stringify({
      name: "@picshare/backend",
      scripts: {
        build: "nest build",
        start: "node dist/main",
        "migrate:deploy": "prisma migrate deploy",
        "bootstrap:prod": "node dist/bootstrap",
        seed: "prisma db seed",
        backfill: "node scripts/backfill --dry-run",
      },
      dependencies: {
        "@nestjs/core": "^10.0.0",
        "@prisma/client": "^5.0.0",
        ioredis: "^5.0.0",
      },
    }),
    "apps/admin/package.json": JSON.stringify({
      name: "@picshare/admin",
      scripts: { build: "next build", start: "next start -p 3001" },
      dependencies: { next: "^14.0.0", react: "^18.0.0" },
    }),
    "apps/mobile/package.json": JSON.stringify({
      name: "@picshare/mobile",
      scripts: { build: "taro build --type weapp" },
      dependencies: { "@tarojs/taro": "^3.6.0", react: "^18.0.0" },
    }),
    "packages/types/package.json": JSON.stringify({
      name: "@picshare/types",
      scripts: { typecheck: "tsc --noEmit" },
    }),
    "apps/backend/Dockerfile":
      "COPY package.json pnpm-lock.yaml ./\nEXPOSE 3000\n",
    "apps/admin/Dockerfile":
      "COPY package.json pnpm-lock.yaml ./\nEXPOSE 3001\n",
    "apps/backend/prisma/schema.prisma":
      'datasource db { provider = "mysql" }\n',
    "apps/backend/.env.example": "DATABASE_URL=\nREDIS_URL=\nJWT_SECRET=\n",
    "docker-compose.yml": compose("/api/health/readiness"),
    "docker-compose.devpilot.yml": compose("/api"),
  };
  const files = [...Object.keys(manifests), "pnpm-lock.yaml"];
  return {
    files,
    manifests,
    totalFiles: files.length,
    totalBytes: Object.values(manifests).join("").length,
  };
}

function compose(healthPath: string): string {
  return [
    "services:",
    "  backend:",
    "    build:",
    "      context: .",
    "      dockerfile: apps/backend/Dockerfile",
    '    ports: ["3000:3000"]',
    "    depends_on: [mysql, redis]",
    `    healthcheck: { test: ["CMD", "curl", "http://localhost:3000${healthPath}"] }`,
    "  admin:",
    "    build:",
    "      context: .",
    "      dockerfile: apps/admin/Dockerfile",
    '    ports: ["3001:3001"]',
    '  mysql: { image: "mysql:8" }',
    '  redis: { image: "redis:7" }',
  ].join("\n");
}
