/**
 * Default resource-type seed data for the resource-request feature.
 *
 * Pure declarative data (no logic) upserted by `ResourceTypeService.ensureDefaults()`
 * on module boot. Moved out of `resource-request.service.ts` verbatim so the
 * god service stops carrying ~350 lines of seed configuration.
 */

import { CreateResourceTypeDto } from './dto/resource-request.dto';

export const environmentField = {
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

export const DEFAULT_RESOURCE_TYPES: CreateResourceTypeDto[] = [
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
