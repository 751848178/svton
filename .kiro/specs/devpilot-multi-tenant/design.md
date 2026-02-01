# Design Document: Devpilot 多租户与资源管控

## Overview

本设计将 Devpilot 从单用户模式升级为多租户架构，支持团队协作、服务器管理、域名代理配置和 CDN 管理。核心变更包括：数据模型增加团队维度、前端增加认证中间件和团队切换、后端增加服务器管理和代理配置生成能力。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Auth Middleware │ Team Context │ Dashboard Pages           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                        │
├─────────────────────────────────────────────────────────────┤
│  Auth Guard │ Team Guard │ Modules:                          │
│  - TeamModule (团队管理)                                      │
│  - ServerModule (服务器管理)                                  │
│  - ProxyConfigModule (域名代理)                               │
│  - CDNConfigModule (CDN配置)                                  │
│  - ProjectModule (项目关联)                                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database (MySQL)                        │
├─────────────────────────────────────────────────────────────┤
│  Team │ TeamMember │ Server │ ProxyConfig │ CDNConfig       │
│  Project (updated) │ Resource (updated)                      │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 认证中间件 (Frontend)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register', '/'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // 公开路由直接放行
  if (publicPaths.some(path => pathname === path || pathname.startsWith('/api/auth'))) {
    return NextResponse.next();
  }

  // 未登录重定向到登录页
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 2. 团队上下文 (Frontend)

```typescript
// store/team-context.ts
interface TeamState {
  currentTeam: Team | null;
  teams: Team[];
  setCurrentTeam: (team: Team) => void;
  loadTeams: () => Promise<void>;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  role: 'owner' | 'admin' | 'member';
}
```

### 3. 团队模块 (Backend)

```typescript
// team/team.service.ts
interface TeamService {
  create(userId: string, data: CreateTeamDto): Promise<Team>;
  findByUser(userId: string): Promise<Team[]>;
  addMember(teamId: string, email: string, role: MemberRole): Promise<void>;
  removeMember(teamId: string, memberId: string): Promise<void>;
  updateMemberRole(teamId: string, memberId: string, role: MemberRole): Promise<void>;
}
```

### 4. 服务器模块 (Backend)

```typescript
// server/server.service.ts
interface ServerService {
  create(teamId: string, data: CreateServerDto): Promise<Server>;
  findByTeam(teamId: string): Promise<Server[]>;
  testConnection(serverId: string): Promise<ConnectionTestResult>;
  detectServices(serverId: string): Promise<DetectedService[]>;
  executeCommand(serverId: string, command: string): Promise<CommandResult>;
}

interface CreateServerDto {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKey?: string;
  tags?: string[];
}
```

### 5. 代理配置模块 (Backend)

```typescript
// proxy-config/proxy-config.service.ts
interface ProxyConfigService {
  create(teamId: string, data: CreateProxyConfigDto): Promise<ProxyConfig>;
  findByTeam(teamId: string): Promise<ProxyConfig[]>;
  generateNginxConfig(configId: string): Promise<string>;
  syncToServer(configId: string): Promise<SyncResult>;
  associateWithProject(configId: string, projectId: string): Promise<void>;
}

interface CreateProxyConfigDto {
  name: string;
  domain: string;
  upstreams: Upstream[];
  ssl: SSLConfig;
  websocket: boolean;
  serverId?: string;
  projectId?: string;
}

interface Upstream {
  host: string;
  port: number;
  weight?: number;
}

interface SSLConfig {
  enabled: boolean;
  type: 'letsencrypt' | 'custom' | 'none';
  certificate?: string;
  privateKey?: string;
}
```

### 6. CDN 配置模块 (Backend)

```typescript
// cdn-config/cdn-config.service.ts
interface CDNConfigService {
  create(teamId: string, data: CreateCDNConfigDto): Promise<CDNConfig>;
  findByTeam(teamId: string): Promise<CDNConfig[]>;
  syncToProvider(configId: string): Promise<SyncResult>;
  purgeCache(configId: string, paths?: string[]): Promise<void>;
  associateWithProject(configId: string, projectId: string): Promise<void>;
}

interface CreateCDNConfigDto {
  name: string;
  domain: string;
  origin: string;
  provider: 'qiniu' | 'aliyun' | 'cloudflare';
  credentialId: string;  // 团队级别的 CDN 凭证
  cacheRules?: CacheRule[];
  projectId?: string;
}
```

