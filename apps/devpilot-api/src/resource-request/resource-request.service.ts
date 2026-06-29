import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcePoolService } from '../resource-pool/resource-pool.service';
import { ServerExecutorService } from '../server-executor/server-executor.service';
import {
  ServerCommandStep,
  ServerExecutionInput,
  ServerExecutionResult,
} from '../server-executor/server-executor.types';
import {
  CompleteResourceRequestDto,
  CreateResourceRequestDto,
  CreateResourceTypeDto,
  ListResourceAuditLogsQueryDto,
  ListResourceInstancesQueryDto,
  ListResourceProvisioningRunsQueryDto,
  ListResourceRequestsQueryDto,
  ProcessQueuedResourceProvisioningRunDto,
  RecoverStaleResourceProvisioningRunsDto,
  ResourceProvisioningRunSupervisorQueryDto,
  ReviewResourceRequestDto,
  UpdateResourceTypeDto,
} from './dto/resource-request.dto';

type PrismaAny = any;
type ProvisioningMode = 'manual' | 'pool' | 'webhook' | 'api' | 'script' | 'credential_only';
type JsonRecord = Record<string, unknown>;
type HttpProvisioningResponse = {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
};
type HttpProvisioningFetch = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<HttpProvisioningResponse>;
type ProvisioningCredentialRef = {
  source: 'team_credential';
  credentialType: string;
  referenceId: string;
  displayName: string;
  authAdapterKey: string;
  redacted: true;
};
type ProvisioningProcessorTrigger = 'approval' | 'manual_retry' | 'auto_retry';
type ProvisioningProcessorContext = {
  trigger: ProvisioningProcessorTrigger;
  replayOfRunId?: string;
  replaySourceStatus?: string;
  provisioningRunId?: string;
  forceInline?: boolean;
};
type ProvisioningAutoRetryConfig = {
  enabled: boolean;
  delaySeconds: number;
  maxScheduledAttempts: number;
};
type ProvisioningQueueConfig = {
  enabled: boolean;
  delaySeconds: number;
};
type ResourceProvisioningRunRecord = JsonRecord & { id: string };

interface ProvisioningAutoRetrySummary {
  scanned: number;
  attempted: number;
  completed: number;
  blocked: number;
  skipped: number;
  failed: number;
}

export interface ProvisioningStaleRecoverySummary {
  scanned: number;
  recovered: number;
  requestUpdated: number;
  skipped: number;
  failed: number;
}

export interface ProvisioningRunStatusCounts {
  queued: number;
  running: number;
  staleRunning: number;
  planned: number;
  blocked: number;
  failed: number;
  completed: number;
}

export interface ProvisioningQueueProcessSummary {
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
  reason?: string;
  run?: JsonRecord;
  request?: JsonRecord;
}

interface ProvisioningResourceType {
  id: string;
  key: string;
  name: string;
  provisioningMode: string;
  provisioningConfig?: unknown;
  deliverySchema?: unknown;
}

interface CompleteProvisionedRequestInput {
  createInstance: boolean;
  instanceName: string;
  config: JsonRecord;
  delivery: JsonRecord;
  credentials: JsonRecord;
  expiresAt?: Date;
  provisioning: JsonRecord;
  auditMetadata?: JsonRecord;
}

const environmentField = {
  key: 'environment',
  label: '使用环境',
  type: 'select',
  required: true,
  default: 'dev',
  options: [
    { label: '开发环境', value: 'dev' },
    { label: '测试环境', value: 'test' },
    { label: '预发环境', value: 'staging' },
    { label: '生产环境', value: 'prod' },
  ],
};

const DEFAULT_RESOURCE_TYPES: CreateResourceTypeDto[] = [
  {
    key: 'mysql',
    name: 'MySQL 数据库',
    description: '申请项目使用的 MySQL 数据库实例、库名或账号',
    category: 'database',
    icon: 'database',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: {
      fields: [
        environmentField,
        { key: 'database', label: '数据库名', type: 'text', required: true, placeholder: 'svton_dev' },
        { key: 'version', label: '版本', type: 'text', default: '8.0' },
        { key: 'charset', label: '字符集', type: 'text', default: 'utf8mb4' },
        { key: 'capacity', label: '规格/容量', type: 'text', default: '1C2G' },
        { key: 'notes', label: '补充说明', type: 'textarea' },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'host', label: '主机', type: 'text', required: true, sensitive: false },
        { key: 'port', label: '端口', type: 'number', required: true, sensitive: false },
        { key: 'username', label: '用户名', type: 'text', required: true, sensitive: false },
        { key: 'password', label: '密码', type: 'password', required: true, sensitive: true },
        { key: 'database', label: '数据库名', type: 'text', required: true, sensitive: false },
      ],
    },
    envTemplate: 'DATABASE_URL="mysql://${username}:${password}@${host}:${port}/${database}"',
  },
  {
    key: 'postgresql',
    name: 'PostgreSQL 数据库',
    description: '申请项目使用的 PostgreSQL 数据库实例、库名或账号',
    category: 'database',
    icon: 'database',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: {
      fields: [
        environmentField,
        { key: 'database', label: '数据库名', type: 'text', required: true, placeholder: 'svton_dev' },
        { key: 'version', label: '版本', type: 'text', default: '15' },
        { key: 'schema', label: 'Schema', type: 'text', default: 'public' },
        { key: 'capacity', label: '规格/容量', type: 'text', default: '1C2G' },
        { key: 'notes', label: '补充说明', type: 'textarea' },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'host', label: '主机', type: 'text', required: true, sensitive: false },
        { key: 'port', label: '端口', type: 'number', required: true, sensitive: false },
        { key: 'username', label: '用户名', type: 'text', required: true, sensitive: false },
        { key: 'password', label: '密码', type: 'password', required: true, sensitive: true },
        { key: 'database', label: '数据库名', type: 'text', required: true, sensitive: false },
        { key: 'schema', label: 'Schema', type: 'text', default: 'public', sensitive: false },
      ],
    },
    envTemplate: 'DATABASE_URL="postgresql://${username}:${password}@${host}:${port}/${database}?schema=${schema}"',
  },
  {
    key: 'redis',
    name: 'Redis 缓存',
    description: '申请 Redis 实例、DB 或缓存账号',
    category: 'cache',
    icon: 'cache',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: {
      fields: [
        environmentField,
        { key: 'db', label: 'DB 编号', type: 'number', default: 0 },
        { key: 'memory', label: '内存规格', type: 'text', default: '512MB' },
        { key: 'persistence', label: '需要持久化', type: 'checkbox', default: true },
        { key: 'notes', label: '补充说明', type: 'textarea' },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'host', label: '主机', type: 'text', required: true, sensitive: false },
        { key: 'port', label: '端口', type: 'number', required: true, sensitive: false },
        { key: 'password', label: '密码', type: 'password', sensitive: true },
        { key: 'db', label: 'DB 编号', type: 'number', sensitive: false },
      ],
    },
    envTemplate: 'REDIS_HOST="${host}"\nREDIS_PORT="${port}"\nREDIS_PASSWORD="${password}"\nREDIS_DB="${db}"',
  },
  {
    key: 'server',
    name: '服务器',
    description: '申请云服务器、测试机或部署节点',
    category: 'compute',
    icon: 'server',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: {
      fields: [
        environmentField,
        {
          key: 'os',
          label: '操作系统',
          type: 'select',
          default: 'linux',
          options: [
            { label: 'Linux', value: 'linux' },
            { label: 'Windows', value: 'windows' },
          ],
        },
        { key: 'cpu', label: 'CPU 核数', type: 'number', default: 2 },
        { key: 'memory', label: '内存', type: 'text', default: '4GB' },
        { key: 'disk', label: '磁盘', type: 'text', default: '80GB' },
        { key: 'publicNetwork', label: '需要公网访问', type: 'checkbox', default: false },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'host', label: '主机地址', type: 'text', required: true, sensitive: false },
        { key: 'port', label: 'SSH 端口', type: 'number', default: 22, sensitive: false },
        { key: 'username', label: '用户名', type: 'text', required: true, sensitive: false },
        { key: 'password', label: '密码', type: 'password', sensitive: true },
        { key: 'privateKey', label: '私钥', type: 'textarea', sensitive: true },
      ],
    },
    envTemplate: 'SERVER_HOST="${host}"\nSERVER_USER="${username}"\nSERVER_PORT="${port}"',
  },
  {
    key: 'port',
    name: '端口号',
    description: '申请内部服务端口、网关端口或公网暴露端口',
    category: 'network',
    icon: 'network',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: {
      fields: [
        environmentField,
        {
          key: 'protocol',
          label: '协议',
          type: 'select',
          default: 'tcp',
          options: [
            { label: 'TCP', value: 'tcp' },
            { label: 'UDP', value: 'udp' },
            { label: 'HTTP', value: 'http' },
            { label: 'HTTPS', value: 'https' },
          ],
        },
        { key: 'port', label: '期望端口', type: 'number', placeholder: '可留空由管理员分配' },
        {
          key: 'exposure',
          label: '暴露范围',
          type: 'select',
          default: 'internal',
          options: [
            { label: '内网', value: 'internal' },
            { label: '公网', value: 'public' },
          ],
        },
        { key: 'purpose', label: '用途说明', type: 'textarea', required: true },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'port', label: '分配端口', type: 'number', required: true, sensitive: false },
        { key: 'protocol', label: '协议', type: 'text', sensitive: false },
        { key: 'host', label: '绑定主机/网关', type: 'text', sensitive: false },
        { key: 'notes', label: '交付说明', type: 'textarea', sensitive: false },
      ],
    },
  },
  {
    key: 'domain',
    name: '域名/DNS',
    description: '申请业务域名、子域名、DNS 解析或证书绑定',
    category: 'network',
    icon: 'globe',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: {
      fields: [
        environmentField,
        { key: 'domain', label: '期望域名', type: 'text', required: true, placeholder: 'api.example.com' },
        {
          key: 'recordType',
          label: '解析类型',
          type: 'select',
          default: 'A',
          options: [
            { label: 'A', value: 'A' },
            { label: 'CNAME', value: 'CNAME' },
            { label: 'AAAA', value: 'AAAA' },
            { label: 'TXT', value: 'TXT' },
          ],
        },
        { key: 'target', label: '目标地址', type: 'text', placeholder: 'IP、CNAME 或 TXT 值' },
        {
          key: 'ssl',
          label: '需要 HTTPS/证书',
          type: 'checkbox',
          default: true,
        },
        {
          key: 'scope',
          label: '暴露范围',
          type: 'select',
          default: 'public',
          options: [
            { label: '公网', value: 'public' },
            { label: '内网', value: 'internal' },
          ],
        },
        { key: 'purpose', label: '用途说明', type: 'textarea', required: true },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'domain', label: '交付域名', type: 'text', required: true, sensitive: false },
        { key: 'recordType', label: '解析类型', type: 'text', sensitive: false },
        { key: 'target', label: '解析目标', type: 'text', sensitive: false },
        { key: 'sslStatus', label: '证书状态', type: 'text', sensitive: false },
        { key: 'certificateId', label: '证书/配置 ID', type: 'text', sensitive: false },
        { key: 'notes', label: '交付说明', type: 'textarea', sensitive: false },
      ],
    },
    envTemplate: 'APP_DOMAIN="${domain}"\nAPP_URL="https://${domain}"',
  },
  {
    key: 'git-account',
    name: 'Git 账号/仓库权限',
    description: '申请 GitHub、GitLab、Gitee 等代码平台账号或仓库权限',
    category: 'account',
    icon: 'git',
    approvalMode: 'manual',
    provisioningMode: 'credential_only',
    requestSchema: {
      fields: [
        {
          key: 'provider',
          label: '代码平台',
          type: 'select',
          default: 'gitlab',
          options: [
            { label: 'GitLab', value: 'gitlab' },
            { label: 'GitHub', value: 'github' },
            { label: 'Gitee', value: 'gitee' },
            { label: '其他', value: 'custom' },
          ],
        },
        {
          key: 'permission',
          label: '权限级别',
          type: 'select',
          default: 'read',
          options: [
            { label: '只读', value: 'read' },
            { label: '读写', value: 'write' },
            { label: '管理员', value: 'admin' },
          ],
        },
        { key: 'repoScope', label: '仓库/组织范围', type: 'text', required: true },
        { key: 'purpose', label: '申请用途', type: 'textarea', required: true },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'account', label: '账号', type: 'text', required: true, sensitive: false },
        { key: 'accessToken', label: '访问令牌', type: 'password', sensitive: true },
        { key: 'permission', label: '已授予权限', type: 'text', sensitive: false },
        { key: 'notes', label: '交付说明', type: 'textarea', sensitive: false },
      ],
    },
  },
  {
    key: 'cloud-account',
    name: '云厂商账号/权限',
    description: '申请阿里云、腾讯云、AWS 等云平台账号或权限',
    category: 'account',
    icon: 'cloud',
    approvalMode: 'manual',
    provisioningMode: 'credential_only',
    requestSchema: {
      fields: [
        {
          key: 'provider',
          label: '云厂商',
          type: 'select',
          default: 'aliyun',
          options: [
            { label: '阿里云', value: 'aliyun' },
            { label: '腾讯云', value: 'tencent' },
            { label: 'AWS', value: 'aws' },
            { label: '七牛云', value: 'qiniu' },
            { label: 'Cloudflare', value: 'cloudflare' },
            { label: '其他', value: 'custom' },
          ],
        },
        { key: 'accountName', label: '账号/角色名称', type: 'text', required: true },
        { key: 'permission', label: '权限范围', type: 'text', required: true },
        { key: 'purpose', label: '申请用途', type: 'textarea', required: true },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'account', label: '账号/角色', type: 'text', required: true, sensitive: false },
        { key: 'accessKeyId', label: 'Access Key ID', type: 'text', sensitive: false },
        { key: 'accessKeySecret', label: 'Access Key Secret', type: 'password', sensitive: true },
        { key: 'consoleUrl', label: '控制台地址', type: 'text', sensitive: false },
        { key: 'notes', label: '交付说明', type: 'textarea', sensitive: false },
      ],
    },
  },
  {
    key: 'custom-credential',
    name: '其他账号/凭证',
    description: '登记无法归类的第三方账号、密钥或接入凭证',
    category: 'custom',
    icon: 'key',
    approvalMode: 'manual',
    provisioningMode: 'credential_only',
    requestSchema: {
      fields: [
        { key: 'credentialName', label: '凭证名称', type: 'text', required: true },
        { key: 'credentialType', label: '凭证类型', type: 'text', required: true },
        { key: 'description', label: '使用说明', type: 'textarea', required: true },
        { key: 'expiresAt', label: '期望有效期', type: 'text', placeholder: '例如：长期 / 2026-12-31' },
      ],
    },
    deliverySchema: {
      fields: [
        { key: 'account', label: '账号/标识', type: 'text', sensitive: false },
        { key: 'secret', label: '密钥/密码', type: 'password', sensitive: true },
        { key: 'url', label: '登录或接入地址', type: 'text', sensitive: false },
        { key: 'notes', label: '交付说明', type: 'textarea', sensitive: false },
      ],
    },
  },
];

