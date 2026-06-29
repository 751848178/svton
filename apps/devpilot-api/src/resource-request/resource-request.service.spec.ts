import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcePoolService } from '../resource-pool/resource-pool.service';
import { ServerExecutorService } from '../server-executor/server-executor.service';
import { ResourceRequestService } from './resource-request.service';

describe('ResourceRequestService provisioning processors', () => {
  it('auto-completes approved pool requests through resource pool allocation', async () => {
    const { prisma, resourcePoolService, service } = createService();
    const existing = resourceRequest({
      spec: { database: 'app_dev' },
      resourceType: { provisioningMode: 'pool' },
    });
    const approved = { ...existing, status: 'approved' };
    const completed = {
      ...approved,
      status: 'completed',
      result: { provisioning: { mode: 'pool', status: 'completed' } },
      instance: { id: 'instance-1', name: 'app_dev', status: 'active' },
    };

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceRequest.update
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(completed);
    prisma.resourceType.findUnique.mockResolvedValue(resourceType({
      provisioningMode: 'pool',
      provisioningConfig: { poolId: 'pool-1' },
    }));
    prisma.resourceInstance.create.mockResolvedValue({
      id: 'instance-1',
      name: 'app_dev',
      status: 'active',
      credentials: 'encrypted',
    });
    resourcePoolService.allocateResource.mockResolvedValue({
      id: 'alloc-1',
      type: 'mysql',
      resourceName: 'app_dev',
      credentials: {
        host: 'mysql.internal',
        port: 3306,
        database: 'app_dev',
        username: 'app_user',
        password: 'super-secret',
      },
    });

    const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

    expect(result.status).toBe('completed');
    expect(resourcePoolService.allocateResource).toHaveBeenCalledWith(
      { poolId: 'pool-1', projectId: 'project-1', resourceName: 'app_dev' },
      'admin-1',
      'team-1',
    );
    expect(prisma.resourceInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'app_dev',
        config: expect.objectContaining({
          provisioningMode: 'pool',
          poolAllocationId: 'alloc-1',
        }),
        delivery: expect.objectContaining({
          host: 'mysql.internal',
          port: 3306,
          database: 'app_dev',
          username: 'app_user',
          poolAllocationId: 'alloc-1',
          resourceName: 'app_dev',
        }),
        credentials: expect.any(String),
      }),
      include: expect.any(Object),
    }));
    const instanceCreate = prisma.resourceInstance.create.mock.calls[0][0].data;
    expect(instanceCreate.delivery).not.toHaveProperty('password');
    const completion = prisma.resourceRequest.update.mock.calls[1][0].data;
    expect(completion.result.provisioning).toEqual(expect.objectContaining({
      mode: 'pool',
      status: 'completed',
      boundary: 'resource_pool',
      allocationId: 'alloc-1',
    }));
    expect(JSON.stringify(completion.result)).not.toContain('super-secret');
    expect(auditActions(prisma)).toEqual(expect.arrayContaining(['request.approved', 'request.completed']));
  });

  it('keeps manual requests approved for human delivery', async () => {
    const { prisma, resourcePoolService, service } = createService();
    const existing = resourceRequest({ resourceType: { provisioningMode: 'manual' } });
    const approved = { ...existing, status: 'approved' };

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceRequest.update.mockResolvedValueOnce(approved);
    prisma.resourceType.findUnique.mockResolvedValue(resourceType({ provisioningMode: 'manual' }));

    const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

    expect(result).toEqual(approved);
    expect(resourcePoolService.allocateResource).not.toHaveBeenCalled();
    expect(prisma.resourceInstance.create).not.toHaveBeenCalled();
    expect(prisma.resourceRequest.update).toHaveBeenCalledTimes(1);
  });

  it('executes script provisioning through ServerExecutor dry-run and keeps delivery pending', async () => {
    const { prisma, resourcePoolService, serverExecutor, service } = createService();
    const existing = resourceRequest({ resourceType: { provisioningMode: 'script' } });
    const approved = { ...existing, status: 'approved' };
    const planned = {
      ...approved,
      result: { provisioning: { mode: 'script', status: 'planned', boundary: 'server_executor' } },
    };

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceRequest.update
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(planned);
    prisma.resourceType.findUnique.mockResolvedValue(resourceType({
      provisioningMode: 'script',
      provisioningConfig: { command: 'echo provision', dryRun: true },
    }));
    serverExecutor.execute.mockResolvedValue({
      status: 'completed',
      mode: 'dry_run',
      executorKey: 'server-executor',
      adapterKey: 'resource-provisioning-script',
      executable: true,
      warnings: [],
      commandSteps: [{ key: 'provision', label: '资源交付脚本', command: 'echo provision', required: true }],
      commandPlan: {},
      logs: [],
      result: {},
    });

    const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

    expect(result).toEqual(planned);
    expect(resourcePoolService.allocateResource).not.toHaveBeenCalled();
    expect(serverExecutor.resolveTarget).toHaveBeenCalledWith('team-1', null);
    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      userId: 'admin-1',
      operationKey: 'resource.provision.mysql',
      adapterKey: 'resource-provisioning-script',
      dryRun: true,
      target: { transport: 'none', serverId: null },
      steps: [expect.objectContaining({ command: 'echo provision', required: true })],
    }));
    expect(prisma.resourceInstance.create).not.toHaveBeenCalled();
    expect(prisma.resourceRequest.update.mock.calls[1][0].data.result.provisioning).toEqual(expect.objectContaining({
      mode: 'script',
      status: 'planned',
      boundary: 'server_executor',
      executorStatus: 'completed',
      executionMode: 'dry_run',
      requiresManualCompletion: true,
    }));
    expect(auditActions(prisma)).toEqual(expect.arrayContaining(['request.approved', 'provisioning.planned']));
  });

  it('completes api provisioning with redacted TeamCredential ref and idempotency headers', async () => {
    const { prisma, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue('application/json') },
      json: jest.fn().mockResolvedValue({
        providerRunId: 'run-1',
        instanceName: 'api-db',
        delivery: {
          host: 'mysql.internal',
          port: 3306,
          database: 'app_dev',
          username: 'app_user',
        },
        credentials: { password: 'super-secret' },
      }),
      text: jest.fn(),
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    try {
      const existing = resourceRequest({
        spec: { database: 'app_dev' },
        resourceType: { provisioningMode: 'api' },
      });
      const approved = { ...existing, status: 'approved' };
      const completed = {
        ...approved,
        status: 'completed',
        result: { provisioning: { mode: 'api', status: 'completed' } },
        instance: { id: 'instance-1', name: 'api-db', status: 'active' },
      };

      prisma.resourceRequest.findFirst.mockResolvedValue(existing);
      prisma.resourceRequest.update
        .mockResolvedValueOnce(approved)
        .mockResolvedValueOnce(completed);
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api?token=raw-token',
          credentialId: 'credential-1',
          credentialType: 'cloud_aliyun',
          idempotencyPrefix: 'resource-provisioning',
          headers: { Authorization: 'Bearer raw-token' },
        },
      }));
      prisma.teamCredential.findFirst.mockResolvedValue({
        id: 'credential-1',
        name: 'Aliyun prod',
        type: 'cloud_aliyun',
      });
      prisma.resourceInstance.create.mockResolvedValue({
        id: 'instance-1',
        name: 'api-db',
        status: 'active',
        credentials: 'encrypted',
      });

      const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

      expect(result.status).toBe('completed');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://provision.example/api?token=raw-token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer raw-token',
            'content-type': 'application/json',
            'idempotency-key': 'resource-provisioning:request-1:type-mysql:mysql:api',
            'x-devpilot-idempotency-key': 'resource-provisioning:request-1:type-mysql:mysql:api',
            'x-devpilot-credential-id': 'credential-1',
            'x-devpilot-credential-type': 'cloud_aliyun',
            'x-devpilot-auth-adapter': 'cloud_aliyun-credential-ref',
          }),
          body: expect.any(String),
        }),
      );
      const fetchBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(fetchBody.request).toEqual(expect.objectContaining({
        id: 'request-1',
        projectId: 'project-1',
        environmentId: 'env-dev',
      }));
      expect(fetchBody.adapter).toEqual(expect.objectContaining({
        boundary: 'http_adapter',
        idempotencyKey: 'resource-provisioning:request-1:type-mysql:mysql:api',
        credentialRef: expect.objectContaining({
          source: 'team_credential',
          referenceId: 'credential-1',
          credentialType: 'cloud_aliyun',
          redacted: true,
        }),
      }));
      expect(prisma.resourceInstance.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'api-db',
          delivery: expect.objectContaining({
            host: 'mysql.internal',
            username: 'app_user',
          }),
          credentials: expect.any(String),
        }),
        include: expect.any(Object),
      }));
      const instanceCreate = prisma.resourceInstance.create.mock.calls[0][0].data;
      expect(instanceCreate.delivery).not.toHaveProperty('password');
      const completion = prisma.resourceRequest.update.mock.calls[1][0].data;
      expect(completion.result.provisioning).toEqual(expect.objectContaining({
        mode: 'api',
        status: 'completed',
        boundary: 'http_adapter',
        provisioningRunId: 'provisioning-run-1',
        providerRunId: 'run-1',
        idempotencyKey: 'resource-provisioning:request-1:type-mysql:mysql:api',
        credentialRef: expect.objectContaining({
          referenceId: 'credential-1',
          credentialType: 'cloud_aliyun',
          redacted: true,
        }),
        url: 'https://provision.example/api?token=redacted',
      }));
      expect(JSON.stringify(completion.result)).not.toContain('super-secret');
      expect(JSON.stringify(completion.result)).not.toContain('raw-token');
      expect(JSON.stringify(completion.result)).not.toContain('Bearer');
      expect(prisma.resourceProvisioningRun.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          teamId: 'team-1',
          actorId: 'admin-1',
          requestId: 'request-1',
          resourceTypeId: 'type-mysql',
          projectId: 'project-1',
          environmentId: 'env-dev',
          mode: 'api',
          trigger: 'approval',
          boundary: 'http_adapter',
          executorKey: 'resource-request',
          adapterKey: 'api',
          idempotencyKey: 'resource-provisioning:request-1:type-mysql:mysql:api',
          status: 'running',
          maxAttempts: 1,
          params: expect.objectContaining({
            url: 'https://provision.example/api?token=redacted',
            idempotencyKey: 'resource-provisioning:request-1:type-mysql:mysql:api',
          }),
        }),
      }));
      expect(JSON.stringify(prisma.resourceProvisioningRun.create.mock.calls[0][0].data)).not.toContain('raw-token');
      expect(prisma.resourceProvisioningRun.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'provisioning-run-1' },
        data: expect.objectContaining({
          credentialId: 'credential-1',
          authAdapterKey: 'cloud_aliyun-credential-ref',
        }),
      }));
      expect(prisma.resourceProvisioningRun.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'provisioning-run-1' },
        data: expect.objectContaining({
          status: 'completed',
          providerRunId: 'run-1',
          attempt: 1,
          maxAttempts: 1,
          retryable: false,
          result: expect.objectContaining({
            provisioning: expect.objectContaining({
              provisioningRunId: 'provisioning-run-1',
              providerRunId: 'run-1',
            }),
          }),
        }),
      }));
      const completionAudit = prisma.resourceAuditLog.create.mock.calls.find(
        (call) => call[0].data.action === 'request.completed',
      );
      expect(completionAudit?.[0].data.provisioningRunId).toBe('provisioning-run-1');
      expect(auditActions(prisma)).toEqual(expect.arrayContaining(['request.approved', 'request.completed']));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('retries transient HTTP provisioning failures with the same idempotency key', async () => {
    const { prisma, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: { get: jest.fn().mockReturnValue('application/json') },
        json: jest.fn().mockResolvedValue({ message: 'temporary outage' }),
        text: jest.fn(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: jest.fn().mockReturnValue('application/json') },
        json: jest.fn().mockResolvedValue({
          providerRunId: 'run-2',
          delivery: { host: 'mysql.internal', database: 'retry_dev' },
        }),
        text: jest.fn(),
      });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    try {
      const existing = resourceRequest({
        spec: { database: 'retry_dev' },
        resourceType: { provisioningMode: 'api' },
      });
      const approved = { ...existing, status: 'approved' };
      const completed = {
        ...approved,
        status: 'completed',
        result: { provisioning: { mode: 'api', status: 'completed' } },
        instance: { id: 'instance-1', name: 'retry_dev', status: 'active' },
      };

      prisma.resourceRequest.findFirst.mockResolvedValue(existing);
      prisma.resourceRequest.update
        .mockResolvedValueOnce(approved)
        .mockResolvedValueOnce(completed);
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api',
          maxAttempts: 2,
        },
      }));
      prisma.resourceInstance.create.mockResolvedValue({
        id: 'instance-1',
        name: 'retry_dev',
        status: 'active',
      });

      const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

      expect(result.status).toBe('completed');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].headers['idempotency-key']).toBe('resource-request:request-1:type-mysql:mysql:api');
      expect(fetchMock.mock.calls[1][1].headers['idempotency-key']).toBe('resource-request:request-1:type-mysql:mysql:api');
      const completion = prisma.resourceRequest.update.mock.calls[1][0].data;
      expect(completion.result.provisioning).toEqual(expect.objectContaining({
        mode: 'api',
        status: 'completed',
        providerRunId: 'run-2',
        attempt: 2,
        maxAttempts: 2,
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
      }));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('records auto retry metadata for retryable HTTP provisioning blocks', async () => {
    const { prisma, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: jest.fn().mockReturnValue('application/json') },
      json: jest.fn().mockResolvedValue({ message: 'temporary outage' }),
      text: jest.fn(),
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    try {
      const existing = resourceRequest({
        spec: { database: 'retry_dev' },
        resourceType: { provisioningMode: 'api' },
      });
      const approved = { ...existing, status: 'approved' };
      const blocked = {
        ...approved,
        result: { provisioning: { mode: 'api', status: 'blocked', reason: 'temporary outage' } },
      };

      prisma.resourceRequest.findFirst.mockResolvedValue(existing);
      prisma.resourceRequest.update
        .mockResolvedValueOnce(approved)
        .mockResolvedValueOnce(blocked);
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api',
          maxAttempts: 1,
          autoRetry: {
            enabled: true,
            delaySeconds: 30,
            maxScheduledAttempts: 2,
          },
        },
      }));

      const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

      expect(result).toEqual(blocked);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const provisioning = prisma.resourceRequest.update.mock.calls[1][0].data.result.provisioning;
      expect(provisioning).toEqual(expect.objectContaining({
        mode: 'api',
        status: 'blocked',
        boundary: 'http_adapter',
        provisioningRunId: 'provisioning-run-1',
        retryable: true,
        attemptsExhausted: true,
        autoRetry: expect.objectContaining({
          enabled: true,
          retryable: true,
          scheduledAttempts: 0,
          maxScheduledAttempts: 2,
          delaySeconds: 30,
          exhausted: false,
          nextAttemptAt: expect.any(String),
        }),
      }));
      expect(prisma.resourceProvisioningRun.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'provisioning-run-1' },
        data: expect.objectContaining({
          status: 'blocked',
          attempt: 1,
          maxAttempts: 1,
          retryable: true,
          autoRetry: true,
          error: 'temporary outage',
          result: expect.objectContaining({
            provisioning: expect.objectContaining({
              provisioningRunId: 'provisioning-run-1',
              autoRetry: expect.objectContaining({
                enabled: true,
              }),
            }),
          }),
        }),
      }));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('processes due HTTP provisioning auto retries through the current adapter', async () => {
    const { prisma, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue('application/json') },
      json: jest.fn().mockResolvedValue({
        providerRunId: 'auto-retry-run-1',
        instanceName: 'auto-retry-db',
        delivery: { host: 'mysql.internal', database: 'retry_dev' },
      }),
      text: jest.fn(),
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    try {
      const existing = resourceRequest({
        status: 'approved',
        spec: { database: 'retry_dev' },
        result: {
          provisioning: {
            mode: 'api',
            status: 'blocked',
            boundary: 'http_adapter',
            reason: 'temporary outage',
            retryable: true,
            idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
            autoRetry: {
              enabled: true,
              retryable: true,
              scheduledAttempts: 0,
              maxScheduledAttempts: 2,
              nextAttemptAt: '2026-06-29T00:00:00.000Z',
            },
          },
        },
        resourceType: { provisioningMode: 'api' },
      });
      const completed = {
        ...existing,
        status: 'completed',
        result: { provisioning: { mode: 'api', status: 'completed' } },
        instance: { id: 'instance-1', name: 'auto-retry-db', status: 'active' },
      };

      prisma.resourceRequest.findMany.mockResolvedValue([existing]);
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api',
          maxAttempts: 1,
          autoRetry: { enabled: true },
        },
      }));
      prisma.resourceInstance.create.mockResolvedValue({
        id: 'instance-1',
        name: 'auto-retry-db',
        status: 'active',
      });
      prisma.resourceRequest.update.mockResolvedValueOnce(completed);

      const summary = await service.processDueProvisioningAutoRetries({
        limit: 5,
        now: new Date('2026-06-29T00:00:01.000Z'),
      });

      expect(summary).toEqual({
        scanned: 1,
        attempted: 1,
        completed: 1,
        blocked: 0,
        skipped: 0,
        failed: 0,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://provision.example/api',
        expect.objectContaining({
          headers: expect.objectContaining({
            'idempotency-key': 'resource-request:request-1:type-mysql:mysql:api',
          }),
        }),
      );
      const completion = prisma.resourceRequest.update.mock.calls[0][0].data;
      expect(completion.result.provisioning).toEqual(expect.objectContaining({
        status: 'completed',
        providerRunId: 'auto-retry-run-1',
      }));
      const autoRetryAudit = prisma.resourceAuditLog.create.mock.calls.find(
        (call) => call[0].data.action === 'provisioning.auto_retry_requested',
      );
      expect(autoRetryAudit?.[0].data.actorId).toBeUndefined();
      expect(auditActions(prisma)).toEqual(expect.arrayContaining([
        'provisioning.auto_retry_requested',
        'request.completed',
      ]));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('blocks HTTP provisioning before dispatch when a required TeamCredential is missing', async () => {
    const { prisma, resourcePoolService, serverExecutor, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    const existing = resourceRequest({ resourceType: { provisioningMode: 'api' } });
    const approved = { ...existing, status: 'approved' };
    const blocked = {
      ...approved,
      result: { provisioning: { mode: 'api', status: 'blocked', reason: 'missing_credential' } },
    };

    try {
      prisma.resourceRequest.findFirst.mockResolvedValue(existing);
      prisma.resourceRequest.update
        .mockResolvedValueOnce(approved)
        .mockResolvedValueOnce(blocked);
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api',
          requireCredential: true,
        },
      }));

      const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

      expect(result).toEqual(blocked);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(resourcePoolService.allocateResource).not.toHaveBeenCalled();
      expect(serverExecutor.execute).not.toHaveBeenCalled();
      expect(prisma.teamCredential.findFirst).not.toHaveBeenCalled();
      expect(prisma.resourceRequest.update.mock.calls[1][0].data.result.provisioning).toEqual(expect.objectContaining({
        mode: 'api',
        status: 'blocked',
        boundary: 'http_adapter',
        reason: '外部资源交付需要绑定 TeamCredential',
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
      }));
      expect(auditActions(prisma)).toEqual(expect.arrayContaining(['request.approved', 'provisioning.blocked']));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('blocks webhook provisioning when HTTP adapter config is incomplete', async () => {
    const { prisma, resourcePoolService, serverExecutor, service } = createService({ httpEnabled: true });
    const existing = resourceRequest({ resourceType: { provisioningMode: 'webhook' } });
    const approved = { ...existing, status: 'approved' };
    const blocked = {
      ...approved,
      result: { provisioning: { mode: 'webhook', status: 'blocked', reason: 'missing_url' } },
    };

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceRequest.update
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(blocked);
    prisma.resourceType.findUnique.mockResolvedValue(resourceType({
      provisioningMode: 'webhook',
      provisioningConfig: {},
    }));

    const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

    expect(result).toEqual(blocked);
    expect(resourcePoolService.allocateResource).not.toHaveBeenCalled();
    expect(serverExecutor.execute).not.toHaveBeenCalled();
    expect(prisma.resourceInstance.create).not.toHaveBeenCalled();
    expect(prisma.resourceRequest.update.mock.calls[1][0].data.result.provisioning).toEqual(expect.objectContaining({
      mode: 'webhook',
      status: 'blocked',
      boundary: 'http_adapter',
      reason: 'missing_url',
    }));
    expect(auditActions(prisma)).toEqual(expect.arrayContaining(['request.approved', 'provisioning.blocked']));
  });

  it('blocks pool provisioning when the resource type has no pool configured', async () => {
    const { prisma, resourcePoolService, service } = createService();
    const existing = resourceRequest({ resourceType: { provisioningMode: 'pool' } });
    const approved = { ...existing, status: 'approved' };
    const blocked = {
      ...approved,
      result: { provisioning: { mode: 'pool', status: 'blocked', reason: 'missing_pool_id' } },
    };

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceRequest.update
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(blocked);
    prisma.resourceType.findUnique.mockResolvedValue(resourceType({
      provisioningMode: 'pool',
      provisioningConfig: {},
    }));

    const result = await service.reviewRequest('team-1', 'admin-1', 'request-1', { status: 'approved' });

    expect(result).toEqual(blocked);
    expect(resourcePoolService.allocateResource).not.toHaveBeenCalled();
    expect(prisma.resourceInstance.create).not.toHaveBeenCalled();
    expect(prisma.resourceRequest.update.mock.calls[1][0].data.result.provisioning).toEqual(expect.objectContaining({
      mode: 'pool',
      status: 'blocked',
      boundary: 'resource_pool',
      reason: 'missing_pool_id',
    }));
    expect(auditActions(prisma)).toEqual(expect.arrayContaining(['request.approved', 'provisioning.blocked']));
  });

  it('retries blocked approved provisioning through the current external adapter', async () => {
    const { prisma, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue('application/json') },
      json: jest.fn().mockResolvedValue({
        providerRunId: 'retry-run-1',
        instanceName: 'retry-db',
        delivery: { host: 'mysql.internal', database: 'retry_dev' },
        credentials: { password: 'super-secret' },
      }),
      text: jest.fn(),
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    try {
      const existing = resourceRequest({
        status: 'approved',
        spec: { database: 'retry_dev' },
        result: {
          provisioning: {
            mode: 'api',
            status: 'blocked',
            boundary: 'http_adapter',
            reason: 'temporary outage',
            idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
          },
        },
        resourceType: { provisioningMode: 'api' },
      });
      const completed = {
        ...existing,
        status: 'completed',
        result: { provisioning: { mode: 'api', status: 'completed' } },
        instance: { id: 'instance-1', name: 'retry-db', status: 'active' },
      };

      prisma.resourceRequest.findFirst.mockResolvedValue(existing);
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api',
          maxAttempts: 1,
        },
      }));
      prisma.resourceInstance.create.mockResolvedValue({
        id: 'instance-1',
        name: 'retry-db',
        status: 'active',
        credentials: 'encrypted',
      });
      prisma.resourceRequest.update.mockResolvedValueOnce(completed);

      const result = await service.retryProvisioning('team-1', 'admin-1', 'request-1');

      expect(result.status).toBe('completed');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://provision.example/api',
        expect.objectContaining({
          headers: expect.objectContaining({
            'idempotency-key': 'resource-request:request-1:type-mysql:mysql:api',
          }),
        }),
      );
      const completion = prisma.resourceRequest.update.mock.calls[0][0].data;
      expect(completion.result.provisioning).toEqual(expect.objectContaining({
        mode: 'api',
        status: 'completed',
        providerRunId: 'retry-run-1',
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
      }));
      expect(JSON.stringify(completion.result)).not.toContain('super-secret');
      expect(auditActions(prisma)).toEqual(expect.arrayContaining([
        'provisioning.retry_requested',
        'request.completed',
      ]));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('rejects provisioning retry for requests that are already completed', async () => {
    const { prisma, service } = createService();
    const existing = resourceRequest({
      status: 'completed',
      result: { provisioning: { mode: 'api', status: 'completed' } },
      resourceType: { provisioningMode: 'api' },
    });

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);

    await expect(service.retryProvisioning('team-1', 'admin-1', 'request-1'))
      .rejects
      .toThrow('只有已审批且未交付的申请可以重试交付处理器');
    expect(prisma.resourceType.findUnique).not.toHaveBeenCalled();
    expect(prisma.resourceRequest.update).not.toHaveBeenCalled();
    expect(auditActions(prisma)).toEqual([]);
  });

  it('replays the current blocked provisioning run through the external adapter', async () => {
    const { prisma, service } = createService({ httpEnabled: true });
    const previousFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue('application/json') },
      json: jest.fn().mockResolvedValue({
        providerRunId: 'replay-run-1',
        instanceName: 'replay-db',
        delivery: { host: 'mysql.internal', database: 'replay_dev' },
      }),
      text: jest.fn(),
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    try {
      const existing = resourceRequest({
        status: 'approved',
        spec: { database: 'replay_dev' },
        result: {
          provisioning: {
            mode: 'api',
            status: 'blocked',
            boundary: 'http_adapter',
            reason: 'temporary outage',
            provisioningRunId: 'source-run-1',
            idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
          },
        },
        resourceType: { provisioningMode: 'api' },
      });
      const completed = {
        ...existing,
        status: 'completed',
        result: { provisioning: { mode: 'api', status: 'completed' } },
        instance: { id: 'instance-1', name: 'replay-db', status: 'active' },
      };

      prisma.resourceRequest.findFirst.mockResolvedValue(existing);
      prisma.resourceProvisioningRun.findFirst.mockResolvedValue({
        id: 'source-run-1',
        teamId: 'team-1',
        requestId: 'request-1',
        mode: 'api',
        status: 'blocked',
      });
      prisma.resourceType.findUnique.mockResolvedValue(resourceType({
        provisioningMode: 'api',
        provisioningConfig: {
          url: 'https://provision.example/api',
          maxAttempts: 1,
        },
      }));
      prisma.resourceInstance.create.mockResolvedValue({
        id: 'instance-1',
        name: 'replay-db',
        status: 'active',
      });
      prisma.resourceRequest.update.mockResolvedValueOnce(completed);

      const result = await service.replayProvisioningRun('team-1', 'admin-1', 'request-1', 'source-run-1');

      expect(result.status).toBe('completed');
      expect(prisma.resourceProvisioningRun.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          replayOfRunId: 'source-run-1',
          requestId: 'request-1',
          mode: 'api',
          trigger: 'manual_retry',
        }),
      }));
      const replayAudit = prisma.resourceAuditLog.create.mock.calls.find(
        (call) => call[0].data.action === 'provisioning.run_replay_requested',
      );
      expect(replayAudit?.[0].data.provisioningRunId).toBe('source-run-1');
      expect(replayAudit?.[0].data.metadata).toEqual(expect.objectContaining({
        replayOfRunId: 'source-run-1',
        replaySourceStatus: 'blocked',
      }));
      const completion = prisma.resourceRequest.update.mock.calls[0][0].data;
      expect(completion.result.provisioning).toEqual(expect.objectContaining({
        status: 'completed',
        providerRunId: 'replay-run-1',
        replayOfRunId: 'source-run-1',
      }));
    } finally {
      (globalThis as { fetch?: unknown }).fetch = previousFetch;
    }
  });

  it('rejects replaying a provisioning run that is no longer current for the request', async () => {
    const { prisma, service } = createService();
    const existing = resourceRequest({
      status: 'approved',
      result: {
        provisioning: {
          mode: 'api',
          status: 'blocked',
          provisioningRunId: 'newer-run-1',
        },
      },
      resourceType: { provisioningMode: 'api' },
    });

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceProvisioningRun.findFirst.mockResolvedValue({
      id: 'source-run-1',
      teamId: 'team-1',
      requestId: 'request-1',
      mode: 'api',
      status: 'blocked',
    });

    await expect(service.replayProvisioningRun('team-1', 'admin-1', 'request-1', 'source-run-1'))
      .rejects
      .toThrow('只能重放当前资源申请正在指向的交付运行');
    expect(prisma.resourceType.findUnique).not.toHaveBeenCalled();
    expect(prisma.resourceProvisioningRun.create).not.toHaveBeenCalled();
    expect(auditActions(prisma)).toEqual([]);
  });

  it('recovers stale current running provisioning runs and marks the request blocked', async () => {
    const { prisma, service } = createService();
    const now = new Date('2026-06-29T10:00:00.000Z');
    const existing = resourceRequest({
      status: 'approved',
      result: {
        provisioning: {
          mode: 'api',
          status: 'running',
          provisioningRunId: 'source-run-1',
          idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
        },
      },
      resourceType: { provisioningMode: 'api' },
    });
    const updated = {
      ...existing,
      result: {
        provisioning: {
          mode: 'api',
          status: 'blocked',
          provisioningRunId: 'source-run-1',
        },
      },
    };

    prisma.resourceProvisioningRun.findMany.mockResolvedValue([
      {
        id: 'source-run-1',
        teamId: 'team-1',
        requestId: 'request-1',
        resourceTypeId: 'type-mysql',
        mode: 'api',
        boundary: 'http_adapter',
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
        status: 'running',
        recoveryCount: 0,
        result: {},
        request: existing,
      },
    ]);
    prisma.resourceRequest.update.mockResolvedValueOnce(updated);

    const summary = await service.recoverStaleProvisioningRuns({
      limit: 5,
      staleAfterSeconds: 60,
      now,
    });

    expect(summary).toEqual({
      scanned: 1,
      recovered: 1,
      requestUpdated: 1,
      skipped: 0,
      failed: 0,
    });
    expect(prisma.resourceProvisioningRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'running',
        mode: { in: ['api', 'webhook'] },
        startedAt: { lt: new Date('2026-06-29T09:59:00.000Z') },
      },
      take: 5,
    }));
    expect(prisma.resourceProvisioningRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'source-run-1' },
      data: expect.objectContaining({
        status: 'failed',
        retryable: true,
        error: 'stale_running_recovered',
        recoveredAt: now,
        recoveryReason: 'stale_running_recovered',
        recoveryCount: 1,
      }),
    }));
    expect(prisma.resourceRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'request-1' },
      data: {
        result: expect.objectContaining({
          provisioning: expect.objectContaining({
            status: 'blocked',
            reason: 'stale_running_recovered',
            retryable: true,
            provisioningRunId: 'source-run-1',
          }),
        }),
      },
    }));
    expect(auditActions(prisma)).toEqual(expect.arrayContaining([
      'provisioning.run_stale_recovered',
      'provisioning.blocked',
    ]));
  });

  it('recovers stale historical running runs without rewriting a newer request state', async () => {
    const { prisma, service } = createService();
    const now = new Date('2026-06-29T10:00:00.000Z');
    const existing = resourceRequest({
      status: 'approved',
      result: {
        provisioning: {
          mode: 'api',
          status: 'blocked',
          provisioningRunId: 'newer-run-1',
        },
      },
      resourceType: { provisioningMode: 'api' },
    });

    prisma.resourceProvisioningRun.findMany.mockResolvedValue([
      {
        id: 'source-run-1',
        teamId: 'team-1',
        requestId: 'request-1',
        resourceTypeId: 'type-mysql',
        mode: 'api',
        boundary: 'http_adapter',
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
        status: 'running',
        recoveryCount: 2,
        result: {},
        request: existing,
      },
    ]);

    const summary = await service.recoverStaleProvisioningRuns({
      staleAfterSeconds: 60,
      now,
    });

    expect(summary).toEqual({
      scanned: 1,
      recovered: 1,
      requestUpdated: 0,
      skipped: 1,
      failed: 0,
    });
    expect(prisma.resourceProvisioningRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'failed',
        recoveryCount: 3,
      }),
    }));
    expect(prisma.resourceRequest.update).not.toHaveBeenCalled();
    expect(auditActions(prisma)).toEqual(['provisioning.run_stale_recovered']);
  });

  it('summarizes provisioning run supervisor state with stale samples', async () => {
    const { prisma, service } = createService({
      configValues: {
        RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED: 'true',
        RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED: 'true',
        RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_INTERVAL_SECONDS: '45',
      },
    });
    const startedAt = new Date('2026-06-29T09:00:00.000Z');
    const finishedAt = new Date('2026-06-29T09:05:00.000Z');

    prisma.resourceProvisioningRun.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);
    prisma.resourceProvisioningRun.findMany
      .mockResolvedValueOnce([
        {
          id: 'stale-run-1',
          requestId: 'request-1',
          resourceTypeId: 'type-mysql',
          mode: 'api',
          trigger: 'approval',
          boundary: 'http_adapter',
          executorKey: 'resource-request',
          adapterKey: 'api',
          idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
          status: 'running',
          startedAt,
          actor: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
          resourceType: { id: 'type-mysql', key: 'mysql', name: 'MySQL' },
          _count: { replayAttempts: 0 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'failed-run-1',
          requestId: 'request-1',
          resourceTypeId: 'type-mysql',
          mode: 'api',
          trigger: 'manual_retry',
          boundary: 'http_adapter',
          executorKey: 'resource-request',
          adapterKey: 'api',
          idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
          status: 'failed',
          error: 'stale_running_recovered',
          startedAt,
          finishedAt,
          resourceType: { id: 'type-mysql', key: 'mysql', name: 'MySQL' },
          _count: { replayAttempts: 1 },
        },
      ]);

    const result = await service.getProvisioningRunSupervisor('team-1', {
      staleAfterSeconds: '120',
      sampleLimit: '2',
    });

    expect(result).toEqual(expect.objectContaining({
      staleAfterSeconds: 120,
      scheduler: {
        autoRetryEnabled: true,
        staleRecoveryEnabled: true,
        intervalSeconds: 45,
      },
      counts: {
        running: 3,
        staleRunning: 2,
        planned: 1,
        blocked: 4,
        failed: 5,
        completed: 6,
      },
    }));
    expect(prisma.resourceProvisioningRun.count).toHaveBeenNthCalledWith(2, {
      where: {
        teamId: 'team-1',
        status: 'running',
        mode: { in: ['api', 'webhook'] },
        startedAt: { lt: expect.any(Date) },
      },
    });
    expect(prisma.resourceProvisioningRun.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        status: 'running',
      }),
      take: 2,
    }));
    expect(result.samples.staleRunning).toEqual([
      expect.objectContaining({ id: 'stale-run-1', status: 'running' }),
    ]);
    expect(result.samples.recentProblems).toEqual([
      expect.objectContaining({ id: 'failed-run-1', status: 'failed', replayAttemptsCount: 1 }),
    ]);
  });

  it('recovers stale provisioning runs within the current team for manual recovery', async () => {
    const { prisma, service } = createService();
    const existing = resourceRequest({
      status: 'approved',
      result: {
        provisioning: {
          mode: 'api',
          status: 'running',
          provisioningRunId: 'source-run-1',
        },
      },
      resourceType: { provisioningMode: 'api' },
    });

    prisma.resourceProvisioningRun.findMany.mockResolvedValue([
      {
        id: 'source-run-1',
        teamId: 'team-1',
        requestId: 'request-1',
        resourceTypeId: 'type-mysql',
        mode: 'api',
        boundary: 'http_adapter',
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
        status: 'running',
        recoveryCount: 0,
        result: {},
        request: existing,
      },
    ]);
    prisma.resourceRequest.update.mockResolvedValueOnce(existing);

    await service.recoverTeamStaleProvisioningRuns('team-1', {
      limit: '250',
      staleAfterSeconds: '30',
    });

    expect(prisma.resourceProvisioningRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        status: 'running',
        mode: { in: ['api', 'webhook'] },
      }),
      take: 100,
    }));
    expect(prisma.resourceProvisioningRun.findMany.mock.calls[0][0].where.startedAt.lt).toEqual(expect.any(Date));
    expect(prisma.resourceProvisioningRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'source-run-1' },
      data: expect.objectContaining({ status: 'failed' }),
    }));
  });

  it('lists provisioning runs for a resource request with bounded filters', async () => {
    const { prisma, service } = createService();
    const existing = resourceRequest({ status: 'approved' });
    const startedAt = new Date('2026-06-29T08:00:00.000Z');
    const finishedAt = new Date('2026-06-29T08:00:03.000Z');

    prisma.resourceRequest.findFirst.mockResolvedValue(existing);
    prisma.resourceProvisioningRun.findMany.mockResolvedValue([
      {
        id: 'provisioning-run-1',
        requestId: 'request-1',
        resourceTypeId: 'type-mysql',
        mode: 'api',
        trigger: 'manual_retry',
        boundary: 'http_adapter',
        executorKey: 'resource-request',
        adapterKey: 'api',
        authAdapterKey: 'cloud_aliyun-credential-ref',
        idempotencyKey: 'resource-request:request-1:type-mysql:mysql:api',
        providerRunId: 'provider-run-1',
        status: 'completed',
        attempt: 1,
        maxAttempts: 2,
        retryable: false,
        autoRetry: false,
        params: { url: 'https://provision.example/api?token=redacted' },
        result: { provisioning: { status: 'completed', deliveryKeys: ['host'] } },
        error: null,
        startedAt,
        finishedAt,
        createdAt: startedAt,
        updatedAt: finishedAt,
        actor: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
        resourceType: { id: 'type-mysql', key: 'mysql', name: 'MySQL' },
        credential: { config: 'encrypted-secret' },
      },
    ]);

    const result = await service.listProvisioningRuns('team-1', 'request-1', {
      status: 'completed',
      mode: 'api',
      trigger: 'manual_retry',
      limit: '250',
    });

    expect(prisma.resourceRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'request-1', teamId: 'team-1' },
      select: { id: true },
    });
    expect(prisma.resourceProvisioningRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        requestId: 'request-1',
        status: 'completed',
        mode: 'api',
        trigger: 'manual_retry',
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    }));
    expect(result).toEqual([
      expect.objectContaining({
        id: 'provisioning-run-1',
        status: 'completed',
        providerRunId: 'provider-run-1',
        params: { url: 'https://provision.example/api?token=redacted' },
        actor: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
        resourceType: { id: 'type-mysql', key: 'mysql', name: 'MySQL' },
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('encrypted-secret');
  });

  it('rejects provisioning run listing when the request is not in the team', async () => {
    const { prisma, service } = createService();

    prisma.resourceRequest.findFirst.mockResolvedValue(null);

    await expect(service.listProvisioningRuns('team-1', 'request-1', {}))
      .rejects
      .toThrow('资源申请不存在');
    expect(prisma.resourceProvisioningRun.findMany).not.toHaveBeenCalled();
  });
});