## Data Models

### Prisma Schema 更新

```prisma
// 团队
model Team {
  id          String   @id @default(cuid())
  name        String
  description String?
  
  members     TeamMember[]
  servers     Server[]
  proxyConfigs ProxyConfig[]
  cdnConfigs  CDNConfig[]
  projects    Project[]
  resources   Resource[]
  credentials TeamCredential[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 团队成员
model TeamMember {
  id      String @id @default(cuid())
  teamId  String
  userId  String
  role    String @default("member") // owner | admin | member
  
  team    Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  
  @@unique([teamId, userId])
}

// 服务器
model Server {
  id          String   @id @default(cuid())
  teamId      String
  name        String
  host        String
  port        Int      @default(22)
  username    String
  authType    String   // password | key
  credentials String   @db.Text // 加密存储
  tags        Json?    // string[]
  status      String   @default("unknown") // online | offline | unknown
  services    Json?    // 检测到的服务
  
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  proxyConfigs ProxyConfig[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([teamId])
}

// 代理配置
model ProxyConfig {
  id          String   @id @default(cuid())
  teamId      String
  serverId    String?
  projectId   String?
  name        String
  domain      String
  upstreams   Json     // Upstream[]
  ssl         Json     // SSLConfig
  websocket   Boolean  @default(false)
  customConfig String? @db.Text // 自定义 Nginx 配置
  status      String   @default("pending") // pending | active | error
  lastSyncAt  DateTime?
  
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  server      Server?  @relation(fields: [serverId], references: [id])
  project     Project? @relation(fields: [projectId], references: [id])
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([teamId])
  @@index([domain])
}

// CDN 配置
model CDNConfig {
  id           String   @id @default(cuid())
  teamId       String
  projectId    String?
  credentialId String
  name         String
  domain       String
  origin       String
  provider     String   // qiniu | aliyun | cloudflare
  cacheRules   Json?    // CacheRule[]
  status       String   @default("pending") // pending | active | error
  providerData Json?    // CDN 提供商返回的数据
  
  team         Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  project      Project? @relation(fields: [projectId], references: [id])
  credential   TeamCredential @relation(fields: [credentialId], references: [id])
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@index([teamId])
  @@index([domain])
}

// 团队凭证（CDN、云服务等）
model TeamCredential {
  id        String   @id @default(cuid())
  teamId    String
  type      String   // cdn_qiniu | cdn_aliyun | cdn_cloudflare | cloud_aws | etc.
  name      String
  config    String   @db.Text // 加密的凭证配置
  
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  cdnConfigs CDNConfig[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([teamId, type])
}

// 更新 Project 模型
model Project {
  id           String   @id @default(cuid())
  teamId       String   // 新增：归属团队
  userId       String   // 保留：创建者
  name         String
  config       Json
  gitRepo      String?
  downloadUrl  String?
  
  team         Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user         User     @relation(fields: [userId], references: [id])
  proxyConfigs ProxyConfig[]
  cdnConfigs   CDNConfig[]
  allocations  ResourceAllocation[]
  
  createdAt    DateTime @default(now())
  
  @@index([teamId])
  @@index([userId])
}

// 更新 Resource 模型
model Resource {
  id        String   @id @default(cuid())
  teamId    String   // 改为团队维度
  userId    String   // 保留：创建者
  type      String
  name      String
  config    String   @db.Text
  
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([teamId, type])
}

// 更新 User 模型
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  avatar        String?
  role          String    @default("user")
  
  teamMembers   TeamMember[]
  // ... 其他关联
}
```

## Nginx 配置生成

