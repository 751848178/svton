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
import {
  CompleteResourceRequestDto,
  CreateResourceRequestDto,
  CreateResourceTypeDto,
  ListResourceAuditLogsQueryDto,
  ListResourceInstancesQueryDto,
  ListResourceRequestsQueryDto,
  ReviewResourceRequestDto,
  UpdateResourceTypeDto,
} from './dto/resource-request.dto';

type PrismaAny = any;

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
    configService: ConfigService,
  ) {
    const key = configService.get('ENCRYPTION_KEY', 'default-32-char-encryption-key!');
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

  private async writeAudit(input: AuditInput) {
    return (this.prisma as PrismaAny).resourceAuditLog.create({
      data: {
        teamId: input.teamId,
        actorId: input.actorId,
        resourceTypeId: input.resourceTypeId,
        requestId: input.requestId,
        instanceId: input.instanceId,
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

  private async ensureResourceType(resourceTypeId: string) {
    const resourceType = await (this.prisma as PrismaAny).resourceType.findFirst({
      where: { id: resourceTypeId, enabled: true },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在或已停用');
    }

    return resourceType;
  }

  async createRequest(teamId: string, userId: string, dto: CreateResourceRequestDto) {
    const resourceType = await this.ensureResourceType(dto.resourceTypeId);
    await this.ensureProject(teamId, dto.projectId);

    const request = await (this.prisma as PrismaAny).resourceRequest.create({
      data: {
        teamId,
        projectId: dto.projectId,
        resourceTypeId: dto.resourceTypeId,
        requesterId: userId,
        title: dto.title,
        environment: dto.environment,
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

    return request;
  }

  async listRequests(teamId: string, query: ListResourceRequestsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
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
      resourceTypeId: existing.resourceTypeId,
      requestId: id,
      action: dto.status === 'approved' ? 'request.approved' : 'request.rejected',
      message: dto.comment,
    });

    return request;
  }

  async completeRequest(teamId: string, userId: string, id: string, dto: CompleteResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);

    if (!['approved', 'pending'].includes(existing.status)) {
      throw new BadRequestException('当前申请状态不能交付');
    }

    const shouldCreateInstance = dto.createInstance !== false;
    let instance: Record<string, unknown> | null = null;

    if (shouldCreateInstance) {
      instance = await (this.prisma as PrismaAny).resourceInstance.create({
        data: {
          teamId,
          projectId: existing.projectId,
          requestId: existing.id,
          resourceTypeId: existing.resourceTypeId,
          name: dto.instanceName || existing.title,
          status: 'active',
          config: dto.config ?? {},
          delivery: dto.delivery ?? {},
          credentials: dto.credentials ? this.encrypt(JSON.stringify(dto.credentials)) : undefined,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
        include: this.resourceInstanceInclude(),
      });
    }

    const request = await (this.prisma as PrismaAny).resourceRequest.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: {
          delivery: dto.delivery ?? {},
          instanceId: instance?.id,
        },
      },
      include: this.resourceRequestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId,
      requestId: id,
      instanceId: instance?.id as string | undefined,
      action: 'request.completed',
      message: '资源申请已交付',
      metadata: { createInstance: shouldCreateInstance },
    });

    return {
      request,
      instance: instance ? this.maskInstance(instance) : null,
    };
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