function createService(options: { httpEnabled?: boolean; configValues?: Record<string, unknown> } = {}) {
  const prisma = {
    resourceRequest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    resourceType: {
      findUnique: jest.fn(),
    },
    teamCredential: {
      findFirst: jest.fn(),
    },
    resourceInstance: {
      create: jest.fn(),
    },
    resourceProvisioningRun: {
      create: jest.fn().mockResolvedValue({ id: 'provisioning-run-1', autoRetry: false, maxAttempts: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'provisioning-run-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    resourceAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (Object.prototype.hasOwnProperty.call(options.configValues || {}, key)) {
        return options.configValues?.[key];
      }
      return key === 'RESOURCE_PROVISIONING_HTTP_ENABLED'
        ? options.httpEnabled ?? fallback
        : fallback;
    }),
  };
  const resourcePoolService = {
    allocateResource: jest.fn(),
  };
  const serverExecutor = {
    resolveTarget: jest.fn().mockResolvedValue({ transport: 'none', serverId: null }),
    execute: jest.fn(),
    queueExecution: jest.fn(),
  };

  const service = new ResourceRequestService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    resourcePoolService as unknown as ResourcePoolService,
    serverExecutor as unknown as ServerExecutorService,
  );

  return { prisma, resourcePoolService, serverExecutor, service };
}

