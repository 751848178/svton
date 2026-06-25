import { defineSvtonProject } from '@svton/cli';

/**
 * Svton 项目清单（参考实现）。
 *
 * 本文件是 Svton 架构规范的权威声明：声明了工作区里的应用、端口、数据库与服务。
 * 即便删掉本文件，`svton` CLI 也能通过自动检测推断出等价配置（见 `svton info`）。
 * 保留它是为了把约定"显式化"，并作为新项目的范本。
 */
export default defineSvtonProject({
  schema: 1,
  apps: {
    'devpilot-api': {
      dir: 'apps/devpilot-api',
      type: 'nest',
      port: 3101,
      baseURL: 'http://localhost:3101/api',
      ready: { http: 'http://localhost:3101/api/health' },
    },
    'devpilot-web': {
      dir: 'apps/devpilot-web',
      type: 'next',
      port: 3100,
      ready: { http: 'http://localhost:3100' },
    },
    'agent-web': {
      dir: 'apps/agent-web',
      type: 'next',
      port: 3210,
    },
    'agent-desktop': {
      dir: 'apps/agent-desktop',
      type: 'node',
    },
  },
  database: { orm: 'prisma', dir: 'apps/devpilot-api' },
  services: { compose: 'docker-compose.yml' },
});
