import { RESOURCE_ACTIONS } from './actions/resource-actions';
import { ResourceControlCapabilitiesService } from './resource-control-capabilities.service';

describe('ResourceControlCapabilitiesService', () => {
  const service = new ResourceControlCapabilitiesService();

  it('exposes the project/environment resource-control capability contract', () => {
    const capabilities = service.getCapabilities();

    expect(capabilities.syncMode).toBe('inventory_only');
    expect(capabilities.executionMode).toBe('server_executor_first');
    expect(capabilities.plannedActions).toEqual(RESOURCE_ACTIONS.map((action) => action.key));
    expect(capabilities.sourceTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'server',
          adapters: expect.arrayContaining([
            expect.objectContaining({
              provider: 'docker',
              status: 'server_executor_inventory',
            }),
          ]),
        }),
        expect.objectContaining({
          key: 'cloud',
          adapters: expect.arrayContaining([
            expect.objectContaining({
              provider: 'aliyun-rds',
              credentialType: 'cloud_aliyun',
            }),
            expect.objectContaining({
              provider: 'tencent-cos',
              credentialType: 'cloud_tencent',
            }),
          ]),
        }),
      ]),
    );
  });

  it('keeps credential and query adapter readiness visible to the UI', () => {
    const capabilities = service.getCapabilities();

    expect(capabilities.credentialProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'cloud_aliyun' }),
        expect.objectContaining({ type: 'cloud_tencent' }),
        expect.objectContaining({ type: 'db_mysql_readonly' }),
        expect.objectContaining({ type: 'db_redis_readonly' }),
      ]),
    );
    expect(capabilities.queryAdapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'mysql-query-plan',
          currentStatus: 'live_readonly_driver_available_with_explicit_confirmation',
        }),
        expect.objectContaining({
          key: 'redis-query-plan',
          currentStatus: 'live_readonly_driver_available_with_explicit_confirmation',
        }),
        expect.objectContaining({
          key: 'aliyun-sls-query-plan',
          currentStatus: 'dry_run_plan_with_result_preview_contract',
        }),
        expect.objectContaining({
          key: 'tencent-cos-query-plan',
          currentStatus: 'dry_run_plan_with_result_preview_contract',
        }),
      ]),
    );
  });
});
