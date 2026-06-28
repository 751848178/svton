import { Prisma } from '@prisma/client';
import {
  getActionDefinition,
  getActionsForResource,
} from '../actions/resource-actions';
import { ServerScriptExecutor } from './server-script.executor';

describe('ServerScriptExecutor docker stats', () => {
  it('exposes docker stats as a low-risk Docker container action', () => {
    const actions = getActionsForResource({
      sourceType: 'server',
      provider: 'docker',
      kind: 'docker_container',
    }).map((action) => action.key);
    const action = getActionDefinition('docker.container.stats');

    expect(actions).toContain('docker.container.stats');
    expect(action).toEqual(expect.objectContaining({
      name: '查看容器指标',
      mode: 'read',
      risk: 'low',
      dryRunOnly: false,
      requiresConfirmation: false,
    }));
  });

  it('generates a narrow docker stats JSON snapshot command', async () => {
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        commandPlan: { mode: 'dry_run' },
        result: { mode: 'dry_run' },
      }),
    };
    const executor = new ServerScriptExecutor(serverExecutor as never);
    const action = getActionDefinition('docker.container.stats');
    if (!action) throw new Error('docker.container.stats action missing');

    await executor.execute({
      teamId: 'team-1',
      userId: 'user-1',
      resourceActionRunId: 'run-1',
      resource: {
        id: 'resource-1',
        sourceType: 'server',
        provider: 'docker',
        kind: 'docker_container',
        name: 'API / api-1',
        externalId: 'server-1:docker:container:abc123',
        serverId: 'server-1',
        config: { containerName: 'api-1' } as Prisma.JsonObject,
      },
      action,
      credential: {
        source: 'server',
        credentialType: 'server_ssh',
        referenceId: 'server-1',
        transport: 'ssh',
        redacted: true,
        metadata: { serverId: 'server-1' },
      },
      params: {},
      dryRun: true,
    });

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'docker.container.stats',
      adapterKey: 'server-resource-script-plan',
      dryRun: true,
      steps: [
        expect.objectContaining({
          key: 'docker.container.stats:1',
          label: 'read container metrics snapshot',
          command: "docker stats --no-stream --format '{{json .}}' api-1",
          risk: 'low',
          preview: expect.stringContaining('CPU%'),
        }),
      ],
    }));
  });
});
