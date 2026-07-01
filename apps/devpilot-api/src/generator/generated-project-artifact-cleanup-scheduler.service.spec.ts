import { ConfigService } from '@nestjs/config';
import { AuditEventService } from '../audit-event';
import { GeneratedProjectArtifactCleanupSchedulerService } from './generated-project-artifact-cleanup-scheduler.service';
import { GeneratorService } from './generator.service';

describe('GeneratedProjectArtifactCleanupSchedulerService', () => {
  let generatorService: { cleanupExpiredProjectZipArtifacts: jest.Mock };
  let auditEventService: { create: jest.Mock };
  let config: { get: jest.Mock };
  let service: GeneratedProjectArtifactCleanupSchedulerService;

  beforeEach(() => {
    generatorService = {
      cleanupExpiredProjectZipArtifacts: jest.fn().mockResolvedValue({
        dryRun: true,
        scanned: 0,
        expired: 0,
        deleted: 0,
        artifacts: [],
      }),
    };
    auditEventService = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED: 'true',
          PROJECT_ARTIFACT_CLEANUP_SCHEDULER_DRY_RUN: 'true',
          PROJECT_ARTIFACT_CLEANUP_SCHEDULER_INTERVAL_SECONDS: '86400',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new GeneratedProjectArtifactCleanupSchedulerService(
      generatorService as unknown as GeneratorService,
      auditEventService as unknown as AuditEventService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED') return 'false';
      if (key === 'PROJECT_ARTIFACT_CLEANUP_SCHEDULER_DRY_RUN') return 'true';
      return fallback;
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: false,
      dryRun: true,
      scanned: 0,
      expired: 0,
      deleted: 0,
      auditEvents: 0,
      auditFailures: 0,
    });
    expect(generatorService.cleanupExpiredProjectZipArtifacts).not.toHaveBeenCalled();
  });

  it('runs dry-run cleanup and writes team-scoped audit events', async () => {
    generatorService.cleanupExpiredProjectZipArtifacts.mockResolvedValue({
      dryRun: true,
      scanned: 2,
      expired: 2,
      deleted: 0,
      artifacts: [
        createArtifact('team-1', 'project-1', false),
        createArtifact('team-1', 'project-2', false),
      ],
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      scanned: 2,
      expired: 2,
      deleted: 0,
      auditEvents: 1,
      auditFailures: 0,
    });
    expect(generatorService.cleanupExpiredProjectZipArtifacts).toHaveBeenCalledWith({ dryRun: true });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: null,
      action: 'project.artifact.cleanup',
      risk: 'low',
      metadata: expect.objectContaining({
        trigger: 'scheduler',
        dryRun: true,
        expired: 2,
        deleted: 0,
      }),
    }));
  });

  it('can run live cleanup only when dry-run is explicitly disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED: 'true',
        PROJECT_ARTIFACT_CLEANUP_SCHEDULER_DRY_RUN: 'false',
      };
      return values[key] ?? fallback;
    });
    generatorService.cleanupExpiredProjectZipArtifacts.mockResolvedValue({
      dryRun: false,
      scanned: 1,
      expired: 1,
      deleted: 1,
      artifacts: [createArtifact('team-1', 'project-1', true)],
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: false,
      scanned: 1,
      expired: 1,
      deleted: 1,
      auditEvents: 1,
      auditFailures: 0,
    });
    expect(generatorService.cleanupExpiredProjectZipArtifacts).toHaveBeenCalledWith({ dryRun: false });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      risk: 'high',
      metadata: expect.objectContaining({ deleted: 1 }),
    }));
  });

  it('returns skipped summary when a scheduler tick is already running', async () => {
    generatorService.cleanupExpiredProjectZipArtifacts.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({
        dryRun: true,
        scanned: 0,
        expired: 0,
        deleted: 0,
        artifacts: [],
      }), 10);
    }));

    const first = service.runOnce();
    await expect(service.runOnce()).resolves.toEqual({
      skipped: true,
      enabled: true,
      dryRun: true,
      scanned: 0,
      expired: 0,
      deleted: 0,
      auditEvents: 0,
      auditFailures: 0,
    });
    await first;
  });
});

function createArtifact(teamId: string, projectId: string, deleted: boolean) {
  return {
    filePath: `/tmp/${teamId}/${projectId}/demo.zip`,
    teamId,
    projectId,
    fileName: 'demo.zip',
    size: 3,
    generatedAt: '2026-06-01T00:00:00.000Z',
    expiresAt: '2026-06-08T00:00:00.000Z',
    deleted,
  };
}