```typescript
// proxy-config/nginx-generator.ts
export function generateNginxConfig(config: ProxyConfig): string {
  const { domain, upstreams, ssl, websocket } = config;
  
  let nginxConfig = '';
  
  // Upstream 配置
  if (upstreams.length > 1) {
    nginxConfig += `upstream ${domain.replace(/\./g, '_')} {\n`;
    for (const upstream of upstreams) {
      nginxConfig += `    server ${upstream.host}:${upstream.port}`;
      if (upstream.weight) nginxConfig += ` weight=${upstream.weight}`;
      nginxConfig += ';\n';
    }
    nginxConfig += '}\n\n';
  }
  
  // Server 配置
  nginxConfig += `server {\n`;
  nginxConfig += `    listen ${ssl.enabled ? '443 ssl' : '80'};\n`;
  nginxConfig += `    server_name ${domain};\n\n`;
  
  // SSL 配置
  if (ssl.enabled) {
    nginxConfig += `    ssl_certificate /etc/nginx/ssl/${domain}.crt;\n`;
    nginxConfig += `    ssl_certificate_key /etc/nginx/ssl/${domain}.key;\n\n`;
  }
  
  // 代理配置
  nginxConfig += `    location / {\n`;
  const proxyPass = upstreams.length > 1 
    ? `http://${domain.replace(/\./g, '_')}`
    : `http://${upstreams[0].host}:${upstreams[0].port}`;
  nginxConfig += `        proxy_pass ${proxyPass};\n`;
  nginxConfig += `        proxy_set_header Host $host;\n`;
  nginxConfig += `        proxy_set_header X-Real-IP $remote_addr;\n`;
  
  // WebSocket 支持
  if (websocket) {
    nginxConfig += `        proxy_http_version 1.1;\n`;
    nginxConfig += `        proxy_set_header Upgrade $http_upgrade;\n`;
    nginxConfig += `        proxy_set_header Connection "upgrade";\n`;
  }
  
  nginxConfig += `    }\n`;
  nginxConfig += `}\n`;
  
  return nginxConfig;
}
```


## Error Handling

### 认证错误
- 401 Unauthorized: Token 无效或过期
- 403 Forbidden: 无权访问该团队资源

### 服务器连接错误
- SSH 连接失败时返回详细错误信息
- 支持连接超时配置

### 代理配置同步错误
- 记录同步失败原因
- 支持手动重试
- 提供配置回滚能力

### CDN 配置错误
- 验证域名所有权
- 处理 CDN 提供商 API 错误

## Testing Strategy

### 单元测试
- 团队权限验证逻辑
- Nginx 配置生成
- 凭证加密/解密

### 集成测试
- 团队创建和成员管理流程
- 代理配置 CRUD 和同步
- CDN 配置 CRUD

### E2E 测试
- 完整的登录 → 创建团队 → 添加服务器 → 配置代理流程


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication Enforcement

*For any* protected route and any request without a valid authentication token, the system should either redirect to login (frontend) or return 401 status (API).

**Validates: Requirements 1.1, 1.3, 1.5**

### Property 2: Team Resource Isolation

*For any* resource query (projects, servers, proxy configs, CDN configs, credentials) and any team context, the results should only include resources belonging to the current team.

**Validates: Requirements 2.6, 7.1, 7.3**

### Property 3: Team Creator Ownership

*For any* newly created team, the creating user should be assigned the "owner" role in the team membership.

**Validates: Requirements 2.2**

### Property 4: Credential Encryption Round-Trip

*For any* credential (SSH, CDN, etc.), encrypting then decrypting should produce the original credential value.

**Validates: Requirements 3.2**

### Property 5: Nginx Config Generation

*For any* valid proxy configuration, the generated Nginx config should:
- Contain the correct domain in server_name
- Contain all upstream servers with correct host:port
- Include SSL directives if SSL is enabled
- Include WebSocket upgrade headers if websocket is enabled

**Validates: Requirements 4.4, 4.6**

### Property 6: Proxy Config Completeness

*For any* proxy configuration with multiple upstreams, the generated Nginx config should include an upstream block with all servers and their weights.

**Validates: Requirements 4.2**

### Property 7: Project Resource Association

*For any* project with associated resources (proxy configs, CDN configs, allocations), querying the project should return all associated resources.

**Validates: Requirements 6.1, 6.2**

### Property 8: Role-Based Access Control

*For any* team operation requiring admin privileges, only users with "owner" or "admin" role should be able to perform it.

**Validates: Requirements 2.4, 7.2**
