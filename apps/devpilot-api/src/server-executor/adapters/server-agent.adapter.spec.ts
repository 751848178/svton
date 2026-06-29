import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { ServerAgentServerExecutorAdapter } from './server-agent.adapter';

describe('ServerAgentServerExecutorAdapter', () => {
  it('generates a dry-run dispatch envelope for server_agent targets', async () => {
    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
    } as unknown as ConfigService;
    const adapter = new ServerAgentServerExecutorAdapter(configService);

    await expect(adapter.execute({
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'site.sync',
      adapterKey: 'nginx-site-plan',
      dryRun: true,
      target: {
        transport: 'server_agent',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      },
      steps: [
        {
          key: 'nginx-test',
          label: 'Nginx test',
          command: 'nginx -t',
          required: true,
          risk: 'low',
        },
      ],
      metadata: {
        projectId: 'project-1',
        serverExecutionJobId: 'job-agent-dry-1',
        retryAttempt: 2,
        maxAttempts: 3,
      },
    })).resolves.toEqual(expect.objectContaining({
      status: 'completed',
      mode: 'dry_run',
      executable: true,
      commandPlan: expect.objectContaining({
        executorAdapterKey: 'server-agent',
        transport: 'server_agent',
        agent: expect.objectContaining({
          enabled: false,
          dispatcherConfigured: false,
          requiredCapability: 'nginx-site-plan',
        }),
        dispatchEnvelope: expect.objectContaining({
          operationKey: 'site.sync',
          adapterKey: 'nginx-site-plan',
          correlation: expect.objectContaining({
            serverExecutionJobId: 'job-agent-dry-1',
            retryAttempt: 2,
            maxAttempts: 3,
            dispatchId: 'job-agent-dry-1:2',
            idempotencyKey: 'server-execution-job:team-1:job-agent-dry-1',
          }),
          stepCount: 1,
        }),
      }),
      result: expect.objectContaining({
        executorAdapterKey: 'server-agent',
        transport: 'server_agent',
        agentExecutorEnabled: false,
        correlation: expect.objectContaining({
          serverExecutionJobId: 'job-agent-dry-1',
          dispatchId: 'job-agent-dry-1:2',
          idempotencyKey: 'server-execution-job:team-1:job-agent-dry-1',
        }),
        nextExecutorBoundary: 'server_agent_dispatcher',
      }),
    }));
  });

  it('blocks live agent dispatch until the dispatcher is configured', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'SERVER_EXECUTOR_AGENT_ENABLED') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const adapter = new ServerAgentServerExecutorAdapter(configService);

    await expect(adapter.execute({
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: {
        transport: 'server_agent',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      },
      steps: [
        {
          key: 'deploy',
          label: 'Deploy',
          command: 'pnpm deploy',
          required: true,
          risk: 'high',
        },
      ],
      metadata: {
        projectId: 'project-1',
        serverExecutionJobId: 'job-live-1',
        serverExecutionLeaseId: 'lease-live-1',
        retryAttempt: 1,
        maxAttempts: 2,
      },
      requiredConfirmationText: 'DEPLOY',
      confirmationText: 'DEPLOY',
    })).resolves.toEqual(expect.objectContaining({
      status: 'blocked',
      mode: 'blocked_live_execution',
      executable: false,
      result: expect.objectContaining({
        executorAdapterKey: 'server-agent',
        agentExecutorEnabled: true,
        dispatcherConfigured: false,
        nextExecutorBoundary: 'server_agent_dispatcher',
      }),
      error: 'Server agent dispatcher 未配置，live agent dispatch 暂不执行',
    }));
  });

  it('dispatches live execution to a configured HTTP dispatcher', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        const values: Record<string, string> = {
          SERVER_EXECUTOR_AGENT_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_DISPATCHER_URL: 'https://agent.example.test/internal/dispatch?token=secret',
          SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN: 'dispatcher-token',
          SERVER_EXECUTOR_AGENT_DISPATCHER_TIMEOUT_SECONDS: '12',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const httpService = {
      post: jest.fn().mockReturnValue(of({
        data: {
          status: 'completed',
          warnings: ['agent accepted envelope'],
          logs: [{ level: 'info', message: 'agent completed' }],
          result: { agentRunId: 'agent-run-1' },
        },
      })),
    };
    const adapter = new ServerAgentServerExecutorAdapter(configService, httpService as never);

    await expect(adapter.execute({
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: {
        transport: 'server_agent',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
        agentRef: {
          source: 'server_services',
          referenceId: 'server-1',
          displayName: 'prod-1 agent',
          capabilityKey: 'serverAgent',
          status: 'ready',
          redacted: true,
        },
      },
      steps: [
        {
          key: 'deploy',
          label: 'Deploy',
          command: 'pnpm deploy',
          required: true,
          risk: 'high',
        },
      ],
      metadata: {
        projectId: 'project-1',
        serverExecutionJobId: 'job-live-1',
        serverExecutionLeaseId: 'lease-live-1',
        retryAttempt: 1,
        maxAttempts: 2,
      },
      requiredConfirmationText: 'DEPLOY',
      confirmationText: 'DEPLOY',
    })).resolves.toEqual(expect.objectContaining({
      status: 'completed',
      mode: 'executed',
      executable: true,
      warnings: ['agent accepted envelope'],
      result: expect.objectContaining({
        mode: 'agent_dispatch',
        executed: true,
        dispatcherConfigured: true,
        dispatcher: 'https://agent.example.test/internal/dispatch',
        correlation: expect.objectContaining({
          serverExecutionJobId: 'job-live-1',
          serverExecutionLeaseId: 'lease-live-1',
          retryAttempt: 1,
          maxAttempts: 2,
          dispatchId: 'job-live-1:1',
          idempotencyKey: 'server-execution-job:team-1:job-live-1',
        }),
        dispatcherResponse: { agentRunId: 'agent-run-1' },
        dispatchEnvelope: expect.objectContaining({
          operationKey: 'deployment.run',
          adapterKey: 'deployment-script-plan',
          correlation: expect.objectContaining({
            serverExecutionJobId: 'job-live-1',
            serverExecutionLeaseId: 'lease-live-1',
            dispatchId: 'job-live-1:1',
            idempotencyKey: 'server-execution-job:team-1:job-live-1',
          }),
          stepCount: 1,
          target: expect.objectContaining({
            agentRef: expect.objectContaining({ capabilityKey: 'serverAgent' }),
          }),
        }),
      }),
      error: undefined,
    }));
    expect(httpService.post).toHaveBeenCalledWith(
      'https://agent.example.test/internal/dispatch?token=secret',
      expect.objectContaining({
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        correlation: expect.objectContaining({
          serverExecutionJobId: 'job-live-1',
          serverExecutionLeaseId: 'lease-live-1',
          dispatchId: 'job-live-1:1',
          idempotencyKey: 'server-execution-job:team-1:job-live-1',
        }),
        stepCount: 1,
      }),
      expect.objectContaining({
        timeout: 12_000,
        headers: expect.objectContaining({
          authorization: 'Bearer dispatcher-token',
          'x-devpilot-team-id': 'team-1',
          'x-devpilot-actor-id': 'user-1',
          'x-devpilot-execution-job-id': 'job-live-1',
          'x-devpilot-execution-lease-id': 'lease-live-1',
          'x-devpilot-dispatch-id': 'job-live-1:1',
          'idempotency-key': 'server-execution-job:team-1:job-live-1',
        }),
      }),
    );
  });

  it('maps dispatcher terminal failures into failed execution results', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        const values: Record<string, string> = {
          SERVER_EXECUTOR_AGENT_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_DISPATCHER_URL: 'https://agent.example.test/dispatch',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const httpService = {
      post: jest.fn().mockReturnValue(of({
        data: {
          status: 'failed',
          error: 'agent runtime failed',
          result: { agentRunId: 'agent-run-failed' },
        },
      })),
    };
    const adapter = new ServerAgentServerExecutorAdapter(configService, httpService as never);

    await expect(adapter.execute({
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'site.sync',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      target: {
        transport: 'server_agent',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      },
      steps: [
        {
          key: 'nginx-test',
          label: 'Nginx test',
          command: 'nginx -t',
          required: true,
          risk: 'low',
        },
      ],
      metadata: { projectId: 'project-1' },
    })).resolves.toEqual(expect.objectContaining({
      status: 'failed',
      mode: 'executed',
      executable: false,
      result: expect.objectContaining({
        mode: 'agent_dispatch',
        executed: false,
        dispatcherConfigured: true,
        dispatcherResponse: { agentRunId: 'agent-run-failed' },
      }),
      error: 'agent runtime failed',
    }));
  });
});
