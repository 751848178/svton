import { PrismaService } from '../prisma/prisma.service';
import { ProjectEnvironmentService } from '../project-environment';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  it('normalizes missing environment config to the default four environments', async () => {
    const prisma = {
      project: {
        create: jest.fn(({ data }) => Promise.resolve({ id: 'project-1', ...data })),
      },
    } as unknown as PrismaService;
    const projectEnvironmentService = {
      ensureDefaultsForProject: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectEnvironmentService;
    const service = new ProjectService(prisma, projectEnvironmentService);

    await service.create('team-1', 'user-1', {
      name: 'demo',
      config: { initialized: false },
    });

    expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        config: expect.objectContaining({
          environments: ['dev', 'test', 'staging', 'prod'],
          initialized: false,
        }),
      }),
    }));
    expect(projectEnvironmentService.ensureDefaultsForProject).toHaveBeenCalledWith(
      'team-1',
      'project-1',
      expect.objectContaining({
        environments: ['dev', 'test', 'staging', 'prod'],
      }),
    );
  });

  it('keeps explicit environment config on create', async () => {
    const prisma = {
      project: {
        create: jest.fn(({ data }) => Promise.resolve({ id: 'project-1', ...data })),
      },
    } as unknown as PrismaService;
    const projectEnvironmentService = {
      ensureDefaultsForProject: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectEnvironmentService;
    const service = new ProjectService(prisma, projectEnvironmentService);

    await service.create('team-1', 'user-1', {
      name: 'demo',
      config: { environments: ['prod', 'staging'] },
    });

    expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        config: expect.objectContaining({
          environments: ['prod', 'staging'],
        }),
      }),
    }));
  });

  it('selects safe allocation fields on project detail', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: 'project-1', name: 'demo' }),
      },
    } as unknown as PrismaService;
    const projectEnvironmentService = {
      ensureDefaultsForProject: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectEnvironmentService;
    const service = new ProjectService(prisma, projectEnvironmentService);

    await service.findOne('team-1', 'project-1');

    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        allocations: expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            resourceName: true,
            status: true,
            createdAt: true,
            releasedAt: true,
            pool: expect.any(Object),
          }),
        }),
      }),
    }));
    const query = (prisma.project.findFirst as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(query.include.allocations)).not.toContain('credentials');
  });

  it('attaches generated project artifact metadata and downloadUrl', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: 'demo',
          description: 'Demo',
          config: { origin: 'generated', environments: ['dev', 'test'] },
        }),
        update: jest.fn(({ data }) => Promise.resolve({ id: 'project-1', ...data })),
      },
    } as unknown as PrismaService;
    const projectEnvironmentService = {
      ensureDefaultsForProject: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectEnvironmentService;
    const service = new ProjectService(prisma, projectEnvironmentService);
    const artifact = {
      kind: 'project_zip',
      storage: 'local',
      fileName: 'demo.zip',
      size: 3,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-06-29T00:00:00.000Z',
      downloadUrl: '/api/projects/project-1/download',
      retentionDays: 30,
      expiresAt: '2026-07-29T00:00:00.000Z',
    } as const;

    await service.attachGeneratedProjectArtifact(
      'team-1',
      'project-1',
      { basicInfo: { name: 'demo' }, resolvedResources: [] },
      artifact,
    );

    expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        downloadUrl: '/api/projects/project-1/download',
        config: expect.objectContaining({
          generatedArtifact: artifact,
          resolvedResources: [],
          environments: ['dev', 'test', 'staging', 'prod'],
        }),
      }),
    }));
  });

  it('records generated artifact download metadata in project config', async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: 'demo',
          description: 'Demo',
          config: {
            origin: 'generated',
            environments: ['dev', 'test'],
            generatedArtifact: {
              kind: 'project_zip',
              storage: 'local',
              fileName: 'demo.zip',
              size: 3,
              sha256: 'a'.repeat(64),
              generatedAt: '2026-06-29T00:00:00.000Z',
              downloadUrl: '/api/projects/project-1/download',
              retentionDays: 30,
              expiresAt: '2026-07-29T00:00:00.000Z',
              downloadCount: 2,
            },
          },
        }),
        update: jest.fn(({ data }) => Promise.resolve({ id: 'project-1', ...data })),
      },
    } as unknown as PrismaService;
    const projectEnvironmentService = {
      ensureDefaultsForProject: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectEnvironmentService;
    const service = new ProjectService(prisma, projectEnvironmentService);

    await service.recordGeneratedProjectArtifactDownload('team-1', 'project-1', 'user-1', {
      kind: 'project_zip',
      storage: 'local',
      fileName: 'demo.zip',
      size: 3,
      sha256: 'a'.repeat(64),
      generatedAt: '2026-06-29T00:00:00.000Z',
      downloadUrl: '/api/projects/project-1/download',
      retentionDays: 30,
      expiresAt: '2026-07-29T00:00:00.000Z',
    });

    expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        config: expect.objectContaining({
          generatedArtifact: expect.objectContaining({
            fileName: 'demo.zip',
            downloadCount: 3,
            lastDownloadedAt: expect.any(String),
            lastDownloadedBy: 'user-1',
            expiresAt: '2026-07-29T00:00:00.000Z',
          }),
          environments: ['dev', 'test'],
        }),
      }),
    }));
  });
});
