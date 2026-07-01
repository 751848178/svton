import { GeneratorController } from './generator.controller';
import { GenerateProjectDto } from './dto/generate.dto';

describe('GeneratorController artifact persistence', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  it('persists a generated ZIP artifact and exposes its reusable download URL', async () => {
    const dto = createGenerateDto();
    const artifact = {
      kind: 'project_zip' as const,
      storage: 'local' as const,
      fileName: 'demo.zip',
      size: 3,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-06-29T00:00:00.000Z',
      downloadUrl: '/api/projects/project-1/download',
      retentionDays: 30,
      expiresAt: '2026-07-29T00:00:00.000Z',
    };
    const generatorService = {
      resolveProjectResources: jest.fn().mockResolvedValue({
        credentials: [],
        summary: [{ type: 'mysql', mode: 'manual' }],
      }),
      generateProject: jest.fn().mockResolvedValue([{ path: 'README.md', content: 'hi' }]),
      createZipBuffer: jest.fn().mockResolvedValue(Buffer.from('zip')),
      persistProjectZipArtifact: jest.fn().mockResolvedValue(artifact),
    };
    const projectService = {
      create: jest.fn().mockResolvedValue({ id: 'project-1' }),
      attachGeneratedProjectArtifact: jest.fn().mockResolvedValue({ id: 'project-1' }),
    };
    const accessPolicyService = {
      assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const response = createResponseMock();
    const controller = new GeneratorController(
      generatorService as never,
      projectService as never,
      accessPolicyService as never,
      {} as never,
    );

    await controller.generateProject(dto, req, response as never);

    expect(generatorService.persistProjectZipArtifact).toHaveBeenCalledWith(
      'team-1',
      'project-1',
      'demo',
      Buffer.from('zip'),
    );
    expect(projectService.attachGeneratedProjectArtifact).toHaveBeenCalledWith(
      'team-1',
      'project-1',
      expect.objectContaining({
        basicInfo: dto.basicInfo,
        resolvedResources: [{ type: 'mysql', mode: 'manual' }],
      }),
      artifact,
    );
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({
      'X-Project-Id': 'project-1',
      'X-Project-Download-Url': '/api/projects/project-1/download',
      'X-Project-Artifact-Expires-At': '2026-07-29T00:00:00.000Z',
      'Content-Disposition': 'attachment; filename="demo.zip"',
    }));
    expect(response.send).toHaveBeenCalledWith(Buffer.from('zip'));
  });

  it('checks project read access before returning a generated artifact stream', async () => {
    const generatorService = {
      resolveProjectZipArtifact: jest.fn().mockResolvedValue({
        kind: 'project_zip',
        storage: 'local',
        fileName: 'demo.zip',
        size: 3,
        sha256: 'a'.repeat(64),
        generatedAt: '2026-06-29T00:00:00.000Z',
        downloadUrl: '/api/projects/project-1/download',
        retentionDays: 30,
        expiresAt: '2026-07-29T00:00:00.000Z',
        downloadCount: 5,
        filePath: __filename,
      }),
    };
    const projectService = {
      findGeneratedArtifactProject: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: 'demo',
        config: { generatedArtifact: { fileName: 'demo.zip' } },
        downloadUrl: '/api/projects/project-1/download',
      }),
      recordGeneratedProjectArtifactDownload: jest.fn().mockResolvedValue({
        id: 'project-1',
        config: {
          generatedArtifact: {
            downloadCount: 6,
          },
        },
      }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    const response = createResponseMock();
    const controller = new GeneratorController(
      generatorService as never,
      projectService as never,
      accessPolicyService as never,
      auditEventService as never,
    );

    const result = await controller.downloadGeneratedProject('project-1', req, response as never);

    expect(projectService.findGeneratedArtifactProject).toHaveBeenCalledWith('team-1', 'project-1');
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      action: 'project.download',
      targetType: 'project_artifact',
      targetId: 'project-1',
    }));
    expect(projectService.recordGeneratedProjectArtifactDownload).toHaveBeenCalledWith(
      'team-1',
      'project-1',
      'user-1',
      expect.objectContaining({
        fileName: 'demo.zip',
        expiresAt: '2026-07-29T00:00:00.000Z',
      }),
    );
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      action: 'project.artifact.download',
      targetType: 'project_artifact',
      targetId: 'project-1',
      risk: 'low',
      status: 'completed',
      metadata: {
        fileName: 'demo.zip',
        size: 3,
        sha256: 'a'.repeat(64),
        generatedAt: '2026-06-29T00:00:00.000Z',
        expiresAt: '2026-07-29T00:00:00.000Z',
        downloadCount: 6,
      },
    }));
    expect(auditEventService.create.mock.calls[0][0].metadata).not.toHaveProperty('filePath');
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="demo.zip"',
      'Content-Length': 3,
      'X-Project-Download-Url': '/api/projects/project-1/download',
      'X-Project-Artifact-Expires-At': '2026-07-29T00:00:00.000Z',
    }));
    expect(result).toBeDefined();
  });

  it('cleans generated artifacts within the current team and writes an audit event', async () => {
    const cleanupResult = {
      dryRun: false,
      scanned: 2,
      expired: 1,
      deleted: 1,
      artifacts: [{
        filePath: '/var/private/team-1/project-1/demo.zip',
        teamId: 'team-1',
        projectId: 'project-1',
        fileName: 'demo.zip',
        size: 3,
        generatedAt: '2026-06-01T00:00:00.000Z',
        expiresAt: '2026-06-08T00:00:00.000Z',
        deleted: true,
      }],
    };
    const generatorService = {
      cleanupExpiredProjectZipArtifacts: jest.fn().mockResolvedValue(cleanupResult),
    };
    const accessPolicyService = {
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    const controller = new GeneratorController(
      generatorService as never,
      {} as never,
      accessPolicyService as never,
      auditEventService as never,
    );

    const result = await controller.cleanupGeneratedProjectArtifacts(
      { dryRun: false, projectId: 'project-1' },
      req,
    );

    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      action: 'project.artifact.cleanup',
      targetType: 'project_artifact',
      targetId: 'project-1',
      risk: 'high',
    }));
    expect(generatorService.cleanupExpiredProjectZipArtifacts).toHaveBeenCalledWith({
      dryRun: false,
      teamId: 'team-1',
      projectId: 'project-1',
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      action: 'project.artifact.cleanup',
      risk: 'high',
      metadata: expect.objectContaining({
        dryRun: false,
        scanned: 2,
        expired: 1,
        deleted: 1,
      }),
    }));
    expect(result).toEqual({
      dryRun: false,
      scanned: 2,
      expired: 1,
      deleted: 1,
      artifacts: [{
        teamId: 'team-1',
        projectId: 'project-1',
        fileName: 'demo.zip',
        size: 3,
        generatedAt: '2026-06-01T00:00:00.000Z',
        expiresAt: '2026-06-08T00:00:00.000Z',
        deleted: true,
      }],
    });
  });
});

function createGenerateDto(): GenerateProjectDto {
  return {
    basicInfo: {
      name: 'demo',
      description: 'Demo',
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
  };
}

function createResponseMock() {
  return {
    set: jest.fn(),
    send: jest.fn(),
  };
}