interface AuditInput {
  teamId: string;
  actorId?: string;
  resourceTypeId?: string;
  requestId?: string;
  instanceId?: string;
  provisioningRunId?: string;
  action: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ResourceRequestService implements OnModuleInit {
  private readonly logger = new Logger(ResourceRequestService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly resourcePoolService: ResourcePoolService,
    private readonly serverExecutor: ServerExecutorService,
  ) {
    const key = this.configService.get('ENCRYPTION_KEY', 'default-32-char-encryption-key!');
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  async onModuleInit() {
    await this.ensureDefaultResourceTypes();
  }

  private async ensureDefaultResourceTypes() {
    for (const type of DEFAULT_RESOURCE_TYPES) {
      await (this.prisma as PrismaAny).resourceType.upsert({
        where: { key: type.key },
        create: {
          key: type.key,
          name: type.name,
          description: type.description,
          category: type.category,
          icon: type.icon,
          enabled: type.enabled ?? true,
          requestSchema: type.requestSchema,
          deliverySchema: type.deliverySchema,
          envTemplate: type.envTemplate,
          approvalMode: type.approvalMode ?? 'manual',
          provisioningMode: type.provisioningMode ?? 'manual',
          provisioningConfig: type.provisioningConfig,
        },
        update: {
          name: type.name,
          description: type.description,
          category: type.category,
          icon: type.icon,
          requestSchema: type.requestSchema,
          deliverySchema: type.deliverySchema,
          envTemplate: type.envTemplate,
          approvalMode: type.approvalMode ?? 'manual',
          provisioningMode: type.provisioningMode ?? 'manual',
          provisioningConfig: type.provisioningConfig,
        },
      });
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private resourceRequestInclude() {
    return {
      resourceType: {
        select: {
          id: true,
          key: true,
          name: true,
          category: true,
          provisioningMode: true,
          deliverySchema: true,
          envTemplate: true,
        },
      },
      project: {
        select: { id: true, name: true },
      },
      projectEnvironment: {
        select: { id: true, key: true, name: true, status: true },
      },
      requester: {
        select: { id: true, name: true, email: true },
      },
      reviewer: {
        select: { id: true, name: true, email: true },
      },
      instance: {
        select: { id: true, name: true, status: true, expiresAt: true, releasedAt: true },
      },
    };
  }

  private resourceInstanceInclude() {
    return {
      resourceType: {
        select: { id: true, key: true, name: true, category: true },
      },
      project: {
        select: { id: true, name: true },
      },
      projectEnvironment: {
        select: { id: true, key: true, name: true, status: true },
      },
      request: {
        select: { id: true, title: true, status: true },
      },
    };
  }

  private maskInstance(instance: Record<string, unknown>) {
    const { credentials, ...safe } = instance;
    return {
      ...safe,
      hasCredentials: Boolean(credentials),
    };
  }

  private serializeProvisioningRun(run: JsonRecord) {
    return {
      id: run.id,
      requestId: run.requestId,
      resourceTypeId: run.resourceTypeId,
      resourceType: run.resourceType,
      actor: run.actor,
      replayOfRunId: run.replayOfRunId,
      replayOf: run.replayOf,
      replayAttemptsCount: this.asRecord(run._count).replayAttempts ?? 0,
      mode: run.mode,
      trigger: run.trigger,
      boundary: run.boundary,
      executorKey: run.executorKey,
      adapterKey: run.adapterKey,
      authAdapterKey: run.authAdapterKey,
      idempotencyKey: run.idempotencyKey,
      providerRunId: run.providerRunId,
      status: run.status,
      queueMode: run.queueMode,
      attempt: run.attempt,
      maxAttempts: run.maxAttempts,
      retryable: run.retryable,
      autoRetry: run.autoRetry,
      params: this.asRecord(run.params),
      result: this.asRecord(run.result),
      error: run.error,
      startedAt: run.startedAt,
      queuedAt: run.queuedAt,
      availableAt: run.availableAt,
      lockedAt: run.lockedAt,
      lockOwner: run.lockOwner,
      finishedAt: run.finishedAt,
      recoveredAt: run.recoveredAt,
      recoveryReason: run.recoveryReason,
      recoveryCount: run.recoveryCount,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  private async writeAudit(input: AuditInput) {
    return (this.prisma as PrismaAny).resourceAuditLog.create({
      data: {
        teamId: input.teamId,
        actorId: input.actorId,
        resourceTypeId: input.resourceTypeId,
        requestId: input.requestId,
        instanceId: input.instanceId,
        provisioningRunId: input.provisioningRunId,
        action: input.action,
        message: input.message,
        metadata: input.metadata ?? {},
      },
    });
  }

  async createResourceType(userId: string, dto: CreateResourceTypeDto) {
    const existing = await (this.prisma as PrismaAny).resourceType.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException('资源类型 key 已存在');
    }

    const resourceType = await (this.prisma as PrismaAny).resourceType.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        icon: dto.icon,
        enabled: dto.enabled ?? true,
        requestSchema: dto.requestSchema,
        deliverySchema: dto.deliverySchema,
        envTemplate: dto.envTemplate,
        approvalMode: dto.approvalMode ?? 'manual',
        provisioningMode: dto.provisioningMode ?? 'manual',
        provisioningConfig: dto.provisioningConfig,
        createdById: userId,
      },
    });

    this.logger.log(`Resource type created: ${resourceType.key}`);
    return resourceType;
  }

  async listResourceTypes(includeDisabled = false) {
    return (this.prisma as PrismaAny).resourceType.findMany({
      where: includeDisabled ? undefined : { enabled: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getResourceType(id: string) {
    const resourceType = await (this.prisma as PrismaAny).resourceType.findUnique({
      where: { id },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在');
    }

    return resourceType;
  }

  async updateResourceType(id: string, dto: UpdateResourceTypeDto) {
    await this.getResourceType(id);

    return (this.prisma as PrismaAny).resourceType.update({
      where: { id },
      data: dto,
    });
  }

  async disableResourceType(id: string) {
    await this.getResourceType(id);

    return (this.prisma as PrismaAny).resourceType.update({
      where: { id },
      data: { enabled: false },
    });
  }

  private async ensureProject(teamId: string, projectId?: string) {
    if (!projectId) return null;

    const project = await (this.prisma as PrismaAny).project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  private async resolveProjectEnvironment(
    teamId: string,
    environmentId?: string,
    projectId?: string,
  ) {
    if (!environmentId) return null;

    const environment = await (this.prisma as PrismaAny).projectEnvironment.findFirst({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在或已归档');
    }

    if (projectId && environment.projectId !== projectId) {
      throw new BadRequestException('项目环境不属于所选项目');
    }

    return environment;
  }

  private async ensureResourceType(resourceTypeId: string) {
    const resourceType = await (this.prisma as PrismaAny).resourceType.findFirst({
      where: { id: resourceTypeId, enabled: true },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在或已停用');
    }

    return resourceType;
  }

  async resolveRequestInputAccessScope(teamId: string, dto: CreateResourceRequestDto) {
    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId ?? null;
    await this.ensureProject(teamId, projectId || undefined);
    return {
      projectId,
      environmentId: environmentRef?.id ?? null,
    };
  }

  async getRequestAccessScope(teamId: string, id: string) {
    const request = await (this.prisma as PrismaAny).resourceRequest.findFirst({
      where: { id, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!request) {
      throw new NotFoundException('资源申请不存在');
    }

    return {
      projectId: request.projectId,
      environmentId: request.environmentId,
    };
  }

  async getInstanceAccessScope(teamId: string, id: string) {
    const instance = await (this.prisma as PrismaAny).resourceInstance.findFirst({
      where: { id, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!instance) {
      throw new NotFoundException('资源实例不存在');
    }

    return {
      projectId: instance.projectId,
      environmentId: instance.environmentId,
    };
  }

  async createRequest(teamId: string, userId: string, dto: CreateResourceRequestDto) {
    const resourceType = await this.ensureResourceType(dto.resourceTypeId);
    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId;
    await this.ensureProject(teamId, projectId);

    const request = await (this.prisma as PrismaAny).resourceRequest.create({
      data: {
        teamId,
        projectId,
        environmentId: environmentRef?.id,
        resourceTypeId: dto.resourceTypeId,
        requesterId: userId,
        title: dto.title,
        environment: dto.environment || environmentRef?.key,
        purpose: dto.purpose,
        spec: dto.spec,
        status: resourceType.approvalMode === 'none' ? 'approved' : 'pending',
        reviewedAt: resourceType.approvalMode === 'none' ? new Date() : null,
      },
      include: this.resourceRequestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: dto.resourceTypeId,
      requestId: request.id,
      action: 'request.created',
      message: '创建资源申请',
      metadata: { approvalMode: resourceType.approvalMode },
    });

    if (request.status === 'approved') {
      return this.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
    }

    return request;
  }

  async listRequests(teamId: string, query: ListResourceRequestsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;
    if (query.requesterId) where.requesterId = query.requesterId;

    return (this.prisma as PrismaAny).resourceRequest.findMany({
      where,
      include: this.resourceRequestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(teamId: string, id: string) {
    const request = await (this.prisma as PrismaAny).resourceRequest.findFirst({
      where: { id, teamId },
      include: {
        ...this.resourceRequestInclude(),
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('资源申请不存在');
    }

    return request;
  }

  async listProvisioningRuns(teamId: string, requestId: string, query: ListResourceProvisioningRunsQueryDto) {
    const request = await (this.prisma as PrismaAny).resourceRequest.findFirst({
      where: { id: requestId, teamId },
      select: { id: true },
    });

    if (!request) {
      throw new NotFoundException('资源申请不存在');
    }

    const where: Record<string, unknown> = {
      teamId,
      requestId,
    };
    if (query.status) where.status = query.status;
    if (query.mode) where.mode = query.mode;
    if (query.trigger) where.trigger = query.trigger;

    const runs = await (this.prisma as PrismaAny).resourceProvisioningRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: this.readListLimit(query.limit, 20, 100),
      include: {
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
        replayOf: { select: { id: true, status: true, trigger: true, providerRunId: true, startedAt: true } },
        _count: { select: { replayAttempts: true } },
      },
    });

    return runs.map((run: JsonRecord) => this.serializeProvisioningRun(run));
  }

  async replayProvisioningRun(teamId: string, userId: string, requestId: string, runId: string) {
    const existing = await this.getRequest(teamId, requestId);
    const run = await (this.prisma as PrismaAny).resourceProvisioningRun.findFirst({
      where: { id: runId, teamId, requestId },
    });

    if (!run) {
      throw new NotFoundException('资源交付运行不存在');
    }

    const mode = this.normalizeProvisioningMode(run.mode);
    if (mode !== 'api' && mode !== 'webhook') {
      throw new BadRequestException('只有 HTTP 外部交付运行可以重放');
    }

    const runStatus = this.readString(run.status);
    if (!['planned', 'blocked', 'failed'].includes(runStatus)) {
      throw new BadRequestException('只有已生成计划、已阻断或失败的交付运行可以重放');
    }

    const currentProvisioning = this.asRecord(this.asRecord(existing.result).provisioning);
    const currentRunId = this.readString(currentProvisioning.provisioningRunId);
    if (currentRunId !== run.id) {
      throw new BadRequestException('只能重放当前资源申请正在指向的交付运行');
    }

    return this.retryProvisioningRecord(teamId, userId, existing, {
      trigger: 'manual_retry',
      replayOfRunId: run.id,
      replaySourceStatus: runStatus,
    });
  }

  async getProvisioningRunSupervisor(teamId: string, query: ResourceProvisioningRunSupervisorQueryDto = {}) {
    const now = new Date();
    const staleAfterSeconds = this.readStaleProvisioningRunAfterSeconds(query.staleAfterSeconds);
    const staleBefore = new Date(now.getTime() - staleAfterSeconds * 1000);
    const sampleLimit = this.readListLimit(query.sampleLimit, 5, 20);
    const countWhere = (status: string) => ({
      teamId,
      status,
      mode: { in: ['api', 'webhook'] },
    });
    const [
      queued,
      running,
      staleRunning,
      planned,
      blocked,
      failed,
      completed,
      queuedSamples,
      staleSamples,
      recentProblemRuns,
    ] = await Promise.all([
      (this.prisma as PrismaAny).resourceProvisioningRun.count({ where: countWhere('queued') }),
      (this.prisma as PrismaAny).resourceProvisioningRun.count({ where: countWhere('running') }),
      (this.prisma as PrismaAny).resourceProvisioningRun.count({
        where: {
          ...countWhere('running'),
          startedAt: { lt: staleBefore },
        },
      }),
      (this.prisma as PrismaAny).resourceProvisioningRun.count({ where: countWhere('planned') }),
      (this.prisma as PrismaAny).resourceProvisioningRun.count({ where: countWhere('blocked') }),
      (this.prisma as PrismaAny).resourceProvisioningRun.count({ where: countWhere('failed') }),
      (this.prisma as PrismaAny).resourceProvisioningRun.count({ where: countWhere('completed') }),
      (this.prisma as PrismaAny).resourceProvisioningRun.findMany({
        where: countWhere('queued'),
        orderBy: [
          { availableAt: 'asc' },
          { startedAt: 'asc' },
        ],
        take: sampleLimit,
        include: {
          actor: { select: { id: true, name: true, email: true } },
          resourceType: { select: { id: true, key: true, name: true } },
          _count: { select: { replayAttempts: true } },
        },
      }),
      (this.prisma as PrismaAny).resourceProvisioningRun.findMany({
        where: {
          ...countWhere('running'),
          startedAt: { lt: staleBefore },
        },
        orderBy: { startedAt: 'asc' },
        take: sampleLimit,
        include: {
          actor: { select: { id: true, name: true, email: true } },
          resourceType: { select: { id: true, key: true, name: true } },
          _count: { select: { replayAttempts: true } },
        },
      }),
      (this.prisma as PrismaAny).resourceProvisioningRun.findMany({
        where: {
          teamId,
          mode: { in: ['api', 'webhook'] },
          status: { in: ['blocked', 'failed'] },
        },
        orderBy: { startedAt: 'desc' },
        take: sampleLimit,
        include: {
          actor: { select: { id: true, name: true, email: true } },
          resourceType: { select: { id: true, key: true, name: true } },
          replayOf: { select: { id: true, status: true, trigger: true, providerRunId: true, startedAt: true } },
          _count: { select: { replayAttempts: true } },
        },
      }),
    ]);
    const counts: ProvisioningRunStatusCounts = {
      queued,
      running,
      staleRunning,
      planned,
      blocked,
      failed,
      completed,
    };

    return {
      generatedAt: now.toISOString(),
      staleAfterSeconds,
      staleBefore: staleBefore.toISOString(),
      scheduler: {
        autoRetryEnabled: this.configService.get('RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED', 'false') === 'true',
        staleRecoveryEnabled: this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED', 'false') === 'true',
        intervalSeconds: this.readPositiveInteger(
          this.configService.get('RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_INTERVAL_SECONDS', '60'),
        ) || 60,
        queueingEnabled: this.httpProvisioningQueueEnabled(),
      },
      counts,
      samples: {
        queued: queuedSamples.map((run: JsonRecord) => this.serializeProvisioningRun(run)),
        staleRunning: staleSamples.map((run: JsonRecord) => this.serializeProvisioningRun(run)),
        recentProblems: recentProblemRuns.map((run: JsonRecord) => this.serializeProvisioningRun(run)),
      },
    };
  }

  async recoverTeamStaleProvisioningRuns(
    teamId: string,
    dto: RecoverStaleResourceProvisioningRunsDto = {},
  ) {
    return this.recoverStaleProvisioningRuns({
      teamId,
      limit: this.readListLimit(dto.limit, 10, 100),
      staleAfterSeconds: this.readStaleProvisioningRunAfterSeconds(dto.staleAfterSeconds),
    });
  }

  async processNextQueuedProvisioningRun(
    teamId: string,
    userId: string,
    dto: ProcessQueuedResourceProvisioningRunDto = {},
  ): Promise<ProvisioningQueueProcessSummary> {
    const now = new Date();
    const run = await (this.prisma as PrismaAny).resourceProvisioningRun.findFirst({
      where: {
        teamId,
        status: 'queued',
        queueMode: 'queued',
        mode: { in: ['api', 'webhook'] },
        ...(dto.runId
          ? { id: dto.runId }
          : { OR: [{ availableAt: null }, { availableAt: { lte: now } }] }),
      },
      orderBy: [
        { availableAt: 'asc' },
        { startedAt: 'asc' },
      ],
      include: {
        request: {
          include: this.resourceRequestInclude(),
        },
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
        _count: { select: { replayAttempts: true } },
      },
    });

    if (!run) {
      return {
        scanned: 0,
        processed: 0,
        skipped: 0,
        failed: 0,
        reason: dto.runId ? 'queued_run_not_found' : 'queue_empty',
      };
    }

    const claim = await (this.prisma as PrismaAny).resourceProvisioningRun.updateMany({
      where: {
        id: run.id,
        teamId,
        status: 'queued',
        queueMode: 'queued',
      },
      data: {
        status: 'running',
        startedAt: now,
        lockedAt: now,
        lockOwner: userId,
      },
    });

    if (claim.count !== 1) {
      return {
        scanned: 1,
        processed: 0,
        skipped: 1,
        failed: 0,
        reason: 'queue_claim_conflict',
        run: this.serializeProvisioningRun(run),
      };
    }

    const claimedRun = {
      ...run,
      status: 'running',
      startedAt: now,
      lockedAt: now,
      lockOwner: userId,
    } as ResourceProvisioningRunRecord;
    const request = this.asRecord(run.request);
    const currentProvisioning = this.asRecord(this.asRecord(request.result).provisioning);
    const currentRunId = this.readString(currentProvisioning.provisioningRunId);

    if (request.status !== 'approved' || currentRunId !== run.id) {
      const reason = request.status !== 'approved'
        ? 'queued_request_not_approved'
        : 'queued_run_not_current';
      const skippedProvisioning = {
        ...currentProvisioning,
        mode: run.mode,
        status: 'failed',
        boundary: run.boundary || 'http_adapter',
        provisioningRunId: run.id,
        replayOfRunId: run.replayOfRunId || undefined,
        idempotencyKey: run.idempotencyKey,
        queueMode: run.queueMode || 'queued',
        queuedAt: this.dateToIso(run.queuedAt),
        availableAt: this.dateToIso(run.availableAt),
        reason,
        retryable: false,
        failedAt: now.toISOString(),
      };
      await this.finishProvisioningRun(claimedRun, skippedProvisioning);
      await this.writeAudit({
        teamId,
        actorId: userId,
        resourceTypeId: run.resourceTypeId as string,
        requestId: run.requestId as string,
        provisioningRunId: run.id as string,
        action: 'provisioning.queue_skipped',
        message: '跳过不再可执行的资源交付队列运行',
        metadata: skippedProvisioning,
      });
      return {
        scanned: 1,
        processed: 0,
        skipped: 1,
        failed: 0,
        reason,
        run: this.serializeProvisioningRun({ ...claimedRun, status: 'failed', error: reason, finishedAt: now }),
      };
    }

    try {
      const processed = await this.runApprovedProvisioningProcessor(teamId, userId, request, {
        trigger: this.normalizeProvisioningProcessorTrigger(run.trigger),
        replayOfRunId: this.readString(run.replayOfRunId) || undefined,
        provisioningRunId: run.id as string,
        forceInline: true,
      });
      return {
        scanned: 1,
        processed: 1,
        skipped: 0,
        failed: 0,
        run: this.serializeProvisioningRun(claimedRun),
        request: processed,
      };
    } catch (error) {
      const reason = this.errorMessage(error);
      const failedProvisioning = {
        ...currentProvisioning,
        mode: run.mode,
        status: 'failed',
        boundary: run.boundary || 'http_adapter',
        provisioningRunId: run.id,
        replayOfRunId: run.replayOfRunId || undefined,
        idempotencyKey: run.idempotencyKey,
        queueMode: run.queueMode || 'queued',
        queuedAt: this.dateToIso(run.queuedAt),
        availableAt: this.dateToIso(run.availableAt),
        reason,
        retryable: true,
        failedAt: now.toISOString(),
      };
      await this.finishProvisioningRun(claimedRun, failedProvisioning);
      await this.writeAudit({
        teamId,
        actorId: userId,
        resourceTypeId: run.resourceTypeId as string,
        requestId: run.requestId as string,
        provisioningRunId: run.id as string,
        action: 'provisioning.queue_failed',
        message: '资源交付队列运行执行失败',
        metadata: failedProvisioning,
      });
      return {
        scanned: 1,
        processed: 0,
        skipped: 0,
        failed: 1,
        reason,
        run: this.serializeProvisioningRun({ ...claimedRun, status: 'failed', error: reason, finishedAt: now }),
      };
    }
  }

  async reviewRequest(teamId: string, userId: string, id: string, dto: ReviewResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);

    if (existing.status !== 'pending') {
      throw new BadRequestException('只有待审批的申请可以审批');
    }

    const request = await (this.prisma as PrismaAny).resourceRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewerId: userId,
        reviewedAt: new Date(),
        approvalComment: dto.comment,
      },
      include: this.resourceRequestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      action: dto.status === 'approved' ? 'request.approved' : 'request.rejected',
      message: dto.comment,
    });

    if (dto.status === 'approved') {
      return this.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
    }

    return request;
  }

  async completeRequest(teamId: string, userId: string, id: string, dto: CompleteResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);

    if (!['approved', 'pending'].includes(existing.status)) {
      throw new BadRequestException('当前申请状态不能交付');
    }

    const mode = this.normalizeProvisioningMode(existing.resourceType?.provisioningMode);
    return this.completeProvisionedRequest(teamId, userId, existing, {
      createInstance: dto.createInstance !== false,
      instanceName: dto.instanceName || existing.title,
      config: this.asRecord(dto.config),
      delivery: this.asRecord(dto.delivery),
      credentials: this.asRecord(dto.credentials),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      provisioning: {
        mode,
        status: 'completed',
        boundary: 'manual_delivery',
        completedAt: new Date().toISOString(),
      },
      auditMetadata: {
        createInstance: dto.createInstance !== false,
        provisioningMode: mode,
        boundary: 'manual_delivery',
      },
    });
  }

  async retryProvisioning(teamId: string, userId: string, id: string) {
    const existing = await this.getRequest(teamId, id);
    return this.retryProvisioningRecord(teamId, userId, existing, { trigger: 'manual_retry' });
  }

  private async retryProvisioningRecord(
    teamId: string,
    userId: string | undefined,
    existing: JsonRecord,
    context: ProvisioningProcessorContext,
  ) {
    if (existing.status !== 'approved') {
      throw new BadRequestException('只有已审批且未交付的申请可以重试交付处理器');
    }

    const previousProvisioning = this.asRecord(this.asRecord(existing.result).provisioning);
    const previousStatus = this.readString(previousProvisioning.status);
    const retryableStatuses = context.trigger === 'auto_retry' ? ['blocked'] : ['blocked', 'planned', 'failed'];
    if (!retryableStatuses.includes(previousStatus)) {
      throw new BadRequestException('只有已阻断、已生成计划或失败的交付处理器可以重试');
    }

    const resourceType = await this.getProvisioningResourceType(existing.resourceTypeId as string);
    const mode = this.normalizeProvisioningMode(resourceType.provisioningMode);
    if (mode === 'manual' || mode === 'credential_only') {
      throw new BadRequestException('人工交付或纯凭据资源不需要重试交付处理器');
    }
    const isReplay = Boolean(context.replayOfRunId);
    const auditInput: AuditInput = {
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      provisioningRunId: context.replayOfRunId,
      action: context.trigger === 'auto_retry'
        ? 'provisioning.auto_retry_requested'
        : isReplay
          ? 'provisioning.run_replay_requested'
          : 'provisioning.retry_requested',
      message: context.trigger === 'auto_retry'
        ? '自动补偿重新触发资源交付处理器'
        : isReplay
          ? '重放资源交付运行'
          : '重新触发资源交付处理器',
      metadata: {
        mode,
        previousStatus,
        previousBoundary: previousProvisioning.boundary,
        previousReason: previousProvisioning.reason,
        previousIdempotencyKey: previousProvisioning.idempotencyKey,
        trigger: context.trigger,
        replayOfRunId: context.replayOfRunId,
        replaySourceStatus: context.replaySourceStatus,
        retryRequestedAt: new Date().toISOString(),
      },
    };

    if (context.trigger === 'auto_retry') {
      if (mode !== 'api' && mode !== 'webhook') {
        throw new BadRequestException('自动补偿只支持 HTTP 外部交付处理器');
      }

      await this.writeAudit(auditInput);
      return this.provisionWithHttpAdapter(
        teamId,
        userId,
        existing,
        resourceType,
        mode,
        context,
      );
    }

    await this.writeAudit(auditInput);
    return this.runApprovedProvisioningProcessor(teamId, userId as string, existing, context);
  }

  async processDueProvisioningAutoRetries(
    options: { limit?: number; now?: Date } = {},
  ): Promise<ProvisioningAutoRetrySummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const requests = await (this.prisma as PrismaAny).resourceRequest.findMany({
      where: { status: 'approved' },
      include: this.resourceRequestInclude(),
      orderBy: { updatedAt: 'asc' },
      take: Math.min(limit * 5, 250),
    });

    const summary: ProvisioningAutoRetrySummary = {
      scanned: requests.length,
      attempted: 0,
      completed: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
    };

    for (const request of requests) {
      if (summary.attempted >= limit) {
        break;
      }

      if (!this.isProvisioningAutoRetryDue(request, now)) {
        summary.skipped += 1;
        continue;
      }

      summary.attempted += 1;
      try {
        const result = await this.retryProvisioningRecord(
          request.teamId as string,
          undefined,
          request,
          { trigger: 'auto_retry' },
        );
        const resultProvisioning = this.asRecord(this.asRecord(result.result).provisioning);
        const status = this.readString(resultProvisioning.status);
        if (status === 'completed') {
          summary.completed += 1;
        } else if (status === 'blocked') {
          summary.blocked += 1;
        }
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`ResourceRequest provisioning auto retry failed: ${this.errorMessage(error)}`);
      }
    }

    return summary;
  }

  async recoverStaleProvisioningRuns(
    options: { teamId?: string; limit?: number; now?: Date; staleAfterSeconds?: number } = {},
  ): Promise<ProvisioningStaleRecoverySummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const staleAfterSeconds = this.readStaleProvisioningRunAfterSeconds(options.staleAfterSeconds);
    const staleBefore = new Date(now.getTime() - staleAfterSeconds * 1000);
    const runs = await (this.prisma as PrismaAny).resourceProvisioningRun.findMany({
      where: {
        ...(options.teamId ? { teamId: options.teamId } : {}),
        status: 'running',
        mode: { in: ['api', 'webhook'] },
        startedAt: { lt: staleBefore },
      },
      orderBy: { startedAt: 'asc' },
      take: limit,
      include: {
        request: {
          include: this.resourceRequestInclude(),
        },
      },
    });

    const summary: ProvisioningStaleRecoverySummary = {
      scanned: runs.length,
      recovered: 0,
      requestUpdated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const run of runs) {
      try {
        const request = this.asRecord(run.request);
        const currentProvisioning = this.asRecord(this.asRecord(request.result).provisioning);
        const currentRunId = this.readString(currentProvisioning.provisioningRunId);
        const shouldUpdateRequest = request.status === 'approved' && currentRunId === run.id;
        const recoveryReason = 'stale_running_recovered';
        const recovery = {
          reason: recoveryReason,
          recoveredAt: now.toISOString(),
          staleAfterSeconds,
          staleBefore: staleBefore.toISOString(),
          previousStatus: run.status,
          currentRequestRun: shouldUpdateRequest,
        };
        const recoveryCount = (this.readNonNegativeInteger(run.recoveryCount) || 0) + 1;
        const recoveredRunProvisioning = {
          ...this.asRecord(this.asRecord(run.result).provisioning),
          mode: run.mode,
          status: 'failed',
          boundary: run.boundary || 'http_adapter',
          provisioningRunId: run.id,
          idempotencyKey: run.idempotencyKey,
          reason: recoveryReason,
          retryable: true,
          recoveredAt: now.toISOString(),
          recovery,
        };

        await (this.prisma as PrismaAny).resourceProvisioningRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            retryable: true,
            error: recoveryReason,
            result: {
              ...this.asRecord(run.result),
              provisioning: recoveredRunProvisioning,
              recovery,
            },
            finishedAt: now,
            recoveredAt: now,
            recoveryReason,
            recoveryCount,
          },
        });

        await this.writeAudit({
          teamId: run.teamId as string,
          resourceTypeId: run.resourceTypeId as string,
          requestId: run.requestId as string,
          provisioningRunId: run.id as string,
          action: 'provisioning.run_stale_recovered',
          message: '恢复超时未结束的资源交付运行',
          metadata: recovery,
        });

        summary.recovered += 1;

        if (shouldUpdateRequest) {
          await this.markProvisioningStatus(run.teamId as string, undefined, request, {
            ...currentProvisioning,
            mode: run.mode,
            status: 'blocked',
            boundary: run.boundary || 'http_adapter',
            provisioningRunId: run.id,
            idempotencyKey: run.idempotencyKey,
            reason: recoveryReason,
            retryable: true,
            recoveredAt: now.toISOString(),
            recovery,
          });
          summary.requestUpdated += 1;
        } else {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`ResourceRequest provisioning run stale recovery failed: ${this.errorMessage(error)}`);
      }
    }

    return summary;
  }

  private async runApprovedProvisioningProcessor(
    teamId: string,
    userId: string,
    request: JsonRecord,
    context: ProvisioningProcessorContext,
  ) {
    const resourceType = await this.getProvisioningResourceType(request.resourceTypeId as string);
    const mode = this.normalizeProvisioningMode(resourceType.provisioningMode);

    if (mode === 'manual' || mode === 'credential_only') {
      return request;
    }

    if (mode === 'pool') {
      return this.provisionFromPool(teamId, userId, request, resourceType);
    }

    if (mode === 'script') {
      return this.provisionWithScript(teamId, userId, request, resourceType);
    }

    return this.provisionWithHttpAdapter(teamId, userId, request, resourceType, mode, context);
  }

  private async getProvisioningResourceType(resourceTypeId: string): Promise<ProvisioningResourceType> {
    const resourceType = await (this.prisma as PrismaAny).resourceType.findUnique({
      where: { id: resourceTypeId },
      select: {
        id: true,
        key: true,
        name: true,
        provisioningMode: true,
        provisioningConfig: true,
        deliverySchema: true,
      },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在');
    }

    return resourceType;
  }

  private async provisionFromPool(
    teamId: string,
    userId: string,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
  ) {
    const provisioningConfig = this.asRecord(resourceType.provisioningConfig);
    const poolId = this.readString(provisioningConfig.poolId);

    if (!poolId) {
      return this.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        reason: 'missing_pool_id',
        blockedAt: new Date().toISOString(),
      });
    }

    const projectId = this.readString(request.projectId);
    if (!projectId) {
      return this.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        poolId,
        reason: 'missing_project_id',
        blockedAt: new Date().toISOString(),
      });
    }

    let allocation: { id: string; type?: string; resourceName: string; credentials?: unknown };
    try {
      allocation = await this.resourcePoolService.allocateResource(
        {
          poolId,
          projectId,
          resourceName: this.resolveRequestedResourceName(request.spec),
        },
        userId,
        teamId,
      );
    } catch (error) {
      return this.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        poolId,
        reason: this.errorMessage(error),
        blockedAt: new Date().toISOString(),
      });
    }

    const split = this.splitDeliveryAndCredentials(allocation.credentials, resourceType.deliverySchema);
    const completedAt = new Date().toISOString();
    const completion = await this.completeProvisionedRequest(teamId, userId, request, {
      createInstance: true,
      instanceName: allocation.resourceName || (request.title as string),
      config: {
        provisioningMode: 'pool',
        poolId,
        poolAllocationId: allocation.id,
        poolType: allocation.type || resourceType.key,
        resourceName: allocation.resourceName,
      },
      delivery: {
        ...split.delivery,
        poolAllocationId: allocation.id,
        poolType: allocation.type || resourceType.key,
        resourceName: allocation.resourceName,
      },
      credentials: split.credentials,
      provisioning: {
        mode: 'pool',
        status: 'completed',
        boundary: 'resource_pool',
        poolId,
        allocationId: allocation.id,
        resourceName: allocation.resourceName,
        poolType: allocation.type || resourceType.key,
        completedAt,
      },
      auditMetadata: {
        createInstance: true,
        provisioningMode: 'pool',
        boundary: 'resource_pool',
        poolId,
        allocationId: allocation.id,
        resourceName: allocation.resourceName,
      },
    });

    return completion.request;
  }

  private async provisionWithScript(
    teamId: string,
    userId: string,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
  ) {
    const provisioningConfig = this.asRecord(resourceType.provisioningConfig);
    const steps = this.buildScriptProvisioningSteps(provisioningConfig);

    if (steps.length === 0) {
      return this.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: 'missing_script_steps',
        blockedAt: new Date().toISOString(),
      });
    }

