// Public example metadata only. Every release in this prototype is simulated.
const version = 'r2026.10.05.02';
const before = 'r2026.10.05.01';
export const projects = [
  {
    id: 'twgg', name: 'TWGG', description: '生产管理系统 · API、管理端与移动端',
    branch: 'master', commit: 'a3d0c02', host: '81.70.201.31',
    serverName: 'TWGG 运行服务器', region: '广州',
    services: [
      { id: 'backend', name: 'API 服务', port: '3100', version, target: 'backend-prod', entryUrl: 'http://81.70.201.31:3100/api-docs' },
      { id: 'admin', name: '管理端', port: '3101', version, target: 'admin-prod', entryUrl: 'http://81.70.201.31:3101/' },
      { id: 'mobile', name: 'H5 移动端', port: '10086', version, target: 'mobile-prod', entryUrl: 'http://81.70.201.31:10086/' },
    ],
    history: [{
      id: 'r2026.10.05.02', at: '2026-10-05 23:53', kind: 'release',
      selected: ['backend', 'admin', 'mobile'], result: 'success',
      beforeVersions: { backend: before, admin: before, mobile: before },
      afterVersions: { backend: version, admin: version, mobile: version },
    }],
  },
  {
    id: 'demo-web', name: '网站项目', description: '网站与 API 服务',
    branch: 'main', commit: 'demo001', host: '192.0.2.20',
    serverName: '网站运行服务器', region: '广州',
    services: [
      { id: 'web', name: '网站前端', port: '8080', version: 'demo-v2', target: 'web-demo', entryUrl: './service-preview.html?project=demo-web&service=web' },
      { id: 'api', name: '网站 API', port: '8081', version: 'demo-v2', target: 'api-demo', entryUrl: './service-preview.html?project=demo-web&service=api' },
    ],
    history: [{
      id: 'demo-v2', at: '2026-10-05 18:30', kind: 'release',
      selected: ['web', 'api'], result: 'success',
      beforeVersions: { web: 'demo-v1', api: 'demo-v1' },
      afterVersions: { web: 'demo-v2', api: 'demo-v2' },
    }],
  },
];
