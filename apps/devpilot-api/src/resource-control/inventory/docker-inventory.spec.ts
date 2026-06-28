import {
  buildDockerInventorySeedsFromDockerPs,
  DOCKER_PS_JSON_COMMAND,
} from './docker-inventory';

const server = {
  id: 'server-1',
  name: 'prod-01',
  host: '10.0.0.8',
  status: 'online',
};

const environment = {
  id: 'env-prod',
  projectId: 'project-1',
  key: 'prod',
  name: 'Production',
};

describe('docker inventory parser', () => {
  it('keeps the inventory command narrow and policy friendly', () => {
    expect(DOCKER_PS_JSON_COMMAND).toBe("docker ps -a --no-trunc --format '{{json .}}'");
  });

  it('maps docker containers and middleware resources from docker ps JSON lines', () => {
    const stdout = [
      JSON.stringify({
        ID: 'abc123',
        Image: 'mysql:8.0',
        Names: 'mysql-primary',
        Ports: '0.0.0.0:3308->3306/tcp, :::3308->3306/tcp',
        State: 'running',
        Status: 'Up 2 hours',
      }),
      JSON.stringify({
        ID: 'def456',
        Image: 'redis:7',
        Names: 'redis-cache',
        Ports: '6379/tcp',
        State: 'running',
        Status: 'Up 10 minutes',
      }),
      JSON.stringify({
        ID: 'ghi789',
        Image: 'nginx:stable',
        Names: 'nginx-proxy',
        Ports: '0.0.0.0:80->80/tcp',
        State: 'exited',
        Status: 'Exited (0) 1 hour ago',
      }),
    ].join('\n');

    const result = buildDockerInventorySeedsFromDockerPs(stdout, {
      server,
      environment,
      includeContainers: true,
      includeMiddleware: true,
      syncMode: 'server_executor_live',
    });

    expect(result.parsedCount).toBe(3);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.seeds).toHaveLength(5);
    expect(result.seeds.map((seed) => seed.kind)).toEqual([
      'docker_container',
      'mysql',
      'docker_container',
      'redis',
      'docker_container',
    ]);
    expect(result.seeds.find((seed) => seed.kind === 'mysql')).toMatchObject({
      endpoint: '10.0.0.8:3308',
      externalId: 'server-1:docker:mysql:mysql-primary',
      status: 'active',
      projectId: 'project-1',
      environmentId: 'env-prod',
      config: {
        containerName: 'mysql-primary',
        port: 3308,
        containerPort: 3306,
      },
    });
    expect(result.seeds.find((seed) => seed.name.endsWith('nginx-proxy'))).toMatchObject({
      status: 'stopped',
      endpoint: '10.0.0.8:80',
    });
  });

  it('supports middleware-only sync and empty docker output', () => {
    const redisOnly = buildDockerInventorySeedsFromDockerPs(
      JSON.stringify({
        ID: 'def456',
        Image: 'redis:7',
        Names: 'redis-cache',
        Ports: '',
        State: 'running',
        Status: 'Up 10 minutes',
      }),
      {
        server,
        environment: null,
        includeContainers: false,
        includeMiddleware: true,
        syncMode: 'server_executor_live',
      },
    );

    expect(redisOnly.seeds).toHaveLength(1);
    expect(redisOnly.seeds[0]).toMatchObject({
      kind: 'redis',
      endpoint: '10.0.0.8:6379',
      projectId: undefined,
      environmentId: undefined,
    });

    const empty = buildDockerInventorySeedsFromDockerPs('', {
      server,
      environment,
      includeContainers: true,
      includeMiddleware: true,
      syncMode: 'server_executor_live',
    });

    expect(empty).toEqual({
      seeds: [],
      parsedCount: 0,
      skippedCount: 0,
      errors: [],
    });
  });

  it('skips malformed docker ps lines without failing the whole inventory', () => {
    const result = buildDockerInventorySeedsFromDockerPs(
      [
        'not-json',
        JSON.stringify({
          ID: 'abc123',
          Image: 'mysql:8.0',
          Names: 'mysql-primary',
          Ports: '3306/tcp',
          State: 'running',
          Status: 'Up 2 hours',
        }),
      ].join('\n'),
      {
        server,
        environment,
        includeContainers: false,
        includeMiddleware: true,
        syncMode: 'server_executor_live',
      },
    );

    expect(result.parsedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toEqual(['invalid docker ps JSON line 1']);
    expect(result.seeds).toHaveLength(1);
  });
});
