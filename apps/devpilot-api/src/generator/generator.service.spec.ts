import { mkdtemp, readFile, rm } from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { GenerateProjectDto } from './dto/generate.dto';
import { GeneratedFile, GeneratorService } from './generator.service';

describe('GeneratorService database engine generation', () => {
  it('generates MySQL project files by default', async () => {
    const service = createService();

    const files = await service.generateProject(createConfig());

    expect(fileContent(files, 'README.md')).toContain('NestJS + Prisma + MySQL');
    expect(fileContent(files, 'apps/backend/prisma/schema.prisma')).toContain('provider = "mysql"');
    expect(fileContent(files, '.env.example')).toContain('DATABASE_URL="mysql://root:password@localhost:3306/mydb"');
    expect(fileContent(files, 'docker-compose.yml')).toContain('image: mysql:8.0');
    expect(fileContent(files, 'docker-compose.yml')).toContain('mysql_data:/var/lib/mysql');
    expect(fileContent(files, 'docker-compose.yml')).not.toContain('postgres:');
  });

  it('generates PostgreSQL project files when selected', async () => {
    const service = createService();

    const files = await service.generateProject(createConfig({
      database: { engine: 'postgresql' },
    }));

    expect(fileContent(files, 'README.md')).toContain('NestJS + Prisma + PostgreSQL');
    expect(fileContent(files, 'apps/backend/prisma/schema.prisma')).toContain('provider = "postgresql"');
    expect(fileContent(files, '.env.example')).toContain(
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb?schema=public"',
    );
    expect(fileContent(files, 'docker-compose.yml')).toContain('postgres:15-alpine');
    expect(fileContent(files, 'docker-compose.yml')).toContain('postgres_data:/var/lib/postgresql/data');
    expect(fileContent(files, 'docker-compose.yml')).not.toContain('mysql:8.0');
  });

  it('generates SQLite project files without a local database service', async () => {
    const service = createService();

    const files = await service.generateProject(createConfig({
      database: { engine: 'sqlite' },
    }));

    expect(fileContent(files, 'README.md')).toContain('NestJS + Prisma + SQLite');
    expect(fileContent(files, 'apps/backend/prisma/schema.prisma')).toContain('provider = "sqlite"');
    expect(fileContent(files, '.env.example')).toContain('DATABASE_URL="file:./dev.db"');
    expect(fileContent(files, 'docker-compose.yml')).toContain('services: {}');
    expect(fileContent(files, 'docker-compose.yml')).not.toContain('mysql:8.0');
    expect(fileContent(files, 'docker-compose.yml')).not.toContain('postgres:15-alpine');
  });
});

describe('GeneratorService project zip artifacts', () => {
  const originalArtifactRoot = process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
  let artifactRoot: string;

  beforeEach(async () => {
    artifactRoot = await mkdtemp(path.join(tmpdir(), 'devpilot-generated-projects-'));
    process.env.DEVPILOT_GENERATED_PROJECTS_DIR = artifactRoot;
  });

  afterEach(async () => {
    if (originalArtifactRoot === undefined) {
      delete process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
    } else {
      process.env.DEVPILOT_GENERATED_PROJECTS_DIR = originalArtifactRoot;
    }
    await rm(artifactRoot, { recursive: true, force: true });
  });

  it('persists a generated project zip and resolves it from artifact metadata', async () => {
    const service = createService();
    const zipBuffer = Buffer.from('zip-content');

    const artifact = await service.persistProjectZipArtifact('team-1', 'project-1', 'demo app', zipBuffer);
    const resolved = await service.resolveProjectZipArtifact('team-1', 'project-1', 'demo app', {
      generatedArtifact: artifact,
    });

    await expect(readFile(resolved.filePath)).resolves.toEqual(zipBuffer);
    expect(artifact).toEqual(expect.objectContaining({
      kind: 'project_zip',
      storage: 'local',
      fileName: 'demo-app.zip',
      size: zipBuffer.length,
      downloadUrl: '/api/projects/project-1/download',
    }));
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(resolved).toEqual(expect.objectContaining({
      fileName: 'demo-app.zip',
      size: zipBuffer.length,
      downloadUrl: '/api/projects/project-1/download',
    }));
  });
});

function createService(): GeneratorService {
  const registryService = {
    resolvePackages: jest.fn().mockReturnValue([]),
    resolvePackagesWithDependencies: jest.fn().mockReturnValue({ dependencies: {} }),
    getModuleImports: jest.fn().mockReturnValue({ imports: [], modules: [] }),
    generateEnvVars: jest.fn().mockReturnValue([]),
    resolveResources: jest.fn().mockReturnValue([]),
    getResourceType: jest.fn().mockReturnValue(undefined),
    generateResourceEnvVars: jest.fn().mockReturnValue(''),
  };

  return new GeneratorService(
    registryService as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function createConfig(overrides: Partial<GenerateProjectDto> = {}): GenerateProjectDto {
  return {
    basicInfo: {
      name: 'demo',
      orgName: 'acme',
      description: 'Demo project',
      packageManager: 'pnpm',
    },
    subProjects: {
      backend: true,
      admin: false,
      mobile: false,
    },
    features: [],
    resources: {},
    uiLibrary: {
      admin: false,
      mobile: false,
    },
    hooks: false,
    ...overrides,
  };
}

function fileContent(files: GeneratedFile[], path: string): string {
  const file = files.find((item) => item.path === path);

  if (!file) {
    throw new Error(`Missing generated file: ${path}`);
  }

  return file.content;
}
