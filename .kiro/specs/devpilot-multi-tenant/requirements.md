# Requirements Document

## Introduction

Devpilot 多租户与资源管控升级，将平台从单用户模式升级为支持团队/账户维度的多租户架构。包括：路由认证保护、域名代理配置管理（类似 nginx-proxy-manager）、CDN 配置管理、以及团队资源隔离。

## Glossary

- **Team**: 团队，资源隔离的基本单位，用户可以创建或加入多个团队
- **Member**: 团队成员，具有不同角色（owner/admin/member）
- **Server**: 服务器，用于部署 Nginx 或其他服务的远程主机
- **ProxyConfig**: 代理配置，定义域名到后端服务的反向代理规则
- **CDNConfig**: CDN 配置，定义静态资源的 CDN 加速规则
- **Project**: 项目，归属于团队，可关联域名和 CDN 配置

## Requirements

### Requirement 1: 路由认证保护

**User Story:** As a platform administrator, I want all routes to require authentication, so that unauthorized users cannot access the system.

#### Acceptance Criteria

1. WHEN a user visits any dashboard route without authentication, THE System SHALL redirect to the login page
2. THE System SHALL allow access to /login and /register routes without authentication
3. WHEN a user's session expires, THE System SHALL redirect to login and preserve the original URL
4. THE System SHALL provide a middleware to check authentication status on all protected routes
5. WHEN authentication fails, THE API SHALL return 401 status code

### Requirement 2: 团队管理

**User Story:** As a user, I want to create and manage teams, so that I can collaborate with others and organize resources.

#### Acceptance Criteria

1. THE System SHALL allow users to create new teams with a name and description
2. WHEN a user creates a team, THE System SHALL assign them as the team owner
3. THE System SHALL allow team owners to invite members via email
4. THE System SHALL support member roles: owner, admin, member
5. WHEN a user logs in, THE System SHALL show their teams and allow switching between them
6. THE System SHALL scope all resources (projects, servers, configs) to the current team
7. WHEN a user has no team, THE System SHALL prompt them to create one

### Requirement 3: 服务器管理

**User Story:** As a team admin, I want to manage servers, so that I can deploy and configure services on them.

#### Acceptance Criteria

1. THE System SHALL allow adding servers with: name, host, port, SSH credentials
2. THE System SHALL encrypt and securely store SSH credentials
3. THE System SHALL support testing server connectivity
4. WHEN a server is added, THE System SHALL detect installed services (Nginx, Docker, etc.)
5. THE System SHALL allow associating servers with Nginx configurations
6. THE System SHALL support server tags for organization

### Requirement 4: 域名代理配置（类 nginx-proxy-manager）

**User Story:** As a team admin, I want to manage domain proxy configurations, so that I can route traffic to my services.

#### Acceptance Criteria

1. THE System SHALL allow creating proxy configurations with: domain, upstream server, port, SSL settings
2. THE System SHALL support multiple upstream servers for load balancing
3. THE System SHALL support SSL certificate management (Let's Encrypt auto-renewal or custom certificates)
4. THE System SHALL generate Nginx configuration files based on proxy settings
5. WHEN a proxy config is created/updated, THE System SHALL optionally sync to the associated server
6. THE System SHALL support WebSocket proxy configuration
7. THE System SHALL allow associating proxy configs with projects
8. THE System SHALL provide a list view of all proxy configurations with status
9. WHEN creating a project, THE System SHALL allow configuring domain proxy inline

### Requirement 5: CDN 配置管理

**User Story:** As a team admin, I want to manage CDN configurations, so that I can accelerate static content delivery.

#### Acceptance Criteria

1. THE System SHALL allow creating CDN configurations with: domain, origin server, cache rules
2. THE System SHALL support multiple CDN providers (Qiniu, Aliyun, Cloudflare)
3. THE System SHALL store CDN provider credentials per team
4. THE System SHALL allow associating CDN configs with projects
5. THE System SHALL provide a list view of all CDN configurations with status
6. WHEN a CDN config is created, THE System SHALL optionally configure the CDN provider via API
7. THE System SHALL support cache purge operations

### Requirement 6: 项目资源关联

**User Story:** As a developer, I want to associate resources with projects, so that I can manage all project dependencies in one place.

#### Acceptance Criteria

1. THE System SHALL allow associating projects with: domain configs, CDN configs, database allocations, Redis allocations
2. WHEN viewing a project, THE System SHALL show all associated resources
3. THE System SHALL allow configuring resources during project creation wizard
4. THE System SHALL track resource usage per project
5. WHEN a project is deleted, THE System SHALL prompt for resource cleanup options

### Requirement 7: 资源凭证团队隔离

**User Story:** As a team admin, I want team resources to be isolated, so that different teams cannot access each other's credentials.

#### Acceptance Criteria

1. THE System SHALL scope all resource credentials to teams (not individual users)
2. THE System SHALL allow team admins to manage team-level credentials
3. WHEN a user switches teams, THE System SHALL only show resources for the current team
4. THE System SHALL support sharing specific resources between teams (optional, admin only)
5. THE System SHALL audit resource access by team members
