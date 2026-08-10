import { mkdtemp, readFile, rm, utimes } from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { GeneratorService } from './generator.service';

describe('GeneratorService project zip artifacts', () => {
  const originalArtifactRoot = process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
  const originalArtifactRetentionDays = process.env.DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS;
  let artifactRoot: string;

  beforeEach(async () => {
    artifactRoot = await mkdtemp(path.join(tmpdir(), 'devpilot-generated-projects-'));
    process.env.DEVPILOT_GENERATED_PROJECTS_DIR = artifactRoot;
    process.env.DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS = '7';
  });

  afterEach(async () => {
    if (originalArtifactRoot === undefined) {
      delete process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
    } else {
      process.env.DEVPILOT_GENERATED_PROJECTS_DIR = originalArtifactRoot;
    }
    if (originalArtifactRetentionDays === undefined) {
      delete process.env.DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS;
    } else {
      process.env.DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS = originalArtifactRetentionDays;
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
      retentionDays: 7,
    }));
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Date.parse(artifact.expiresAt)).toBe(Date.parse(artifact.generatedAt) + 7 * 24 * 60 * 60 * 1000);
    expect(resolved).toEqual(expect.objectContaining({
      fileName: 'demo-app.zip',
      size: zipBuffer.length,
      downloadUrl: '/api/projects/project-1/download',
      retentionDays: 7,
      expiresAt: artifact.expiresAt,
    }));
  });

  it('rejects expired generated project zip artifacts before streaming', async () => {
    const service = createService();
    const artifact = await service.persistProjectZipArtifact('team-1', 'project-1', 'demo app', Buffer.from('zip-content'));

    await expect(service.resolveProjectZipArtifact('team-1', 'project-1', 'demo app', {
      generatedArtifact: {
        ...artifact,
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    })).rejects.toThrow('生成包已过期，请重新生成');
  });

  it('dry-runs and deletes expired local generated project artifacts', async () => {
    const service = createService();
    const artifact = await service.persistProjectZipArtifact('team-1', 'project-1', 'demo app', Buffer.from('zip-content'));
    const resolved = await service.resolveProjectZipArtifact('team-1', 'project-1', 'demo app', {
      generatedArtifact: artifact,
    });
    const oldTimestamp = new Date('2026-01-01T00:00:00.000Z');
    const cleanupNow = new Date('2026-01-10T00:00:00.000Z');
    await utimes(resolved.filePath, oldTimestamp, oldTimestamp);

    const dryRun = await service.cleanupExpiredProjectZipArtifacts({ dryRun: true, now: cleanupNow });
    expect(dryRun).toEqual(expect.objectContaining({
      dryRun: true,
      scanned: 1,
      expired: 1,
      deleted: 0,
    }));
    await expect(readFile(resolved.filePath)).resolves.toEqual(Buffer.from('zip-content'));

    const executed = await service.cleanupExpiredProjectZipArtifacts({ dryRun: false, now: cleanupNow });
    expect(executed).toEqual(expect.objectContaining({
      dryRun: false,
      scanned: 1,
      expired: 1,
      deleted: 1,
    }));
    await expect(readFile(resolved.filePath)).rejects.toThrow();
  });

  it('limits cleanup to the requested team scope', async () => {
    const service = createService();
    const teamArtifact = await service.persistProjectZipArtifact('team-1', 'project-1', 'demo app', Buffer.from('team-zip'));
    const otherArtifact = await service.persistProjectZipArtifact('team-2', 'project-2', 'other app', Buffer.from('other-zip'));
    const teamResolved = await service.resolveProjectZipArtifact('team-1', 'project-1', 'demo app', {
      generatedArtifact: teamArtifact,
    });
    const otherResolved = await service.resolveProjectZipArtifact('team-2', 'project-2', 'other app', {
      generatedArtifact: otherArtifact,
    });
    const oldTimestamp = new Date('2026-01-01T00:00:00.000Z');
    const cleanupNow = new Date('2026-01-10T00:00:00.000Z');
    await utimes(teamResolved.filePath, oldTimestamp, oldTimestamp);
    await utimes(otherResolved.filePath, oldTimestamp, oldTimestamp);

    const result = await service.cleanupExpiredProjectZipArtifacts({
      dryRun: false,
      now: cleanupNow,
      teamId: 'team-1',
    });

    expect(result).toEqual(expect.objectContaining({
      dryRun: false,
      scanned: 1,
      expired: 1,
      deleted: 1,
    }));
    expect(result.artifacts[0]).toEqual(expect.objectContaining({
      teamId: 'team-1',
      projectId: 'project-1',
      fileName: 'demo-app.zip',
      deleted: true,
    }));
    await expect(readFile(teamResolved.filePath)).rejects.toThrow();
    await expect(readFile(otherResolved.filePath)).resolves.toEqual(Buffer.from('other-zip'));
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
