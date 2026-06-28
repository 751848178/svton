import { Prisma } from '@prisma/client';

export type ResourceActionRisk = 'low' | 'medium' | 'high';
export type ResourceActionMode = 'read' | 'mutating' | 'maintenance';

export type ResourceActionDefinition = {
  key: string;
  name: string;
  description: string;
  providers: string[];
  kinds: string[];
  sourceTypes: string[];
  executorKey: string;
  adapterKey: string;
  mode: ResourceActionMode;
  risk: ResourceActionRisk;
  dryRunOnly: boolean;
  requiresConfirmation: boolean;
  paramsSchema?: Prisma.InputJsonValue;
};

export type ManagedResourceActionTarget = {
  sourceType: string;
  provider: string;
  kind: string;
};

export const RESOURCE_ACTIONS: ResourceActionDefinition[] = [
  {
    key: 'docker.container.inspect',
    name: '查看容器详情',
    description: '通过 Server executor 生成或执行受控 docker inspect',
    providers: ['docker'],
    kinds: ['docker_container'],
    sourceTypes: ['server'],
    executorKey: 'server-executor',
    adapterKey: 'server-resource-script-plan',
    mode: 'read',
    risk: 'low',
    dryRunOnly: false,
    requiresConfirmation: false,
  },
  {
    key: 'docker.container.logs',
    name: '查看容器日志',
    description: '通过 Server executor 生成或执行受控 docker logs',
    providers: ['docker'],
    kinds: ['docker_container'],
    sourceTypes: ['server'],
    executorKey: 'server-executor',
    adapterKey: 'server-resource-script-plan',
    mode: 'read',
    risk: 'low',
    dryRunOnly: false,
    requiresConfirmation: false,
    paramsSchema: {
      type: 'object',
      properties: {
        tail: { type: 'number', default: 200 },
      },
    },
  },
  {
    key: 'docker.container.stats',
    name: '查看容器指标',
    description: '通过 Server executor 生成或执行受控 docker stats 快照',
    providers: ['docker'],
    kinds: ['docker_container'],
    sourceTypes: ['server'],
    executorKey: 'server-executor',
    adapterKey: 'server-resource-script-plan',
    mode: 'read',
    risk: 'low',
    dryRunOnly: false,
    requiresConfirmation: false,
    paramsSchema: {
      type: 'object',
      properties: {
        sampleCount: { type: 'number', default: 1 },
      },
    },
  },
  {
    key: 'docker.container.restart',
    name: '重启容器',
    description: '生成受控 docker restart 脚本计划',
    providers: ['docker'],
    kinds: ['docker_container'],
    sourceTypes: ['server'],
    executorKey: 'server-executor',
    adapterKey: 'server-resource-script-plan',
    mode: 'mutating',
    risk: 'medium',
    dryRunOnly: false,
    requiresConfirmation: true,
  },
  {
    key: 'mysql.connection.test',
    name: '测试 MySQL 连接',
    description: '生成或执行 Docker MySQL / RDS 连接测试计划',
    providers: ['docker', 'aliyun-rds'],
    kinds: ['mysql', 'database'],
    sourceTypes: ['server', 'cloud'],
    executorKey: 'auto',
    adapterKey: 'resource-adapter',
    mode: 'read',
    risk: 'low',
    dryRunOnly: false,
    requiresConfirmation: false,
  },
  {
    key: 'mysql.backup.plan',
    name: '生成 MySQL 备份计划',
    description: '生成 mysqldump 或 RDS 备份任务计划',
    providers: ['docker', 'aliyun-rds'],
    kinds: ['mysql', 'database'],
    sourceTypes: ['server', 'cloud'],
    executorKey: 'auto',
    adapterKey: 'resource-adapter',
    mode: 'maintenance',
    risk: 'medium',
    dryRunOnly: false,
    requiresConfirmation: true,
  },
  {
    key: 'redis.info',
    name: '查看 Redis 信息',
    description: '通过 Server executor 生成或执行受控 redis-cli INFO',
    providers: ['docker'],
    kinds: ['redis'],
    sourceTypes: ['server'],
    executorKey: 'server-executor',
    adapterKey: 'server-resource-script-plan',
    mode: 'read',
    risk: 'low',
    dryRunOnly: false,
    requiresConfirmation: false,
  },
  {
    key: 'sls.logstores.list',
    name: '列出 SLS Logstore',
    description: '生成阿里云 SLS SDK 调用计划',
    providers: ['aliyun-sls'],
    kinds: ['log_service'],
    sourceTypes: ['cloud'],
    executorKey: 'cloud-sdk',
    adapterKey: 'aliyun-sls-sdk',
    mode: 'read',
    risk: 'low',
    dryRunOnly: true,
    requiresConfirmation: false,
  },
  {
    key: 'cos.objects.list',
    name: '列出 COS 对象',
    description: '生成腾讯云 COS SDK 调用计划',
    providers: ['tencent-cos'],
    kinds: ['object_storage'],
    sourceTypes: ['cloud'],
    executorKey: 'cloud-sdk',
    adapterKey: 'tencent-cos-sdk',
    mode: 'read',
    risk: 'low',
    dryRunOnly: true,
    requiresConfirmation: false,
    paramsSchema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', default: '' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
];

export function getActionDefinition(action: string) {
  return RESOURCE_ACTIONS.find((definition) => definition.key === action);
}

export function isActionSupported(
  definition: ResourceActionDefinition,
  resource: ManagedResourceActionTarget,
) {
  return (
    definition.sourceTypes.includes(resource.sourceType) &&
    definition.providers.includes(resource.provider) &&
    definition.kinds.includes(resource.kind)
  );
}

export function getActionsForResource(resource: ManagedResourceActionTarget) {
  return RESOURCE_ACTIONS.filter((definition) => isActionSupported(definition, resource));
}