function resourceRequest(overrides: Record<string, unknown> = {}) {
  const resourceTypeOverride = (overrides.resourceType || {}) as Record<string, unknown>;
  return {
    id: 'request-1',
    teamId: 'team-1',
    projectId: 'project-1',
    environmentId: 'env-dev',
    resourceTypeId: 'type-mysql',
    requesterId: 'user-1',
    title: 'MySQL for dev',
    environment: 'dev',
    purpose: 'dev database',
    spec: {},
    status: 'pending',
    resourceType: {
      id: 'type-mysql',
      key: 'mysql',
      name: 'MySQL',
      provisioningMode: 'manual',
      deliverySchema: mysqlDeliverySchema(),
      ...resourceTypeOverride,
    },
    ...overrides,
  };
}

function resourceType(overrides: Record<string, unknown> = {}) {
  return {
    id: 'type-mysql',
    key: 'mysql',
    name: 'MySQL',
    provisioningMode: 'manual',
    provisioningConfig: {},
    deliverySchema: mysqlDeliverySchema(),
    ...overrides,
  };
}

function mysqlDeliverySchema() {
  return {
    fields: [
      { key: 'host', label: '主机', type: 'text' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'database', label: '数据库名', type: 'text' },
      { key: 'username', label: '用户名', type: 'text' },
      { key: 'password', label: '密码', type: 'password', sensitive: true },
    ],
  };
}

function auditActions(prisma: { resourceAuditLog: { create: jest.Mock } }) {
  return prisma.resourceAuditLog.create.mock.calls.map((call) => call[0].data.action);
}
