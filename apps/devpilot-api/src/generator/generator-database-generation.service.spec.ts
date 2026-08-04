import type { GenerateProjectDto } from "./dto/generate.dto";
import { GeneratorService, type GeneratedFile } from "./generator.service";

describe("GeneratorService database engine generation", () => {
  it("generates MySQL project files by default", async () => {
    const files = await createService().generateProject(createConfig());

    expect(fileContent(files, "README.md")).toContain("NestJS + Prisma + MySQL");
    expect(fileContent(files, "apps/backend/prisma/schema.prisma")).toContain(
      'provider = "mysql"',
    );
    expect(fileContent(files, "docker-compose.yml")).toContain("image: mysql:8.0");
  });

  it("generates PostgreSQL project files when selected", async () => {
    const files = await createService().generateProject(
      createConfig({ database: { engine: "postgresql" } }),
    );

    expect(fileContent(files, "README.md")).toContain(
      "NestJS + Prisma + PostgreSQL",
    );
    expect(fileContent(files, "apps/backend/prisma/schema.prisma")).toContain(
      'provider = "postgresql"',
    );
    expect(fileContent(files, "docker-compose.yml")).toContain(
      "postgres:15-alpine",
    );
  });

  it("generates SQLite files without a local database service", async () => {
    const files = await createService().generateProject(
      createConfig({ database: { engine: "sqlite" } }),
    );

    expect(fileContent(files, "README.md")).toContain("NestJS + Prisma + SQLite");
    expect(fileContent(files, "apps/backend/prisma/schema.prisma")).toContain(
      'provider = "sqlite"',
    );
    expect(fileContent(files, "docker-compose.yml")).toContain("services: {}");
  });
});

function createService(): GeneratorService {
  return new GeneratorService(
    {
      resolvePackages: jest.fn().mockReturnValue([]),
      resolvePackagesWithDependencies: jest.fn().mockReturnValue({ dependencies: {} }),
      getModuleImports: jest.fn().mockReturnValue({ imports: [], modules: [] }),
      generateEnvVars: jest.fn().mockReturnValue([]),
      resolveResources: jest.fn().mockReturnValue([]),
      getResourceType: jest.fn(),
      generateResourceEnvVars: jest.fn().mockReturnValue(""),
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function createConfig(
  overrides: Partial<GenerateProjectDto> = {},
): GenerateProjectDto {
  return {
    basicInfo: {
      name: "demo",
      orgName: "acme",
      description: "Demo project",
      packageManager: "pnpm",
    },
    subProjects: { backend: true, admin: false, mobile: false },
    features: [],
    resources: {},
    uiLibrary: { admin: false, mobile: false },
    hooks: false,
    ...overrides,
  };
}

function fileContent(files: GeneratedFile[], filePath: string): string {
  const file = files.find(({ path }) => path === filePath);
  if (!file) throw new Error(`Missing generated file: ${filePath}`);
  return file.content;
}
