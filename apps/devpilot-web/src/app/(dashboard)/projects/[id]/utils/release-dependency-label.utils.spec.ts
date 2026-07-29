/**
 * describeCrossServiceDependencies / describeDependency 单元测试（P0-1 §7 回归）：
 * 验证跨服务边的人能理解中文描述、跨服务过滤、端点缺失兜底、可选边文案。
 *
 * 由 devpilot-web 的 Vitest 入口执行，独立于生产 tsconfig 的 type-check 范围。
 */
import {
  describeDependency,
  describeCrossServiceDependencies,
  type DependencyEdgeView,
  type DependencyStageView,
} from './release-dependency-label.utils';

const stage = (key: string, name: string, serviceId: string): DependencyStageView => ({
  key, name, type: key.split(':')[0], applicationServiceId: serviceId,
});

const edge = (
  stageKey: string,
  dependsOnStageKey: string,
  over: Partial<DependencyEdgeView> = {},
): DependencyEdgeView => ({
  stageKey,
  dependsOnStageKey,
  conditionType: 'succeeded',
  required: true,
  ...over,
});

describe('describeDependency', () => {
  it('renders upstream cond, downstream name in Chinese', () => {
    const s = describeDependency(
      edge('application_deploy:svc-admin', 'health_check:svc-backend'),
      new Map([
        ['health_check:svc-backend', stage('health_check:svc-backend', '就绪检查 - Backend', 'svc-backend')],
        ['application_deploy:svc-admin', stage('application_deploy:svc-admin', '应用部署 - Admin', 'svc-admin')],
      ]),
    );
    expect(s).toBe('就绪检查 - Backend 成功后，才会执行应用部署 - Admin');
  });

  it('appends optional suffix when required=false', () => {
    const s = describeDependency(
      edge('application_deploy:svc-admin', 'health_check:svc-backend', { required: false }),
      new Map([
        ['health_check:svc-backend', stage('health_check:svc-backend', '就绪检查 - Backend', 'svc-backend')],
        ['application_deploy:svc-admin', stage('application_deploy:svc-admin', '应用部署 - Admin', 'svc-admin')],
      ]),
    );
    expect(s).toContain('可选：跳过该上游后仍会继续');
  });

  it('renders （未知…） placeholder instead of leaking raw cuid key when endpoint missing', () => {
    const s = describeDependency(
      edge('application_deploy:svc-admin', 'health_check:cmr_unknown'),
      new Map([['application_deploy:svc-admin', stage('application_deploy:svc-admin', '应用部署 - Admin', 'svc-admin')]]),
    );
    expect(s).toContain('（未知上游阶段）');
    expect(s).not.toContain('cmr_unknown');
  });
});

describe('describeCrossServiceDependencies', () => {
  it('keeps only cross-service edges (drops same-service chain edges)', () => {
    const stages = [
      stage('application_deploy:svc-backend', '应用部署 - Backend', 'svc-backend'),
      stage('health_check:svc-backend', '就绪检查 - Backend', 'svc-backend'),
      stage('application_deploy:svc-admin', '应用部署 - Admin', 'svc-admin'),
    ];
    const edges = [
      // same-service chain: backend deploy → backend health — must be dropped
      edge('health_check:svc-backend', 'application_deploy:svc-backend'),
      // cross-service: backend health → admin deploy — must be kept
      edge('application_deploy:svc-admin', 'health_check:svc-backend'),
    ];
    const out = describeCrossServiceDependencies(edges, stages);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('应用部署 - Admin');
  });

  it('returns [] when no cross-service edges', () => {
    const stages = [stage('application_deploy:svc-a', '应用部署 - A', 'svc-a')];
    const out = describeCrossServiceDependencies([], stages);
    expect(out).toEqual([]);
  });
});
