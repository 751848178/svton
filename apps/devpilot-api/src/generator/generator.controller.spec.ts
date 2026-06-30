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
      recordGeneratedProjectArtifactDownload: jest.fn().mockResolvedValue({ id: 'project-1' }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const response = createResponseMock();
    const controller = new GeneratorController(
      generatorService as never,
      projectService as never,
      accessPolicyService as never,
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
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="demo.zip"',
      'Content-Length': 3,
      'X-Project-Download-Url': '/api/projects/project-1/download',
      'X-Project-Artifact-Expires-At': '2026-07-29T00:00:00.000Z',
    }));
    expect(result).toBeDefined();
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
