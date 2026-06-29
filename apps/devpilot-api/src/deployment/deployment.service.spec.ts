import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor';
import { DeploymentService } from './deployment.service';

describe('DeploymentService retryRun', () => {
  let prisma: {
    deploymentRun: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let serverExecutor: {
    resolveTarget: jest.Mock;
    execute: jest.Mock;
    queueExecution: jest.Mock;
  };
  let auditEventService: { create: jest.Mock };
  let operationApprovalService: {
    resolveApproved: jest.Mock;
    createPending: jest.Mock;
    consume: jest.Mock;
  };
  let service: DeploymentService;

  beforeEach(() => {
    prisma = {
      deploymentRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    serverExecutor = {
      resolveTarget: jest.fn(),
      execute: jest.fn(),
      queueExecution: jest.fn(),
    };
    auditEventService = { create: jest.fn() };
    operationApprovalService = {
      resolveApproved: jest.fn(),
      createPending: jest.fn(),
      consume: jest.fn(),
    };
    service = new DeploymentService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      auditEventService as unknown as AuditEventService,
      operationApprovalService as unknown as OperationApprovalService,
    );
  });

  it('recreates a failed deploy run with the original source ref and command overrides', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-failed-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      applicationId: 'app-1',
      applicationServiceId: 'svc-1',
      serverId: 'server-1',
      environment: 'prod',
      mode: 'deploy',
      source: 'webhook',
      trigger: 'git_push',
      targetType: 'server',
      dryRun: false,
      status: 'failed',
      gitRepo: 'git@example.com:repo/app.git',
      branch: 'main',
      commitSha: 'abc123456789',
      workingDirectory: '/srv/app',
      buildCommand: 'pnpm build',
      deployCommand: 'pnpm start',
      healthCheckUrl: 'https://example.com/health',
      params: { originalFlag: true },
    });
    const createRun = jest
      .spyOn(service, 'createRun')
      .mockResolvedValue({ id: 'retry-run' } as never);

    await expect(service.retryRun('team-1', 'user-1', 'run-failed-1', {
      queue: true,
      maxAttempts: 3,
      overrides: { deployCommand: 'pnpm deploy' },
    })).resolves.toEqual({ id: 'retry-run' });

    expect(createRun).toHaveBeenCalledWith('team-1', 'user-1', 'project-1', {
      environment: 'prod',
      environmentId: 'env-prod',
      applicationId: 'app-1',
      applicationServiceId: 'svc-1',
      serverId: 'server-1',
      branch: 'main',
      commitSha: 'abc123456789',
      source: 'manual',
      trigger: 'manual_retry',
      dryRun: true,
      queue: true,
      maxAttempts: 3,
      overrides: expect.objectContaining({
        originalFlag: true,
        targetType: 'server',
        workingDirectory: '/srv/app',
        buildCommand: 'pnpm build',
        deployCommand: 'pnpm deploy',
        healthCheckUrl: 'https://example.com/health',
        retrySourceRunId: 'run-failed-1',
        retrySourceStatus: 'failed',
        retrySourceDryRun: false,
        retrySourceTrigger: 'git_push',
        retrySourceSource: 'webhook',
      }),
      confirmationText: undefined,
      approvalId: undefined,
      approvalReason: '重试失败部署 run-fail',
    });
  });

  it('rejects retry when the source run does not exist', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue(null);

    await expect(service.retryRun('team-1', 'user-1', 'missing-run', {}))
      .rejects
      .toThrow(NotFoundException);
  });

  it('rejects retry for a non-failed deploy run', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-ok',
      mode: 'deploy',
      status: 'completed',
      dryRun: true,
    });

    await expect(service.retryRun('team-1', 'user-1', 'run-ok', {}))
      .rejects
      .toThrow(BadRequestException);
  });

  it('rejects live retry directly from a failed dry-run', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-dry-failed',
      mode: 'deploy',
      status: 'failed',
      dryRun: true,
    });

    await expect(service.retryRun('team-1', 'user-1', 'run-dry-failed', { dryRun: false }))
      .rejects
      .toThrow(BadRequestException);
  });

  it('creates a smoke-failure rollback plan from the previous successful live deployment', async () => {
    const sourceStartedAt = new Date('2026-06-28T01:00:00.000Z');
    prisma.deploymentRun.findFirst
      .mockResolvedValueOnce({
        id: 'smoke-failed-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
        mode: 'smoke_check',
        dryRun: false,
        status: 'failed',
        healthCheckUrl: 'https://example.com/health',
        startedAt: new Date('2026-06-28T01:05:00.000Z'),
        sourceRun: {
          id: 'deploy-bad-1',
          projectId: 'project-1',
          environmentId: 'env-prod',
          applicationId: 'app-1',
          applicationServiceId: 'svc-1',
          serverId: 'server-1',
          mode: 'deploy',
          dryRun: false,
          status: 'completed',
          startedAt: sourceStartedAt,
        },
      })
      .mockResolvedValueOnce({ id: 'deploy-good-previous' });
    const rollbackRun = jest
      .spyOn(service, 'rollbackRun')
      .mockResolvedValue({ id: 'rollback-run' } as never);

    await expect(service.requestSmokeFailureRollback('team-1', 'user-1', 'smoke-failed-1', {
      queue: true,
    })).resolves.toEqual({ id: 'rollback-run' });

    expect(prisma.deploymentRun.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        teamId: 'team-1',
        projectId: 'project-1',
        mode: 'deploy',
        status: 'completed',
        dryRun: false,
        id: { not: 'deploy-bad-1' },
        startedAt: { lt: sourceStartedAt },
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    expect(rollbackRun).toHaveBeenCalledWith('team-1', 'user-1', 'deploy-good-previous', {
      queue: true,
      dryRun: true,
      approvalReason: '部署 Smoke smoke-fa 失败后申请回滚到上一成功版本',
      overrides: {
        smokeFailureRunId: 'smoke-failed-1',
        smokeFailureSourceRunId: 'deploy-bad-1',
        smokeFailureHealthCheckUrl: 'https://example.com/health',
      },
    });
  });

  it('rejects live smoke-failure rollback from a dry-run smoke check', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'smoke-dry-failed',
      mode: 'smoke_check',
      dryRun: true,
      status: 'failed',
      sourceRun: {
        id: 'deploy-source-1',
        mode: 'deploy',
        dryRun: false,
        status: 'completed',
      },
    });

    await expect(service.requestSmokeFailureRollback('team-1', 'user-1', 'smoke-dry-failed', { dryRun: false }))
      .rejects
      .toThrow(BadRequestException);
  });

  it('auto-creates a rollback plan when a live smoke check fails with auto rollback enabled', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-completed-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      applicationId: 'app-1',
      applicationServiceId: 'svc-1',
      serverId: 'server-1',
      environment: 'prod',
      mode: 'deploy',
      source: 'webhook',
      trigger: 'git_push',
      targetType: 'server',
      dryRun: false,
      status: 'completed',
      gitRepo: 'git@example.com:repo/app.git',
      branch: 'main',
      commitSha: 'abc123456789',
      healthCheckUrl: 'https://example.com/health',
      project: { id: 'project-1', name: 'Example App' },
    });
    prisma.deploymentRun.create.mockResolvedValue({ id: 'smoke-run-auto' });
    prisma.deploymentRun.update.mockResolvedValue({
      id: 'smoke-run-auto',
      status: 'failed',
      mode: 'smoke_check',
      error: 'health check failed',
      params: {
        autoRollback: {
          enabled: true,
          dryRun: true,
          queue: true,
          maxAttempts: 2,
        },
      },
    });
    prisma.deploymentRun.findMany.mockResolvedValue([]);
    serverExecutor.resolveTarget.mockResolvedValue({ transport: 'ssh', serverId: 'server-1' });
    serverExecutor.execute.mockResolvedValue({
      status: 'failed',
      commandPlan: { steps: [] },
      logs: [{ level: 'error', message: 'health check failed' }],
      result: { mode: 'executed' },
      error: 'health check failed',
    });
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });
    const requestSmokeFailureRollback = jest
      .spyOn(service, 'requestSmokeFailureRollback')
      .mockResolvedValue({ id: 'rollback-auto', status: 'queued' } as never);

    await expect(service.smokeCheckRun('team-1', 'user-1', 'run-completed-1', {
      dryRun: false,
      queue: false,
      autoRollbackOnFailure: true,
      autoRollbackQueue: true,
      autoRollbackMaxAttempts: 2,
    })).resolves.toEqual(expect.objectContaining({ id: 'smoke-run-auto' }));

    expect(prisma.deploymentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dryRun: false,
        params: expect.objectContaining({
          autoRollback: {
            enabled: true,
            dryRun: true,
            queue: true,
            maxAttempts: 2,
          },
        }),
      }),
    });
    expect(requestSmokeFailureRollback).toHaveBeenCalledWith('team-1', 'user-1', 'smoke-run-auto', {
      dryRun: true,
      queue: true,
      maxAttempts: 2,
      approvalReason: '部署 Smoke smoke-ru 失败后自动生成回滚计划',
      overrides: {
        autoRollback: true,
        autoRollbackSourceSmokeRunId: 'smoke-run-auto',
        autoRollbackPolicy: {
          dryRun: true,
          queue: true,
          maxAttempts: 2,
        },
      },
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deployment.smoke_failure_auto_rollback',
      risk: 'medium',
      status: 'queued',
      deploymentRunId: 'smoke-run-auto',
      metadata: expect.objectContaining({
        rollbackRunId: 'rollback-auto',
      }),
    }));
  });

  it('passes a preapproved live auto rollback policy from failed smoke checks', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-completed-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      applicationId: 'app-1',
      applicationServiceId: 'svc-1',
      serverId: 'server-1',
      environment: 'prod',
      mode: 'deploy',
      source: 'webhook',
      trigger: 'git_push',
      targetType: 'server',
      dryRun: false,
      status: 'completed',
      gitRepo: 'git@example.com:repo/app.git',
      branch: 'main',
      commitSha: 'abc123456789',
      healthCheckUrl: 'https://example.com/health',
      project: { id: 'project-1', name: 'Example App' },
    });
    prisma.deploymentRun.create.mockResolvedValue({ id: 'smoke-run-preapproved' });
    prisma.deploymentRun.update.mockResolvedValue({
      id: 'smoke-run-preapproved',
      status: 'failed',
      mode: 'smoke_check',
      error: 'health check failed',
      params: {
        autoRollback: {
          enabled: true,
          dryRun: false,
          queue: true,
          maxAttempts: 3,
          approvalId: 'approval-live-1',
          confirmationText: 'Example App',
        },
      },
    });
    prisma.deploymentRun.findMany.mockResolvedValue([]);
    serverExecutor.resolveTarget.mockResolvedValue({ transport: 'ssh', serverId: 'server-1' });
    serverExecutor.execute.mockResolvedValue({
      status: 'failed',
      commandPlan: { steps: [] },
      logs: [{ level: 'error', message: 'health check failed' }],
      result: { mode: 'executed' },
      error: 'health check failed',
    });
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });
    const requestSmokeFailureRollback = jest
      .spyOn(service, 'requestSmokeFailureRollback')
      .mockResolvedValue({ id: 'rollback-live-auto', status: 'queued' } as never);

    await expect(service.smokeCheckRun('team-1', 'user-1', 'run-completed-1', {
      dryRun: false,
      queue: false,
      autoRollbackOnFailure: true,
      autoRollbackDryRun: false,
      autoRollbackQueue: true,
      autoRollbackMaxAttempts: 3,
      autoRollbackApprovalId: 'approval-live-1',
      autoRollbackConfirmationText: 'Example App',
    })).resolves.toEqual(expect.objectContaining({ id: 'smoke-run-preapproved' }));

    expect(prisma.deploymentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dryRun: false,
        params: expect.objectContaining({
          autoRollback: {
            enabled: true,
            dryRun: false,
            queue: true,
            maxAttempts: 3,
            approvalId: 'approval-live-1',
            confirmationText: 'Example App',
          },
        }),
      }),
    });
    expect(requestSmokeFailureRollback).toHaveBeenCalledWith('team-1', 'user-1', 'smoke-run-preapproved', {
      dryRun: false,
      queue: true,
      maxAttempts: 3,
      approvalId: 'approval-live-1',
      confirmationText: 'Example App',
      approvalReason: '部署 Smoke smoke-ru 失败后按预授权执行 live 回滚',
      overrides: {
        autoRollback: true,
        autoRollbackSourceSmokeRunId: 'smoke-run-preapproved',
        autoRollbackPolicy: {
          dryRun: false,
          queue: true,
          maxAttempts: 3,
          approvalId: 'approval-live-1',
          confirmationText: 'Example App',
        },
      },
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deployment.smoke_failure_auto_rollback',
      risk: 'high',
      status: 'queued',
      summary: '部署 Smoke 失败后已按预授权提交 live 回滚',
      metadata: expect.objectContaining({
        rollbackRunId: 'rollback-live-auto',
        preauthorized: true,
        approvalId: 'approval-live-1',
      }),
    }));
  });

  it('processes failed smoke checks with enabled auto rollback policy idempotently', async () => {
    prisma.deploymentRun.findMany
      .mockResolvedValueOnce([
        {
          id: 'smoke-auto-1',
          teamId: 'team-1',
          actorId: 'user-1',
          projectId: 'project-1',
          environmentId: 'env-prod',
          applicationId: 'app-1',
          applicationServiceId: 'svc-1',
          serverId: 'server-1',
          params: {
            autoRollback: {
              enabled: true,
              dryRun: true,
              queue: true,
              maxAttempts: 2,
            },
          },
        },
        {
          id: 'smoke-no-policy',
          teamId: 'team-1',
          actorId: 'user-1',
          projectId: 'project-1',
          environmentId: 'env-prod',
          applicationId: 'app-1',
          applicationServiceId: 'svc-1',
          serverId: 'server-1',
          params: {},
        },
      ])
      .mockResolvedValueOnce([]);
    const requestSmokeFailureRollback = jest
      .spyOn(service, 'requestSmokeFailureRollback')
      .mockResolvedValue({ id: 'rollback-auto', status: 'queued' } as never);
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });

    await expect(service.processSmokeFailureAutoRollbacks({ teamId: 'team-1', userId: 'system', limit: 5 }))
      .resolves
      .toEqual({
        scanned: 2,
        attempted: 1,
        created: 1,
        skipped: 1,
        failed: 0,
        results: [
          {
            status: 'created',
            smokeRunId: 'smoke-auto-1',
            rollbackRunId: 'rollback-auto',
          },
          {
            status: 'skipped',
            smokeRunId: 'smoke-no-policy',
            reason: 'auto rollback policy disabled',
          },
        ],
      });

    expect(prisma.deploymentRun.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        teamId: 'team-1',
        mode: 'smoke_check',
        status: 'failed',
        dryRun: false,
      },
      orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        teamId: true,
        actorId: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        params: true,
      },
    });
    expect(requestSmokeFailureRollback).toHaveBeenCalledWith('team-1', 'system', 'smoke-auto-1', expect.objectContaining({
      dryRun: true,
      queue: true,
      maxAttempts: 2,
      overrides: expect.objectContaining({
        autoRollbackSourceSmokeRunId: 'smoke-auto-1',
      }),
    }));
  });

  it('reads preapproved live auto rollback policy from scheduled failed smoke checks', async () => {
    prisma.deploymentRun.findMany
      .mockResolvedValueOnce([
        {
          id: 'smoke-live-auto',
          teamId: 'team-1',
          actorId: 'user-1',
          projectId: 'project-1',
          environmentId: 'env-prod',
          applicationId: 'app-1',
          applicationServiceId: 'svc-1',
          serverId: 'server-1',
          params: {
            autoRollback: {
              enabled: true,
              dryRun: false,
              queue: true,
              maxAttempts: 2,
              approvalId: 'approval-live-1',
              confirmationText: 'Example App',
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    const requestSmokeFailureRollback = jest
      .spyOn(service, 'requestSmokeFailureRollback')
      .mockResolvedValue({ id: 'rollback-live-auto', status: 'queued' } as never);
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });

    await expect(service.processSmokeFailureAutoRollbacks({ teamId: 'team-1', userId: 'system', limit: 5 }))
      .resolves
      .toEqual({
        scanned: 1,
        attempted: 1,
        created: 1,
        skipped: 0,
        failed: 0,
        results: [
          {
            status: 'created',
            smokeRunId: 'smoke-live-auto',
            rollbackRunId: 'rollback-live-auto',
          },
        ],
      });

    expect(requestSmokeFailureRollback).toHaveBeenCalledWith('team-1', 'system', 'smoke-live-auto', {
      dryRun: false,
      queue: true,
      maxAttempts: 2,
      approvalId: 'approval-live-1',
      confirmationText: 'Example App',
      approvalReason: '部署 Smoke smoke-li 失败后按预授权执行 live 回滚',
      overrides: {
        autoRollback: true,
        autoRollbackSourceSmokeRunId: 'smoke-live-auto',
        autoRollbackPolicy: {
          dryRun: false,
          queue: true,
          maxAttempts: 2,
          approvalId: 'approval-live-1',
          confirmationText: 'Example App',
        },
      },
    });
  });

  it('creates a queued smoke check after a completed live rollback when enabled', async () => {
    prisma.deploymentRun.findFirst
      .mockResolvedValueOnce({
        id: 'deploy-good-previous',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
        environment: 'prod',
        mode: 'deploy',
        status: 'completed',
        gitRepo: 'git@example.com:repo/app.git',
        branch: 'main',
        commitSha: 'abc123456789',
        project: {
          id: 'project-1',
          name: 'Example App',
          gitRepo: 'git@example.com:repo/app.git',
          config: {
            deployment: {
              targetType: 'server',
              workingDirectory: '/srv/app',
              buildCommand: 'pnpm build',
              deployCommand: 'pnpm deploy',
              rollbackCommand: 'pnpm rollback',
              healthCheckUrl: 'https://example.com/health',
            },
          },
        },
        projectEnvironment: { id: 'env-prod', key: 'prod', name: 'Prod', status: 'active' },
        application: { id: 'app-1', name: 'Example App', status: 'active' },
        applicationService: {
          id: 'svc-1',
          name: 'web',
          applicationId: 'app-1',
          environmentId: 'env-prod',
          serverId: 'server-1',
          deployConfig: null,
          application: { id: 'app-1', name: 'Example App' },
        },
      })
      .mockResolvedValueOnce(null);
    prisma.deploymentRun.create.mockResolvedValue({ id: 'rollback-live-1' });
    prisma.deploymentRun.update.mockResolvedValue({
      id: 'rollback-live-1',
      status: 'completed',
      dryRun: false,
      mode: 'rollback',
      targetType: 'server',
      healthCheckUrl: 'https://example.com/health',
      error: null,
      params: {
        rollbackSourceRunId: 'deploy-good-previous',
        rollbackTargetCommitSha: 'abc123456789',
        postRollbackSmokeCheck: {
          enabled: true,
          dryRun: true,
          queue: true,
          maxAttempts: 2,
        },
      },
    });
    operationApprovalService.resolveApproved.mockResolvedValue({ id: 'approval-1' });
    operationApprovalService.consume.mockResolvedValue({ id: 'approval-1' });
    serverExecutor.resolveTarget.mockResolvedValue({ transport: 'ssh', serverId: 'server-1' });
    serverExecutor.execute.mockResolvedValue({
      status: 'completed',
      commandPlan: { steps: [] },
      logs: [],
      result: { mode: 'executed' },
      error: undefined,
    });
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });
    const smokeCheckRun = jest
      .spyOn(service, 'smokeCheckRun')
      .mockResolvedValue({ id: 'post-rollback-smoke', status: 'queued' } as never);

    await expect(service.rollbackRun('team-1', 'user-1', 'deploy-good-previous', {
      dryRun: false,
      confirmationText: 'Example App',
      postRollbackSmokeCheck: true,
      postRollbackSmokeQueue: true,
      postRollbackSmokeMaxAttempts: 2,
    })).resolves.toEqual(expect.objectContaining({ id: 'rollback-live-1' }));

    expect(prisma.deploymentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mode: 'rollback',
        dryRun: false,
        params: expect.objectContaining({
          rollbackSourceRunId: 'deploy-good-previous',
          rollbackTargetCommitSha: 'abc123456789',
          postRollbackSmokeCheck: {
            enabled: true,
            dryRun: true,
            queue: true,
            maxAttempts: 2,
          },
        }),
      }),
    });
    expect(smokeCheckRun).toHaveBeenCalledWith('team-1', 'user-1', 'rollback-live-1', {
      dryRun: true,
      queue: true,
      maxAttempts: 2,
      healthCheckUrl: 'https://example.com/health',
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deployment.post_rollback_smoke_check',
      risk: 'low',
      status: 'queued',
      deploymentRunId: 'rollback-live-1',
      metadata: expect.objectContaining({
        smokeRunId: 'post-rollback-smoke',
      }),
    }));
  });

  it('processes completed live rollback runs with post-rollback smoke policy idempotently', async () => {
    prisma.deploymentRun.findMany.mockResolvedValue([
      {
        id: 'rollback-live-1',
        teamId: 'team-1',
        actorId: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
        healthCheckUrl: 'https://example.com/health',
        params: {
          postRollbackSmokeCheck: {
            enabled: true,
            dryRun: true,
            queue: true,
            maxAttempts: 2,
            healthCheckUrl: 'https://override.example.com/health',
          },
        },
      },
      {
        id: 'rollback-no-policy',
        teamId: 'team-1',
        actorId: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
        healthCheckUrl: 'https://example.com/health',
        params: {},
      },
    ]);
    prisma.deploymentRun.findFirst.mockResolvedValue(null);
    const smokeCheckRun = jest
      .spyOn(service, 'smokeCheckRun')
      .mockResolvedValue({ id: 'post-rollback-smoke', status: 'queued' } as never);
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });

    await expect(service.processPostRollbackSmokeChecks({ teamId: 'team-1', userId: 'system', limit: 5 }))
      .resolves
      .toEqual({
        scanned: 2,
        attempted: 1,
        created: 1,
        skipped: 1,
        failed: 0,
        results: [
          {
            status: 'created',
            rollbackRunId: 'rollback-live-1',
            smokeRunId: 'post-rollback-smoke',
          },
          {
            status: 'skipped',
            rollbackRunId: 'rollback-no-policy',
            reason: 'post-rollback smoke policy disabled',
          },
        ],
      });

    expect(prisma.deploymentRun.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        mode: 'rollback',
        status: 'completed',
        dryRun: false,
      },
      orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        teamId: true,
        actorId: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        healthCheckUrl: true,
        params: true,
      },
    });
    expect(smokeCheckRun).toHaveBeenCalledWith('team-1', 'system', 'rollback-live-1', {
      dryRun: true,
      queue: true,
      maxAttempts: 2,
      healthCheckUrl: 'https://override.example.com/health',
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deployment.post_rollback_smoke_check',
      status: 'queued',
      deploymentRunId: 'rollback-live-1',
    }));
  });

  it('creates a low-risk dry-run smoke check from a completed deployment run', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-completed-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      applicationId: 'app-1',
      applicationServiceId: 'svc-1',
      serverId: 'server-1',
      environment: 'prod',
      mode: 'deploy',
      source: 'webhook',
      trigger: 'git_push',
      targetType: 'server',
      dryRun: false,
      status: 'completed',
      gitRepo: 'git@example.com:repo/app.git',
      branch: 'main',
      commitSha: 'abc123456789',
      healthCheckUrl: 'https://example.com/health',
      project: { id: 'project-1', name: 'Example App' },
    });
    prisma.deploymentRun.create.mockResolvedValue({ id: 'smoke-run-1' });
    prisma.deploymentRun.update.mockResolvedValue({
      id: 'smoke-run-1',
      status: 'completed',
      mode: 'smoke_check',
      error: null,
    });
    serverExecutor.resolveTarget.mockResolvedValue({ transport: 'ssh', serverId: 'server-1' });
    serverExecutor.execute.mockResolvedValue({
      status: 'completed',
      commandPlan: { steps: [] },
      logs: [],
      result: { mode: 'dry_run' },
      error: undefined,
    });
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });

    await expect(service.smokeCheckRun('team-1', 'user-1', 'run-completed-1', {}))
      .resolves
      .toEqual(expect.objectContaining({ id: 'smoke-run-1' }));

    expect(prisma.deploymentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: 'team-1',
        actorId: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-prod',
        applicationServiceId: 'svc-1',
        sourceRunId: 'run-completed-1',
        mode: 'smoke_check',
        trigger: 'manual_smoke_check',
        dryRun: true,
        status: 'running',
        healthCheckUrl: 'https://example.com/health',
      }),
    });
    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'deployment.smoke_check',
      adapterKey: 'deployment-script-plan',
      dryRun: true,
      target: { transport: 'ssh', serverId: 'server-1' },
      steps: [
        expect.objectContaining({
          key: 'deployment_smoke_check',
          command: 'curl -fsS https://example.com/health',
          risk: 'low',
        }),
      ],
      metadata: expect.objectContaining({
        deploymentRunId: 'smoke-run-1',
        smokeSourceRunId: 'run-completed-1',
        healthCheckUrl: 'https://example.com/health',
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deployment.smoke_check',
      risk: 'low',
      status: 'completed',
      deploymentRunId: 'smoke-run-1',
    }));
  });

  it('queues a deployment smoke check through Server executor', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-completed-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      applicationId: null,
      applicationServiceId: null,
      serverId: 'server-1',
      environment: 'prod',
      mode: 'rollback',
      source: 'manual',
      trigger: 'manual_rollback',
      targetType: 'server',
      dryRun: true,
      status: 'completed',
      gitRepo: null,
      branch: null,
      commitSha: 'abc123456789',
      healthCheckUrl: 'https://example.com/health',
      project: { id: 'project-1', name: 'Example App' },
    });
    prisma.deploymentRun.create.mockResolvedValue({ id: 'smoke-run-queued' });
    prisma.deploymentRun.update.mockResolvedValue({
      id: 'smoke-run-queued',
      status: 'queued',
      serverExecutionJobId: 'job-1',
    });
    serverExecutor.resolveTarget.mockResolvedValue({ transport: 'ssh', serverId: 'server-1' });
    serverExecutor.queueExecution.mockResolvedValue({
      status: 'queued',
      serverExecutionJobId: 'job-1',
      commandPlan: { steps: [] },
      logs: [],
      result: { mode: 'queued' },
      error: undefined,
    });
    auditEventService.create.mockResolvedValue({ id: 'audit-1' });

    await service.smokeCheckRun('team-1', 'user-1', 'run-completed-1', {
      queue: true,
      maxAttempts: 2,
    });

    expect(serverExecutor.queueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        operationKey: 'deployment.smoke_check',
        metadata: expect.objectContaining({
          deploymentRunId: 'smoke-run-queued',
          businessRunSync: 'deployment',
        }),
      }),
      { maxAttempts: 2 },
    );
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'deployment.smoke_check.queue',
      status: 'queued',
      metadata: expect.objectContaining({
        serverExecutionJobId: 'job-1',
      }),
    }));
  });

  it('rejects smoke check when the completed run has no health check URL', async () => {
    prisma.deploymentRun.findFirst.mockResolvedValue({
      id: 'run-completed-no-health',
      mode: 'deploy',
      status: 'completed',
      healthCheckUrl: null,
    });

    await expect(service.smokeCheckRun('team-1', 'user-1', 'run-completed-no-health', {}))
      .rejects
      .toThrow(BadRequestException);
  });
});
