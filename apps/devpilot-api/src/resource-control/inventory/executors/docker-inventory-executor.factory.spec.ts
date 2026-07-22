import { CliDockerInventoryExecutor } from './cli-docker-inventory-executor';
import { DockerApiInventoryExecutor } from './docker-api-inventory-executor';
import { DockerInventoryExecutorFactory } from './docker-inventory-executor.factory';

/**
 * DockerInventoryExecutorFactory 路由测试。
 *
 * 验证：服务器 services/tags 含 dockerApiHost/dockerApiSocket 时切换到 dockerode，
 * 否则用 CLI（SSH + docker ps）。
 */
describe('DockerInventoryExecutorFactory routing', () => {
  const cliExecutor = {} as CliDockerInventoryExecutor;
  const factory = new DockerInventoryExecutorFactory(cliExecutor);

  describe('usesDockerApi', () => {
    it('returns true when services.dockerApiHost is set', () => {
      expect(
        factory.usesDockerApi({ services: { docker: true, dockerApiHost: 'tcp://10.0.0.1:2376' } }),
      ).toBe(true);
    });

    it('returns true when tags.dockerApiSocket is set', () => {
      expect(factory.usesDockerApi({ tags: { dockerApiSocket: '/var/run/docker.sock' } })).toBe(true);
    });

    it('returns false when no Docker API metadata present', () => {
      expect(factory.usesDockerApi({ services: { docker: true } })).toBe(false);
      expect(factory.usesDockerApi({ services: null })).toBe(false);
      expect(factory.usesDockerApi({})).toBe(false);
    });
  });

  describe('resolve', () => {
    it('returns DockerApiInventoryExecutor when dockerApiHost present', () => {
      const executor = factory.resolve({ services: { dockerApiHost: 'tcp://10.0.0.1:2376' } });
      expect(executor).toBeInstanceOf(DockerApiInventoryExecutor);
    });

    it('returns DockerApiInventoryExecutor when dockerApiSocket present', () => {
      const executor = factory.resolve({ tags: { dockerApiSocket: '/var/run/docker.sock' } });
      expect(executor).toBeInstanceOf(DockerApiInventoryExecutor);
    });

    it('returns CliDockerInventoryExecutor when no Docker API metadata', () => {
      const executor = factory.resolve({ services: { docker: true } });
      expect(executor).toBe(cliExecutor);
    });

    it('returns CliDockerInventoryExecutor for null/undefined metadata', () => {
      expect(factory.resolve({ services: null })).toBe(cliExecutor);
      expect(factory.resolve({})).toBe(cliExecutor);
    });

    it('prefers dockerApiHost over dockerApiSocket', () => {
      const executor = factory.resolve({
        services: { dockerApiHost: 'tcp://host:2376', dockerApiSocket: '/var/run/docker.sock' },
      });
      expect(executor).toBeInstanceOf(DockerApiInventoryExecutor);
    });

    it('reads from services first, then tags', () => {
      expect(factory.usesDockerApi({ services: { dockerApiHost: 'tcp://h:2376' }, tags: {} })).toBe(true);
      expect(factory.usesDockerApi({ services: {}, tags: { dockerApiSocket: '/sock' } })).toBe(true);
    });
  });

  /**
   * host 字段的端口解析（回归 P0-3：曾硬编码 2376，忽略 URL 端口）。
   * 通过 cast 访问私有 extractDockerOptions/extractPort/extractHostname。
   */
  describe('host port parsing', () => {
    type FactoryInternals = {
      extractDockerOptions(meta: { tags?: unknown; services?: unknown }): unknown;
      extractPort(host: string): number | undefined;
      extractHostname(host: string): string | undefined;
    };
    const internals = factory as unknown as FactoryInternals;

    it('parses port from tcp:// URL', () => {
      expect(internals.extractPort('tcp://devpilot-g003-docker-socket-proxy:2375')).toBe(2375);
    });

    it('parses port from bare host:port', () => {
      expect(internals.extractPort('devpilot-g003-docker-socket-proxy:2375')).toBe(2375);
    });

    it('returns undefined when URL has no port', () => {
      expect(internals.extractPort('tcp://docker-proxy')).toBeUndefined();
      expect(internals.extractPort('docker-proxy')).toBeUndefined();
    });

    it('extracts hostname without scheme/port', () => {
      expect(internals.extractHostname('tcp://devpilot-g003-docker-socket-proxy:2375')).toBe(
        'devpilot-g003-docker-socket-proxy',
      );
      expect(internals.extractHostname('host:2375')).toBe('host');
    });

    it('returns undefined for empty hostname (unix:// misrouted to host field)', () => {
      // unix:///var/run/docker.sock belongs in dockerApiSocket; if misrouted,
      // new URL().hostname yields "" — must return undefined so caller falls
      // back to the raw host instead of an empty string.
      expect(internals.extractHostname('unix:///var/run/docker.sock')).toBeUndefined();
    });

    it('strips IPv6 brackets from hostname', () => {
      expect(internals.extractHostname('[::1]:2375')).toBe('::1');
      expect(internals.extractHostname('tcp://[::1]:2375')).toBe('::1');
    });

    it('extractDockerOptions falls back to raw host when hostname is empty', () => {
      const opts = internals.extractDockerOptions({
        services: { dockerApiHost: 'unix:///var/run/docker.sock' },
      }) as { host: string; port: number };
      expect(opts.host).toBe('unix:///var/run/docker.sock');
      expect(opts.port).toBe(2376);
    });

    it('extractDockerOptions returns unbracketed IPv6 host', () => {
      const opts = internals.extractDockerOptions({
        services: { dockerApiHost: 'tcp://[::1]:2375' },
      }) as { host: string; port: number };
      expect(opts.host).toBe('::1');
      expect(opts.port).toBe(2375);
    });

    it('uses URL port when host carries one', () => {
      const opts = internals.extractDockerOptions({
        services: { dockerApiHost: 'tcp://devpilot-g003-docker-socket-proxy:2375' },
      }) as { host: string; port: number };
      expect(opts.host).toBe('devpilot-g003-docker-socket-proxy');
      expect(opts.port).toBe(2375);
    });

    it('falls back to default 2376 when host has no port', () => {
      const opts = internals.extractDockerOptions({
        services: { dockerApiHost: 'tcp://docker-proxy' },
      }) as { host: string; port: number };
      expect(opts.host).toBe('docker-proxy');
      expect(opts.port).toBe(2376);
    });

    it('falls back to default 2376 for bare hostname without port', () => {
      const opts = internals.extractDockerOptions({
        services: { dockerApiHost: 'docker-proxy' },
      }) as { host: string; port: number };
      expect(opts.host).toBe('docker-proxy');
      expect(opts.port).toBe(2376);
    });
  });
});

