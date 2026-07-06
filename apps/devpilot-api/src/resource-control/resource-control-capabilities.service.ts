import { Injectable } from '@nestjs/common';
import { RESOURCE_ACTIONS } from './actions/resource-actions';

@Injectable()
export class ResourceControlCapabilitiesService {
  getCapabilities() {
    return {
      syncMode: 'inventory_only',
      sourceTypes: [
        {
          key: 'server',
          name: '服务器资源',
          description: '按服务器维度盘点 Docker 容器和 Docker 部署的中间件',
          adapters: [
            {
              provider: 'docker',
              status: 'server_executor_inventory',
              nextStep:
                '当前通过 Server executor 受控 docker ps 读取清单；后续可替换为 Server agent 或 Docker Remote API adapter',
              resourceKinds: ['docker_container', 'mysql', 'redis'],
            },
          ],
        },
        {
          key: 'cloud',
          name: '云资源',
          description: '按云账号和区域盘点 RDS、日志服务和对象存储',
          adapters: [
            {
              provider: 'aliyun-rds',
              status: 'provider_inventory_adapter',
              credentialType: 'cloud_aliyun',
              resourceKinds: ['database'],
            },
            {
              provider: 'aliyun-sls',
              status: 'provider_inventory_adapter',
              credentialType: 'cloud_aliyun',
              resourceKinds: ['log_service'],
            },
            {
              provider: 'tencent-cos',
              status: 'provider_inventory_adapter',
              credentialType: 'cloud_tencent',
              resourceKinds: ['object_storage'],
            },
          ],
        },
      ],
      executionMode: 'server_executor_first',
      executorAdapters: [
        {
          key: 'server-executor',
          currentTransport: 'script_plan',
          currentAdapter: 'server-resource-script-plan',
          futureTransport: 'ssh_live_or_server_agent_executor',
        },
        {
          key: 'server-executor:ssh-live',
          currentTransport: 'ssh_live_default_off',
          currentAdapter: 'ssh-live',
          futureTransport: 'server_agent_executor',
        },
        {
          key: 'cloud-sdk',
          currentTransport: 'sdk_call_plan',
          futureTransport: 'provider_sdk',
        },
      ],
      credentialAuthAdapters: [
        {
          key: 'server-ssh',
          source: 'Server.credentials',
          currentStatus: 'redacted_reference',
          futureTransport: 'server_agent_credential_exchange',
        },
        {
          key: 'cloud-team-credential',
          source: 'TeamCredential',
          currentStatus: 'redacted_reference',
          futureTransport: 'provider_sdk_credential_adapter',
        },
        {
          key: 'direct-db-credential',
          source: 'ManagedResource.config or TeamCredential',
          currentStatus: 'team_credential_readonly_material_resolved_inside_driver',
          futureTransport: 'database_driver_adapter',
        },
      ],
      credentialProfiles: [
        {
          type: 'cloud_aliyun',
          name: '阿里云 AccessKey',
          providers: ['aliyun-rds', 'aliyun-sls'],
          authAdapterKey: 'aliyun-team-credential',
          requiredFields: ['accessKeyId', 'accessKeySecret'],
          optionalFields: ['securityToken', 'defaultRegion', 'accountId'],
          secretFields: ['accessKeySecret', 'securityToken'],
          futureTransport: 'aliyun_provider_sdk',
        },
        {
          type: 'cloud_tencent',
          name: '腾讯云 SecretId',
          providers: ['tencent-cos'],
          authAdapterKey: 'tencent-team-credential',
          requiredFields: ['secretId', 'secretKey'],
          optionalFields: ['defaultRegion', 'appId'],
          secretFields: ['secretKey'],
          futureTransport: 'tencent_cloud_sdk',
        },
        {
          type: 'db_mysql_readonly',
          name: 'MySQL/RDS 只读账号',
          providers: ['docker', 'aliyun-rds'],
          resourceKinds: ['mysql', 'database'],
          authAdapterKey: 'mysql-readonly-team-credential',
          requiredFields: ['host', 'port', 'username', 'password'],
          optionalFields: ['database', 'sslMode'],
          secretFields: ['password'],
          futureTransport: 'mysql_driver_adapter',
        },
        {
          type: 'db_redis_readonly',
          name: 'Redis 只读账号',
          providers: ['docker'],
          resourceKinds: ['redis'],
          authAdapterKey: 'redis-readonly-team-credential',
          requiredFields: ['host', 'port', 'password'],
          optionalFields: ['username', 'database'],
          secretFields: ['password'],
          futureTransport: 'redis_driver_adapter',
        },
      ],
      queryAdapters: [
        {
          key: 'mysql-query-plan',
          sourceTypes: ['server', 'cloud'],
          currentStatus: 'live_readonly_driver_available_with_explicit_confirmation',
          futureTransport: 'mysql_driver_adapter',
        },
        {
          key: 'redis-query-plan',
          sourceTypes: ['server'],
          currentStatus: 'live_readonly_driver_available_with_explicit_confirmation',
          futureTransport: 'redis_driver_adapter',
        },
        {
          key: 'aliyun-sls-query-plan',
          sourceTypes: ['cloud'],
          currentStatus: 'dry_run_plan_with_result_preview_contract',
          futureTransport: 'aliyun_sls_sdk',
        },
        {
          key: 'tencent-cos-query-plan',
          sourceTypes: ['cloud'],
          currentStatus: 'dry_run_plan_with_result_preview_contract',
          futureTransport: 'tencent_cos_sdk',
        },
      ],
      plannedActions: RESOURCE_ACTIONS.map((action) => action.key),
      reusableSvtonResources: [
        '@svton/nestjs-object-storage',
        '@svton/nestjs-object-storage-tencent-cos',
        '@svton/nestjs-logger aliyunSls/tencentCls transports',
        '@svton/nestjs-redis',
        'Devpilot ServerService',
        'Devpilot TeamCredential',
        'Devpilot ResourcePool and ResourceInstance',
      ],
      safetyNotes: [
        '第一阶段只做清单同步和状态展示，不执行高风险变更动作',
        '当前版本不引入 Agent，Server executor 默认只输出受控脚本计划',
        'Server executor 已接入内置命令策略，live 执行前必须通过命令白名单和危险命令检测',
        'SSH live adapter 默认关闭，需要 SERVER_EXECUTOR_LIVE_ENABLED=true、key auth 和确认文本',
        '真实服务器控制需要命令白名单、超时、脱敏、审计和按动作授权',
        '真实云资源同步需要 provider SDK、分页、区域选择、限流和错误归一化',
      ],
    };
  }
}
