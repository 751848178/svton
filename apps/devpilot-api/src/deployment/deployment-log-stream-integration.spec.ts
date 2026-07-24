import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor';
import { DeploymentService } from './deployment.service';
import {
  DeploymentLogStreamBootstrapService,
  DeploymentLogStreamContext,
} from './deployment-log-stream-bootstrap.service';

/**
 * Integration coverage for the auto-create-docker-log-stream hook inside
 * DeploymentService.createRun. The hook must:
 *  - create a stream after a completed live (non-dry-run) deployment
 *  - NOT create one for a dry-run
 *  - NOT fail the deployment when stream creation throws
 */
describe('DeploymentService createRun log-stream auto-create', () => {
  function build(prismaOverrides: Record<string, unknown> = {}) {
    const deploymentRun = {
      create: jest.fn().mockImplementation((args: { data: { id?: string } }) => ({
        id: args.data.id ?? 'run-1',
        status: 'running',
        teamId: 'team-1',
        projectId: 'project-1',
        ...args.data,
      })),
      // Echo the execution status written into data.status so the auto-create
      // gate sees the real terminal status (completed/failed).
      update: jest.fn().mockImplementation((args: { data: { status?: string } }) => ({
        id: 'run-1',
        status: args.data.status ?? 'completed',
        dryRun: false,
      })),
    };
    const prisma = {
      deploymentRun,
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          teamId: 'team-1',
          name: 'Demo',
          gitRepo: 'git@example.com:demo.git',
          config: { managementScope: 'full' },
        }),
      },
      applicationService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'svc-1',
          name: 'api',
          applicationId: 'app-1',
          environmentId: 'env-1',
          serverId: 'server-1',
          deployConfig: { containerName: 'api-container' },
          application: { id: 'app-1', name: 'Demo App' },
        }),
      },
      projectEnvironment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'env-1',
          key: 'prod',
          name: 'prod',
          status: 'active',
        }),
      },
      application: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app-1',
          name: 'Demo App',
        }),
      },
      resourceInstance: { findMany: jest.fn().mockResolvedValue([]) },
      secretKey: { findMany: jest.fn().mockResolvedValue([]) },
      ...prismaOverrides,
    };

    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({ id: 'server-1' }),
      execute: jest.fn(),
      queueExecution: jest.fn(),
    };
    const auditEventService = { create: jest.fn().mockResolvedValue(undefined) };
    const operationApprovalService = {
      resolveApproved: jest.fn().mockResolvedValue({ id: 'approval-1', status: 'approved' }),
      createPending: jest.fn(),
      consume: jest.fn().mockResolvedValue(undefined),
    };

    const ensureDockerLogStream = jest.fn().mockResolvedValue({ id: 'stream-new' });
    const logStreamBootstrap = {
      ensureDockerLogStream,
    } as unknown as DeploymentLogStreamBootstrapService;

    const service = new DeploymentService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      auditEventService as unknown as AuditEventService,
      operationApprovalService as unknown as OperationApprovalService,
      { decrypt: jest.fn() } as unknown as never,
      { decryptCbc: jest.fn() } as unknown as never,
      logStreamBootstrap,
    );

    return {
      service,
      prisma,
      serverExecutor,
      operationApprovalService,
      ensureDockerLogStream,
    };
  }

  const baseDto = {
    applicationServiceId: 'svc-1',
    environmentId: 'env-1',
    overrides: {},
  };

  it('auto-creates a docker log stream after a completed live deployment', async () => {
    const { service, serverExecutor, ensureDockerLogStream } = build();
    serverExecutor.execute.mockResolvedValue({ status: 'completed' });

    await service.createRun('team-1', 'user-1', 'project-1', {
      ...baseDto,
      dryRun: false,
    } as never);

    expect(ensureDockerLogStream).toHaveBeenCalledTimes(1);
    const ctx = ensureDockerLogStream.mock.calls[0][0] as DeploymentLogStreamContext;
    expect(ctx).toEqual(
      expect.objectContaining({
        teamId: 'team-1',
        actorId: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        applicationServiceName: 'api',
        serverId: 'server-1',
        deployConfig: { containerName: 'api-container' },
      }),
    );
  });

  it('does NOT auto-create a stream for a dry-run deployment', async () => {
    const { service, serverExecutor, ensureDockerLogStream } = build();
    serverExecutor.execute.mockResolvedValue({ status: 'completed' });

    await service.createRun('team-1', 'user-1', 'project-1', {
      ...baseDto,
      dryRun: true,
    } as never);

    expect(ensureDockerLogStream).not.toHaveBeenCalled();
  });

  it('does NOT auto-create a stream when the deployment fails', async () => {
    const { service, serverExecutor, ensureDockerLogStream } = build();
    serverExecutor.execute.mockResolvedValue({ status: 'failed' });

    await service.createRun('team-1', 'user-1', 'project-1', {
      ...baseDto,
      dryRun: false,
    } as never);

    expect(ensureDockerLogStream).not.toHaveBeenCalled();
  });

  it('still completes the deployment when log-stream creation throws', async () => {
    const { service, serverExecutor, ensureDockerLogStream } = build();
    serverExecutor.execute.mockResolvedValue({ status: 'completed' });
    ensureDockerLogStream.mockRejectedValue(new Error('log-center down'));

    const result = await service.createRun('team-1', 'user-1', 'project-1', {
      ...baseDto,
      dryRun: false,
    } as never);

    // The run was still recorded as completed; the bootstrap error was swallowed.
    expect(result).toEqual(expect.objectContaining({ status: 'completed' }));
    expect(ensureDockerLogStream).toHaveBeenCalled();
  });

  it('does NOT auto-create a stream when no application service is bound', async () => {
    const { service, serverExecutor, ensureDockerLogStream } = build();
    serverExecutor.execute.mockResolvedValue({ status: 'completed' });

    await service.createRun('team-1', 'user-1', 'project-1', {
      applicationId: 'app-1',
      environmentId: 'env-1',
      overrides: {},
      dryRun: false,
    } as never);

    expect(ensureDockerLogStream).not.toHaveBeenCalled();
  });
});