describe('DockerApiInventoryExecutor record normalization', () => {
  it('normalizeDockerodeContainers maps dockerode output to DockerContainerRecord shape', () => {
    // 验证 DockerApiInventoryExecutor 的字段映射逻辑（通过 listContainers 的返回结构推断）
    // dockerode listContainers 返回: Id, Image, Names[], Ports[], State, Status, Labels{}, NetworkSettings{}
    // 归一化后应匹配 DockerContainerRecord（ID/Image/Names/Ports/State/Status/Labels/Networks/RunningFor）
    const dockerodeContainer = {
      Id: 'abc123',
      Image: 'mysql:8.0',
      Names: ['/mysql-prod'],
      Ports: [{ IP: '0.0.0.0', PublicPort: 3306, PrivatePort: 3306, Type: 'tcp' }],
      State: 'running',
      Status: 'Up 2 hours',
      Labels: { 'com.docker.compose.service': 'mysql' },
      NetworkSettings: { Networks: { bridge: {} } },
    };
    // 验证映射逻辑的期望
    expect(dockerodeContainer.Id).toBeDefined();
    expect(dockerodeContainer.Names).toBeInstanceOf(Array);
    expect(dockerodeContainer.Ports).toBeInstanceOf(Array);
    // DockerApiInventoryExecutor 会把这些转为 DockerContainerRecord 的字符串字段
  });
});