    const serverId = this.readString(provisioningConfig.serverId);
    const target = await this.serverExecutor.resolveTarget(teamId, serverId || null);
    const dryRun = this.readBoolean(provisioningConfig.dryRun, true);
    const queue = this.readBoolean(provisioningConfig.queue, false);
    const adapterKey = this.readString(provisioningConfig.adapterKey) || 'resource-provisioning-script';
    const idempotencyKey = this.buildProvisioningIdempotencyKey(request, resourceType, 'script', provisioningConfig);
    let credentialRef: ProvisioningCredentialRef | null;

    try {
      credentialRef = await this.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: this.errorMessage(error),
        idempotencyKey,
        blockedAt: new Date().toISOString(),
      });
    }

    const executionInput: ServerExecutionInput = {
      teamId,
      userId,
      operationKey: this.readString(provisioningConfig.operationKey) || `resource.provision.${resourceType.key}`,
      adapterKey,
      dryRun,
      target,
      steps,
      warnings: this.readStringArray(provisioningConfig.warnings),
      metadata: {
        requestId: request.id,
        resourceTypeId: resourceType.id,
        resourceTypeKey: resourceType.key,
        projectId: request.projectId,
        environmentId: request.environmentId,
        provisioningMode: 'script',
        boundary: 'resource_request',
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        businessRunSync: queue ? 'resource_request_provisioning' : undefined,
      },
      blockOnWarnings: !dryRun,
      requiredConfirmationText: this.readString(provisioningConfig.requiredConfirmationText) || undefined,
      confirmationText: this.readString(provisioningConfig.confirmationText) || undefined,
    };

    let execution: ServerExecutionResult;
    try {
      execution = queue
        ? await this.serverExecutor.queueExecution(executionInput, {
            maxAttempts: this.readPositiveInteger(provisioningConfig.maxAttempts),
          })
        : await this.serverExecutor.execute(executionInput);
    } catch (error) {
      return this.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: this.errorMessage(error),
        serverId: serverId || undefined,
        dryRun,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        blockedAt: new Date().toISOString(),
      });
    }

    const provisioningStatus = this.mapScriptProvisioningStatus(execution, dryRun);
    return this.markProvisioningStatus(teamId, userId, request, {
      mode: 'script',
      status: provisioningStatus,
      boundary: 'server_executor',
      dryRun,
      serverId: serverId || undefined,
      targetTransport: target.transport,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      requiresManualCompletion: provisioningStatus !== 'completed',
      ...this.summarizeServerExecution(execution),
      updatedAt: new Date().toISOString(),
    });
  }

  private async provisionWithHttpAdapter(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    mode: Extract<ProvisioningMode, 'webhook' | 'api'>,
    context: ProvisioningProcessorContext,
  ) {
    const provisioningConfig = this.asRecord(resourceType.provisioningConfig);
    const url = this.readString(provisioningConfig.url) || this.readString(provisioningConfig.endpoint);
    const method = (this.readString(provisioningConfig.method) || 'POST').toUpperCase();
    const idempotencyKey = this.buildProvisioningIdempotencyKey(request, resourceType, mode, provisioningConfig);
    const maxAttempts = this.readHttpMaxAttempts(provisioningConfig);
    const queueConfig = this.readProvisioningQueueConfig(provisioningConfig);
    const provisioningRun = await this.createProvisioningRun(
      teamId,
      userId,
      request,
      resourceType,
      mode,
      context,
      provisioningConfig,
      {
        method,
        url: url ? this.redactUrl(url) : undefined,
        idempotencyKey,
        maxAttempts,
        queue: queueConfig,
      },
    );

    if (queueConfig.enabled && !context.forceInline) {
      return this.markProvisioningQueuedWithRun(teamId, userId, request, {
        mode,
        method,
        url: url ? this.redactUrl(url) : undefined,
        idempotencyKey,
        queue: queueConfig,
      }, provisioningRun);
    }

    if (!url) {
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        idempotencyKey,
        reason: 'missing_url',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    if (!['POST', 'PUT', 'PATCH', 'GET'].includes(method)) {
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        idempotencyKey,
        reason: 'unsupported_method',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let credentialRef: ProvisioningCredentialRef | null;
    try {
      credentialRef = await this.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        idempotencyKey,
        reason: this.errorMessage(error),
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    await this.attachProvisioningRunCredentialRef(provisioningRun, credentialRef);

    if (!this.httpProvisioningEnabled()) {
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'planned',
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        reason: 'http_dispatch_disabled',
        requiresManualCompletion: true,
        plannedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    const fetchFn = (globalThis as typeof globalThis & { fetch?: HttpProvisioningFetch }).fetch;
    if (!fetchFn) {
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        reason: 'fetch_unavailable',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let response: HttpProvisioningResponse | null = null;
    let responseBody: unknown = {};
    let attempt = 0;
    const timeoutMs = this.readPositiveInteger(provisioningConfig.timeoutMs) || 15000;
    const retryStatusCodes = this.readHttpRetryStatusCodes(provisioningConfig);
    const retryOnNetworkError = this.readBoolean(provisioningConfig.retryOnNetworkError, true);
    const requestPayload = this.buildExternalProvisioningPayload(
      request,
      resourceType,
      mode,
      credentialRef,
      idempotencyKey,
    );

    for (attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        response = await fetchFn(url, {
          method,
          headers: this.buildHttpProvisioningHeaders(provisioningConfig, idempotencyKey, credentialRef),
          body: method === 'GET'
            ? undefined
            : JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        responseBody = await this.readHttpProvisioningBody(response);

        if (response.ok || !this.isRetryableHttpStatus(response.status, retryStatusCodes) || attempt >= maxAttempts) {
          break;
        }
      } catch (error) {
        if (!retryOnNetworkError || attempt >= maxAttempts) {
          const blockedAt = new Date();
          return this.markProvisioningStatusWithRun(teamId, userId, request, {
            mode,
            status: 'blocked',
            boundary: 'http_adapter',
            method,
            url: this.redactUrl(url),
            idempotencyKey,
            credentialRef: credentialRef || undefined,
            reason: this.errorMessage(error),
            retryable: retryOnNetworkError,
            attempt,
            maxAttempts,
            attemptsExhausted: attempt >= maxAttempts,
            blockedAt: blockedAt.toISOString(),
            ...this.buildHttpAutoRetryMetadata(
              provisioningConfig,
              request,
              retryOnNetworkError,
              context,
              blockedAt,
            ),
          }, provisioningRun);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response) {
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        reason: 'http_response_unavailable',
        retryable: false,
        attempt,
        maxAttempts,
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    if (!response.ok) {
      const retryable = this.isRetryableHttpStatus(response.status, retryStatusCodes);
      const blockedAt = new Date();
      return this.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        httpStatus: response.status,
        reason: this.readString((this.asRecord(responseBody)).message) || response.statusText || `http_${response.status}`,
        retryable,
        attempt,
        maxAttempts,
        attemptsExhausted: attempt >= maxAttempts,
        blockedAt: blockedAt.toISOString(),
        ...this.buildHttpAutoRetryMetadata(
          provisioningConfig,
          request,
          retryable,
          context,
          blockedAt,
        ),
      }, provisioningRun);
    }

    const responseRecord = this.asRecord(responseBody);
    const deliverySource = this.resolveHttpProvisioningDeliverySource(responseRecord);
    const split = this.splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
    const adapterConfig = this.asRecord(responseRecord.config);
    const createInstance = this.readBoolean(responseRecord.createInstance, this.readBoolean(provisioningConfig.createInstanceOnSuccess, true));
    const shouldCreateInstance = createInstance && (
      this.hasRecordValues(split.delivery)
      || this.hasRecordValues(split.credentials)
      || this.hasRecordValues(adapterConfig)
    );
    const providerRunId = this.readString(responseRecord.providerRunId)
      || this.readString(responseRecord.runId)
      || this.readString(responseRecord.id);
    const completedAt = new Date().toISOString();
    const completedProvisioning = {
      mode,
      status: 'completed',
      boundary: 'http_adapter',
      provisioningRunId: provisioningRun.id,
      replayOfRunId: context.replayOfRunId,
      method,
      url: this.redactUrl(url),
      httpStatus: response.status,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      providerRunId: providerRunId || undefined,
      attempt,
      maxAttempts,
      responseKeys: Object.keys(responseRecord),
      deliveryKeys: Object.keys(split.delivery),
      credentialKeys: Object.keys(split.credentials),
      createInstance: shouldCreateInstance,
      completedAt,
    };
    const completion = await this.completeProvisionedRequest(teamId, userId, request, {
      createInstance: shouldCreateInstance,
      instanceName: (
        this.readString(responseRecord.instanceName)
        || this.readString(responseRecord.resourceName)
        || this.resolveRequestedResourceName(request.spec)
        || (request.title as string)
      ),
      config: {
        ...adapterConfig,
        provisioningMode: mode,
        adapter: mode,
        endpoint: this.redactUrl(url),
        providerRunId: providerRunId || undefined,
        credentialRef: credentialRef || undefined,
      },
      delivery: split.delivery,
      credentials: split.credentials,
      provisioning: completedProvisioning,
      auditMetadata: {
        createInstance: shouldCreateInstance,
        provisioningMode: mode,
        boundary: 'http_adapter',
        method,
        url: this.redactUrl(url),
        httpStatus: response.status,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        providerRunId: providerRunId || undefined,
        provisioningRunId: provisioningRun.id,
        attempt,
        maxAttempts,
        responseKeys: Object.keys(responseRecord),
      },
    });

    await this.finishProvisioningRun(provisioningRun, completedProvisioning);

    return completion.request;
  }

  private async createProvisioningRun(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    mode: Extract<ProvisioningMode, 'webhook' | 'api'>,
    context: ProvisioningProcessorContext,
    config: JsonRecord,
    input: {
      method: string;
      url?: string;
      idempotencyKey: string;
      maxAttempts: number;
      queue: ProvisioningQueueConfig;
    },
  ): Promise<ResourceProvisioningRunRecord> {
    if (context.provisioningRunId) {
      const existingRun = await (this.prisma as PrismaAny).resourceProvisioningRun.findFirst({
        where: {
          id: context.provisioningRunId,
          teamId,
          requestId: request.id,
        },
      });

      if (!existingRun) {
        throw new NotFoundException('资源交付运行不存在');
      }

      return existingRun as ResourceProvisioningRunRecord;
    }

    const now = new Date();
    const queuedAt = input.queue.enabled ? now : undefined;
    const availableAt = input.queue.enabled
      ? new Date(now.getTime() + input.queue.delaySeconds * 1000)
      : undefined;
    const params: JsonRecord = {
      method: input.method,
      idempotencyKey: input.idempotencyKey,
      requestId: request.id,
      resourceTypeId: resourceType.id,
      resourceTypeKey: resourceType.key,
      trigger: context.trigger,
      queueMode: input.queue.enabled ? 'queued' : 'inline',
    };
    if (context.replayOfRunId) {
      params.replayOfRunId = context.replayOfRunId;
    }
    if (input.url) {
      params.url = input.url;
    }
    if (input.queue.enabled) {
      params.queuedAt = queuedAt?.toISOString();
      params.availableAt = availableAt?.toISOString();
      params.queueDelaySeconds = input.queue.delaySeconds;
    }
    if (request.projectId) {
      params.projectId = request.projectId;
    }
    if (request.environmentId) {
      params.environmentId = request.environmentId;
    }

    const run = await (this.prisma as PrismaAny).resourceProvisioningRun.create({
      data: {
        teamId,
        actorId: userId,
        replayOfRunId: context.replayOfRunId,
        requestId: request.id,
        resourceTypeId: resourceType.id,
        projectId: this.readString(request.projectId) || undefined,
        environmentId: this.readString(request.environmentId) || undefined,
        mode,
        trigger: context.trigger,
        boundary: 'http_adapter',
        executorKey: this.readString(config.executorKey) || 'resource-request',
        adapterKey: this.readString(config.adapterKey) || mode,
        idempotencyKey: input.idempotencyKey,
        status: input.queue.enabled ? 'queued' : 'running',
        queueMode: input.queue.enabled ? 'queued' : 'inline',
        attempt: 0,
        maxAttempts: input.maxAttempts,
        autoRetry: context.trigger === 'auto_retry',
        params,
        queuedAt,
        availableAt,
      },
    });

    return run as ResourceProvisioningRunRecord;
  }

  private async attachProvisioningRunCredentialRef(
    run: ResourceProvisioningRunRecord,
    credentialRef: ProvisioningCredentialRef | null,
  ) {
    if (!credentialRef) {
      return;
    }

    await (this.prisma as PrismaAny).resourceProvisioningRun.update({
      where: { id: run.id },
      data: {
        credentialId: credentialRef.referenceId,
        authAdapterKey: credentialRef.authAdapterKey,
      },
    });
  }

  private async markProvisioningQueuedWithRun(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    input: {
      mode: Extract<ProvisioningMode, 'webhook' | 'api'>;
      method: string;
      url?: string;
      idempotencyKey: string;
      queue: ProvisioningQueueConfig;
    },
    run: ResourceProvisioningRunRecord,
  ) {
    return this.markProvisioningStatus(teamId, userId, request, {
      mode: input.mode,
      status: 'queued',
      boundary: 'http_adapter',
      method: input.method,
      url: input.url,
      idempotencyKey: input.idempotencyKey,
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      queueMode: 'queued',
      queueDelaySeconds: input.queue.delaySeconds,
      queuedAt: this.dateToIso(run.queuedAt) || new Date().toISOString(),
      availableAt: this.dateToIso(run.availableAt),
      reason: 'http_dispatch_queued',
    });
  }

  private async markProvisioningStatusWithRun(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    provisioning: JsonRecord,
    run: ResourceProvisioningRunRecord,
  ) {
    const provisioningWithRun = {
      ...provisioning,
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
    };
    const updated = await this.markProvisioningStatus(teamId, userId, request, provisioningWithRun);
    await this.finishProvisioningRun(run, provisioningWithRun);
    return updated;
  }

  private async finishProvisioningRun(
    run: ResourceProvisioningRunRecord,
    provisioning: JsonRecord,
  ) {
    const status = this.readString(provisioning.status) || 'blocked';
    const providerRunId = this.readString(provisioning.providerRunId);
    const reason = this.readString(provisioning.reason) || this.readString(provisioning.error);
    const attempt = this.readNonNegativeInteger(provisioning.attempt) ?? this.readNonNegativeInteger(run.attempt) ?? 0;
    const maxAttempts = this.readPositiveInteger(provisioning.maxAttempts)
      || this.readPositiveInteger(run.maxAttempts)
      || 1;
    const autoRetry = this.asRecord(provisioning.autoRetry);
    const data: JsonRecord = {
      status,
      attempt,
      maxAttempts,
      retryable: this.readBoolean(provisioning.retryable, false),
      autoRetry: this.readBoolean(autoRetry.enabled, this.readBoolean(run.autoRetry, false)),
      result: {
        provisioning,
      },
      lockedAt: null,
      lockOwner: null,
      finishedAt: new Date(),
    };

    if (providerRunId) {
      data.providerRunId = providerRunId;
    }
    if (reason && status !== 'completed') {
      data.error = reason;
    }

    await (this.prisma as PrismaAny).resourceProvisioningRun.update({
      where: { id: run.id },
      data,
    });
  }

  private async markProvisioningStatus(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    provisioning: JsonRecord,
  ) {
    const nextResult = {
      ...this.asRecord(request.result),
      provisioning,
    };
    const updated = await (this.prisma as PrismaAny).resourceRequest.update({
      where: { id: request.id },
      data: { result: nextResult },
      include: this.resourceRequestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: request.resourceTypeId as string,
      requestId: request.id as string,
      provisioningRunId: this.readString(provisioning.provisioningRunId) || undefined,
      action: this.provisioningAuditAction(provisioning.status),
      message: this.provisioningAuditMessage(provisioning.status),
      metadata: provisioning,
    });

    return updated;
  }

  private async completeProvisionedRequest(
    teamId: string,
    userId: string | undefined,
    existing: JsonRecord,
    input: CompleteProvisionedRequestInput,
  ) {
    let instance: JsonRecord | null = null;

    if (input.createInstance) {
      instance = await (this.prisma as PrismaAny).resourceInstance.create({
        data: {
          teamId,
          projectId: existing.projectId,
          environmentId: existing.environmentId,
          requestId: existing.id,
          resourceTypeId: existing.resourceTypeId,
          name: input.instanceName,
          status: 'active',
          config: input.config,
          delivery: input.delivery,
          credentials: this.hasRecordValues(input.credentials)
            ? this.encrypt(JSON.stringify(input.credentials))
            : undefined,
          expiresAt: input.expiresAt,
        },
        include: this.resourceInstanceInclude(),
      });
    }

    const completedAt = new Date();
    const request = await (this.prisma as PrismaAny).resourceRequest.update({
      where: { id: existing.id },
      data: {
        status: 'completed',
        completedAt,
        result: {
          ...this.asRecord(existing.result),
          provisioning: input.provisioning,
          delivery: input.delivery,
          instanceId: instance?.id,
        },
      },
      include: this.resourceRequestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      instanceId: instance?.id as string | undefined,
      provisioningRunId: this.readString(input.provisioning.provisioningRunId) || undefined,
      action: 'request.completed',
      message: '资源申请已交付',
      metadata: input.auditMetadata ?? { createInstance: input.createInstance },
    });

    return {
      request,
      instance: instance ? this.maskInstance(instance) : null,
    };
  }

  private normalizeProvisioningMode(mode: unknown): ProvisioningMode {
    if (mode === 'pool' || mode === 'webhook' || mode === 'api' || mode === 'script' || mode === 'credential_only') {
      return mode;
    }
    return 'manual';
  }

  private normalizeProvisioningProcessorTrigger(trigger: unknown): ProvisioningProcessorTrigger {
    if (trigger === 'approval' || trigger === 'manual_retry' || trigger === 'auto_retry') {
      return trigger;
    }
    return 'manual_retry';
  }

  private buildScriptProvisioningSteps(config: JsonRecord): ServerCommandStep[] {
    const stepsInput = Array.isArray(config.steps) ? config.steps : [];
    const steps = stepsInput
      .map((step, index) => this.normalizeScriptStep(step, index))
      .filter((step): step is ServerCommandStep => Boolean(step));
    const command = this.readString(config.command);

    if (steps.length > 0) {
      return steps;
    }

    if (!command) {
      return [];
    }

    return [
      {
        key: 'provision',
        label: this.readString(config.label) || '资源交付脚本',
        command,
        cwd: this.readString(config.cwd) || undefined,
        required: true,
        risk: this.normalizeScriptStepRisk(config.risk),
        timeoutSeconds: this.readPositiveInteger(config.timeoutSeconds),
        preview: this.readString(config.preview) || undefined,
      },
    ];
  }

  private normalizeScriptStep(input: unknown, index: number): ServerCommandStep | null {
    const step = this.asRecord(input);
    const command = this.readString(step.command);

    if (!command) {
      return null;
    }

    return {
      key: this.readString(step.key) || `step-${index + 1}`,
      label: this.readString(step.label) || `资源交付步骤 ${index + 1}`,
      command,
      cwd: this.readString(step.cwd) || undefined,
      required: step.required !== false,
      risk: this.normalizeScriptStepRisk(step.risk),
      timeoutSeconds: this.readPositiveInteger(step.timeoutSeconds),
      preview: this.readString(step.preview) || undefined,
    };
  }

  private normalizeScriptStepRisk(value: unknown): ServerCommandStep['risk'] {
    return value === 'medium' || value === 'high' ? value : 'low';
  }

  private mapScriptProvisioningStatus(execution: ServerExecutionResult, dryRun: boolean) {
    if (execution.status === 'blocked' || execution.status === 'failed' || execution.status === 'cancelled') {
      return 'blocked';
    }

    if (execution.status === 'queued') {
      return 'queued';
    }

    return dryRun || execution.mode === 'dry_run' ? 'planned' : 'completed';
  }

  private summarizeServerExecution(execution: ServerExecutionResult): JsonRecord {
    const serverExecutionJobId =
      'serverExecutionJobId' in execution && typeof execution.serverExecutionJobId === 'string'
        ? execution.serverExecutionJobId
        : undefined;

    return {
      executorKey: execution.executorKey,
      adapterKey: execution.adapterKey,
      executorStatus: execution.status,
      executionMode: execution.mode,
      serverExecutionJobId,
      executable: execution.executable,
      warnings: execution.warnings,
      error: execution.error,
      commandStepCount: execution.commandSteps.length,
    };
  }

  private httpProvisioningEnabled() {
    return this.readBoolean(this.configService.get('RESOURCE_PROVISIONING_HTTP_ENABLED', false), false);
  }

  private httpProvisioningQueueEnabled() {
    return this.readBoolean(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED', false),
      false,
    );
  }

  private async resolveProvisioningCredentialRef(
    teamId: string,
    config: JsonRecord,
  ): Promise<ProvisioningCredentialRef | null> {
    const auth = this.asRecord(config.auth);
    const credential = this.asRecord(config.credential);
    const credentialId = (
      this.readString(config.credentialId)
      || this.readString(auth.credentialId)
      || this.readString(credential.id)
    );
    const credentialRequired = this.readBoolean(config.requireCredential, this.readBoolean(auth.required, false));

    if (!credentialId) {
      if (credentialRequired) {
        throw new BadRequestException('外部资源交付需要绑定 TeamCredential');
      }
      return null;
    }

    const record = await (this.prisma as PrismaAny).teamCredential.findFirst({
      where: { id: credentialId, teamId },
      select: { id: true, name: true, type: true },
    });

    if (!record) {
      throw new NotFoundException('TeamCredential 不存在或不属于当前团队');
    }

    const allowedTypes = this.readCredentialTypeAllowList(config, auth);
    if (allowedTypes.length > 0 && !allowedTypes.includes(record.type)) {
      throw new BadRequestException('TeamCredential 类型与外部资源交付 adapter 不匹配');
    }

    return {
      source: 'team_credential',
      referenceId: record.id,
      displayName: record.name,
      credentialType: record.type,
      authAdapterKey: this.resolveAuthAdapterKey(record.type, auth),
      redacted: true,
    };
  }

  private readCredentialTypeAllowList(config: JsonRecord, auth: JsonRecord) {
    const allowedTypes = [
      ...this.readStringArray(config.allowedCredentialTypes),
      ...this.readStringArray(auth.allowedCredentialTypes),
      this.readString(config.credentialType),
      this.readString(auth.credentialType),
    ].filter(Boolean);
    return Array.from(new Set(allowedTypes));
  }

  private resolveAuthAdapterKey(credentialType: string, auth: JsonRecord) {
    return (
      this.readString(auth.adapterKey)
      || this.readString(auth.authAdapterKey)
      || `${credentialType}-credential-ref`
    );
  }

  private exposeCredentialRef(config: JsonRecord) {
    const auth = this.asRecord(config.auth);
    return this.readBoolean(config.exposeCredentialRef, this.readBoolean(auth.exposeCredentialRef, true));
  }

  private buildProvisioningIdempotencyKey(
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    mode: ProvisioningMode,
    config: JsonRecord,
  ) {
    const explicit = this.readString(config.idempotencyKey);
    if (explicit) {
      return explicit;
    }

    const prefix = this.readString(config.idempotencyPrefix) || 'resource-request';
    return [
      prefix,
      request.id,
      resourceType.id,
      resourceType.key,
      mode,
    ].filter(Boolean).join(':');
  }

  private readHttpMaxAttempts(config: JsonRecord) {
    const attempts = this.readPositiveInteger(config.maxAttempts)
      || this.readPositiveInteger(this.asRecord(config.retry).maxAttempts)
      || 1;
    return Math.min(Math.max(attempts, 1), 5);
  }

  private readHttpRetryStatusCodes(config: JsonRecord) {
    const retry = this.asRecord(config.retry);
    const input = Array.isArray(config.retryStatusCodes)
      ? config.retryStatusCodes
      : Array.isArray(retry.statusCodes)
        ? retry.statusCodes
        : [408, 425, 429, 500, 502, 503, 504];

    return input.reduce<Set<number>>((acc, value) => {
      const code = typeof value === 'number' ? value : Number.parseInt(this.readString(value), 10);
      if (Number.isInteger(code) && code >= 100 && code <= 599) {
        acc.add(code);
      }
      return acc;
    }, new Set<number>());
  }

  private isRetryableHttpStatus(status: number, retryStatusCodes: Set<number>) {
    return retryStatusCodes.has(status);
  }

  private isProvisioningAutoRetryDue(request: JsonRecord, now: Date) {
    const provisioning = this.asRecord(this.asRecord(request.result).provisioning);
    if (this.readString(provisioning.status) !== 'blocked') {
      return false;
    }

    const resourceType = this.asRecord(request.resourceType);
    const mode = this.normalizeProvisioningMode(
      this.readString(provisioning.mode) || this.readString(resourceType.provisioningMode),
    );
    if (mode !== 'api' && mode !== 'webhook') {
      return false;
    }

    const autoRetry = this.asRecord(provisioning.autoRetry);
    if (!this.readBoolean(autoRetry.enabled, false)) {
      return false;
    }
    if (!this.readBoolean(provisioning.retryable, this.readBoolean(autoRetry.retryable, false))) {
      return false;
    }
    if (this.readBoolean(autoRetry.exhausted, false)) {
      return false;
    }

    const maxScheduledAttempts = this.readPositiveInteger(autoRetry.maxScheduledAttempts) || 0;
    const scheduledAttempts = this.readNonNegativeInteger(autoRetry.scheduledAttempts) || 0;
    if (maxScheduledAttempts > 0 && scheduledAttempts >= maxScheduledAttempts) {
      return false;
    }

    const nextAttemptAt = this.readString(autoRetry.nextAttemptAt);
    if (!nextAttemptAt) {
      return false;
    }

    const dueAt = Date.parse(nextAttemptAt);
    return Number.isFinite(dueAt) && dueAt <= now.getTime();
  }

  private buildHttpAutoRetryMetadata(
    provisioningConfig: JsonRecord,
    request: JsonRecord,
    retryable: boolean,
    context: ProvisioningProcessorContext,
    now: Date,
  ): JsonRecord {
    const config = this.readProvisioningAutoRetryConfig(provisioningConfig);
    if (!config.enabled) {
      return {};
    }

    const previousProvisioning = this.asRecord(this.asRecord(request.result).provisioning);
    const previousAutoRetry = this.asRecord(previousProvisioning.autoRetry);
    const previousScheduledAttempts = this.readNonNegativeInteger(previousAutoRetry.scheduledAttempts) || 0;
    const scheduledAttempts = previousScheduledAttempts + (context.trigger === 'auto_retry' ? 1 : 0);
    const exhausted = !retryable || scheduledAttempts >= config.maxScheduledAttempts;
    const nextAttemptAt = retryable && !exhausted
      ? new Date(now.getTime() + config.delaySeconds * 1000).toISOString()
      : undefined;
    const lastTriggeredAt = context.trigger === 'auto_retry'
      ? now.toISOString()
      : this.readString(previousAutoRetry.lastTriggeredAt) || undefined;
    const autoRetryState: JsonRecord = {
      enabled: true,
      retryable,
      scheduledAttempts,
      maxScheduledAttempts: config.maxScheduledAttempts,
      delaySeconds: config.delaySeconds,
      exhausted,
    };
    if (nextAttemptAt) {
      autoRetryState.nextAttemptAt = nextAttemptAt;
    }
    if (lastTriggeredAt) {
      autoRetryState.lastTriggeredAt = lastTriggeredAt;
    }

    return {
      autoRetry: autoRetryState,
    };
  }

  private readProvisioningAutoRetryConfig(config: JsonRecord): ProvisioningAutoRetryConfig {
    const retry = this.asRecord(config.retry);
    const autoRetry = this.asRecord(config.autoRetry);
    const retryAutoRetry = this.asRecord(retry.autoRetry);
    const enabled = this.readBoolean(autoRetry.enabled, this.readBoolean(retryAutoRetry.enabled, false));
    const delaySeconds = this.clampPositiveInteger(
      this.readPositiveInteger(autoRetry.delaySeconds)
        || this.readPositiveInteger(retryAutoRetry.delaySeconds)
        || this.readPositiveInteger(config.autoRetryDelaySeconds)
        || 60,
      10,
      86400,
    );
    const maxScheduledAttempts = this.clampPositiveInteger(
      this.readPositiveInteger(autoRetry.maxScheduledAttempts)
        || this.readPositiveInteger(retryAutoRetry.maxScheduledAttempts)
        || this.readPositiveInteger(config.maxScheduledAutoRetries)
        || 3,
      1,
      20,
    );

    return {
      enabled,
      delaySeconds,
      maxScheduledAttempts,
    };
  }

  private readProvisioningQueueConfig(config: JsonRecord): ProvisioningQueueConfig {
    const queue = this.asRecord(config.queue);
    const enabled = this.readBoolean(
      queue.enabled,
      this.readBoolean(config.queue, this.httpProvisioningQueueEnabled()),
    );
    const delaySeconds = this.clampNonNegativeInteger(
      this.readNonNegativeInteger(queue.delaySeconds)
        ?? this.readNonNegativeInteger(config.queueDelaySeconds)
        ?? this.readNonNegativeInteger(config.queueAvailableDelaySeconds)
        ?? 0,
      0,
      86400,
    );

    return {
      enabled,
      delaySeconds,
    };
  }

  private buildHttpProvisioningHeaders(
    config: JsonRecord,
    idempotencyKey: string,
    credentialRef: ProvisioningCredentialRef | null,
  ) {
    const headers = {
      ...this.readStringMap(config.headers),
    };
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');

    if (!hasContentType) {
      headers['content-type'] = 'application/json';
    }

    headers['idempotency-key'] = idempotencyKey;
    headers['x-devpilot-idempotency-key'] = idempotencyKey;

    if (credentialRef && this.exposeCredentialRef(config)) {
      headers['x-devpilot-credential-id'] = credentialRef.referenceId;
      headers['x-devpilot-credential-type'] = credentialRef.credentialType;
      headers['x-devpilot-auth-adapter'] = credentialRef.authAdapterKey;
    }

    return headers;
  }

  private buildExternalProvisioningPayload(
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    mode: Extract<ProvisioningMode, 'webhook' | 'api'>,
    credentialRef: ProvisioningCredentialRef | null,
    idempotencyKey: string,
  ) {
    const project = this.asRecord(request.project);
    const projectEnvironment = this.asRecord(request.projectEnvironment);

    return {
      mode,
      resourceType: {
        id: resourceType.id,
        key: resourceType.key,
        name: resourceType.name,
      },
      request: {
        id: request.id,
        title: request.title,
        purpose: request.purpose,
        projectId: request.projectId,
        environmentId: request.environmentId,
        environment: request.environment,
        spec: this.asRecord(request.spec),
      },
      adapter: {
        boundary: 'http_adapter',
        idempotencyKey,
        credentialRef: credentialRef || undefined,
      },
      project: this.hasRecordValues(project)
        ? { id: project.id, name: project.name }
        : undefined,
      projectEnvironment: this.hasRecordValues(projectEnvironment)
        ? {
            id: projectEnvironment.id,
            key: projectEnvironment.key,
            name: projectEnvironment.name,
            status: projectEnvironment.status,
          }
        : undefined,
    };
  }

  private async readHttpProvisioningBody(response: HttpProvisioningResponse) {
    const contentType = response.headers?.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (_error) {
      return { message: this.truncateText(text) };
    }
  }

  private resolveHttpProvisioningDeliverySource(response: JsonRecord) {
    const delivery = this.asRecord(response.delivery);
    const credentials = this.asRecord(response.credentials);

    if (this.hasRecordValues(delivery) || this.hasRecordValues(credentials)) {
      return {
        ...delivery,
        ...credentials,
      };
    }

    const resource = this.asRecord(response.resource);
    if (this.hasRecordValues(resource)) {
      return resource;
    }

    const instance = this.asRecord(response.instance);
    if (this.hasRecordValues(instance)) {
      return instance;
    }

    return {};
  }

  private provisioningAuditAction(status: unknown) {
    if (status === 'blocked') {
      return 'provisioning.blocked';
    }
    if (status === 'completed') {
      return 'provisioning.completed';
    }
    if (status === 'queued') {
      return 'provisioning.queued';
    }
    return 'provisioning.planned';
  }

  private provisioningAuditMessage(status: unknown) {
    if (status === 'blocked') {
      return '资源交付处理器被阻断';
    }
    if (status === 'completed') {
      return '资源交付处理器已完成';
    }
    if (status === 'queued') {
      return '资源交付处理器已入队';
    }
    return '资源交付处理器已生成计划';
  }

  private splitDeliveryAndCredentials(deliveryInput: unknown, schemaInput: unknown) {
    const source = this.asRecord(deliveryInput);
    const sensitiveKeys = this.readSensitiveFieldKeys(schemaInput);
    const delivery: JsonRecord = {};
    const credentials: JsonRecord = {};

    for (const [key, value] of Object.entries(source)) {
      if (sensitiveKeys.has(key) || this.isImplicitSensitiveKey(key)) {
        credentials[key] = value;
      } else {
        delivery[key] = value;
      }
    }

    return { delivery, credentials };
  }

  private readSensitiveFieldKeys(schemaInput: unknown) {
    const schema = this.asRecord(schemaInput);
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    return fields.reduce<Set<string>>((acc, field) => {
      const fieldRecord = this.asRecord(field);
      const key = this.readString(fieldRecord.key);
      if (key && fieldRecord.sensitive === true) {
        acc.add(key);
      }
      return acc;
    }, new Set<string>());
  }

  private isImplicitSensitiveKey(key: string) {
    const normalizedKey = key.toLowerCase();
    return (
      normalizedKey.includes('password')
      || normalizedKey.includes('secret')
      || normalizedKey.includes('token')
      || normalizedKey.includes('accesskey')
      || normalizedKey.includes('privatekey')
    );
  }

  private resolveRequestedResourceName(specInput: unknown) {
    const spec = this.asRecord(specInput);
    return (
      this.readString(spec.resourceName)
      || this.readString(spec.database)
      || this.readString(spec.dbName)
      || this.readString(spec.name)
      || undefined
    );
  }

  private asRecord(value: unknown): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as JsonRecord;
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private dateToIso(value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return undefined;
  }

  private readBoolean(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
      }
    }
    return fallback;
  }

  private readPositiveInteger(value: unknown) {
    const numberValue = typeof value === 'number' ? value : Number.parseInt(this.readString(value), 10);
    return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
  }

  private readListLimit(value: unknown, fallback: number, max: number) {
    const limit = this.readPositiveInteger(value) || fallback;
    return Math.min(limit, max);
  }

  private readStaleProvisioningRunAfterSeconds(value?: unknown) {
    const configured = this.readPositiveInteger(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS', '1800'),
    ) || 1800;
    return Math.max(this.readPositiveInteger(value) || configured, 60);
  }

  private readNonNegativeInteger(value: unknown) {
    const numberValue = typeof value === 'number' ? value : Number.parseInt(this.readString(value), 10);
    return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : undefined;
  }

  private clampPositiveInteger(value: number, min: number, max: number) {
    return Math.min(Math.max(Math.floor(value), min), max);
  }

  private clampNonNegativeInteger(value: number, min: number, max: number) {
    return Math.min(Math.max(Math.floor(value), min), max);
  }

  private readStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => this.readString(item))
      .filter(Boolean);
  }

  private readStringMap(value: unknown) {
    const source = this.asRecord(value);
    return Object.entries(source).reduce<Record<string, string>>((acc, [key, entry]) => {
      const header = this.readString(entry);
      if (header) {
        acc[key] = header;
      }
      return acc;
    }, {});
  }

  private hasRecordValues(value: JsonRecord) {
    return Object.keys(value).length > 0;
  }

  private redactUrl(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.username) {
        parsed.username = 'redacted';
      }
      if (parsed.password) {
        parsed.password = 'redacted';
      }
      for (const key of Array.from(parsed.searchParams.keys())) {
        if (this.isImplicitSensitiveKey(key)) {
          parsed.searchParams.set(key, 'redacted');
        }
      }
      return parsed.toString();
    } catch (_error) {
      const queryIndex = url.indexOf('?');
      return queryIndex >= 0 ? `${url.slice(0, queryIndex)}?...` : url;
    }
  }

  private truncateText(text: string, maxLength = 500) {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'provisioning_failed';
  }

  async cancelRequest(teamId: string, userId: string, id: string) {
    const existing = await this.getRequest(teamId, id);

    if (existing.status === 'completed') {
      throw new BadRequestException('已完成的申请不能取消');
    }

    const request = await (this.prisma as PrismaAny).resourceRequest.update({
      where: { id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
      include: this.resourceRequestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId,
      requestId: id,
      action: 'request.canceled',
      message: '资源申请已取消',
    });

    return request;
  }

  async listInstances(teamId: string, query: ListResourceInstancesQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;

    const instances = await (this.prisma as PrismaAny).resourceInstance.findMany({
      where,
      include: this.resourceInstanceInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return instances.map((instance: Record<string, unknown>) => this.maskInstance(instance));
  }

  async getInstance(teamId: string, id: string) {
    const instance = await (this.prisma as PrismaAny).resourceInstance.findFirst({
      where: { id, teamId },
      include: {
        ...this.resourceInstanceInclude(),
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException('资源实例不存在');
    }

    return this.maskInstance(instance);
  }

  async getInstanceCredentialForGeneration(teamId: string, id: string) {
    const instance = await (this.prisma as PrismaAny).resourceInstance.findFirst({
      where: { id, teamId },
      include: {
        resourceType: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException('资源实例不存在');
    }

    if (instance.status !== 'active') {
      throw new BadRequestException('只有 active 状态的资源实例可以用于生成项目');
    }

    const delivery = (instance.delivery && typeof instance.delivery === 'object')
      ? instance.delivery
      : {};
    const credentials = instance.credentials
      ? JSON.parse(this.decrypt(instance.credentials))
      : {};

    return {
      id: instance.id,
      type: instance.resourceType.key,
      name: instance.name,
      config: {
        ...delivery,
        ...credentials,
      } as Record<string, unknown>,
    };
  }

  async releaseInstance(teamId: string, userId: string, id: string) {
    const existing = await (this.prisma as PrismaAny).resourceInstance.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('资源实例不存在');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('只有 active 状态的资源实例可以释放');
    }

    const instance = await (this.prisma as PrismaAny).resourceInstance.update({
      where: { id },
      data: {
        status: 'released',
        releasedAt: new Date(),
      },
      include: this.resourceInstanceInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId,
      requestId: existing.requestId,
      instanceId: id,
      action: 'instance.released',
      message: '资源实例已释放',
    });

    return this.maskInstance(instance);
  }

  async listAuditLogs(teamId: string, query: ListResourceAuditLogsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.requestId) where.requestId = query.requestId;
    if (query.instanceId) where.instanceId = query.instanceId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;
    if (query.action) where.action = query.action;

    return (this.prisma as PrismaAny).resourceAuditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
