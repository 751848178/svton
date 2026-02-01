# Requirements Document

## Introduction

Web Project Initializer 是一个基于 Web 的可视化项目初始化平台，允许用户通过浏览器界面创建基于 Svton 技术栈的全栈应用项目。该平台提供基于业务功能的智能包选择、子项目配置、资源凭证管理、Git 集成以及自动配置注入能力，使得新项目可以开箱即用。

## Glossary

- **Initializer**: Web 项目初始化平台，提供可视化界面创建新项目
- **Business_Feature**: 业务功能，如"缓存"、"支付"、"OAuth登录"等，用户选择功能后系统自动匹配对应的包
- **Sub_Project**: 子项目类型，包括 backend（后端服务）、admin（管理后台）、mobile（移动端小程序）
- **UI_Library**: 前端 UI 组件库选择，admin 使用 @svton/ui，mobile 使用 @svton/taro-ui
- **Hooks_Library**: React Hooks 工具库 @svton/hooks
- **Resource**: 外部服务资源，如数据库、缓存、对象存储等，包含连接凭证
- **Resource_Credential**: 资源的连接信息，如主机地址、端口、用户名、密码、Token 等
- **Feature_Package_Mapping**: 功能到包的映射关系，定义每个业务功能对应哪些 svton 包
- **Config_Injection**: 将资源凭证和模块配置自动注入到生成项目的过程
- **Git_Provider**: Git 服务提供商，如 GitHub、GitLab、Gitee 等

## Requirements

### Requirement 1: 用户认证与登录

**User Story:** As a developer, I want to register and login to the platform, so that I can save my configurations and access my projects securely.

#### Acceptance Criteria

1. THE Initializer SHALL provide user registration with email and password
2. THE Initializer SHALL support OAuth login via GitHub, GitLab, and Gitee
3. WHEN a user logs in successfully, THE Initializer SHALL create a session and redirect to the dashboard
4. THE Initializer SHALL allow users to reset their password via email
5. WHEN a user is not authenticated, THE Initializer SHALL restrict access to project creation and resource management
6. THE Initializer SHALL support session persistence across browser sessions

### Requirement 2: 项目基础信息配置

**User Story:** As a developer, I want to configure basic project information through a web form, so that I can quickly set up a new project with my preferred settings.

#### Acceptance Criteria

1. WHEN a user visits the project creation page, THE Initializer SHALL display a form for entering project name, organization name, and description
2. WHEN a user enters a project name, THE Initializer SHALL validate it against npm package naming rules
3. IF a project name is invalid, THEN THE Initializer SHALL display a clear error message explaining the naming requirements
4. THE Initializer SHALL allow users to select a package manager (pnpm, npm, yarn)

### Requirement 3: 子项目选择

**User Story:** As a developer, I want to select which sub-projects to include (backend, admin, mobile), so that I can create a project structure that matches my needs.

#### Acceptance Criteria

1. THE Initializer SHALL display Sub_Project options: backend (NestJS 后端服务), admin (Next.js 管理后台), mobile (Taro 小程序)
2. WHEN a user selects a Sub_Project, THE Initializer SHALL show relevant configuration options for that sub-project
3. THE Initializer SHALL require at least one Sub_Project to be selected
4. WHEN admin Sub_Project is selected, THE Initializer SHALL offer UI_Library selection (@svton/ui)
5. WHEN mobile Sub_Project is selected, THE Initializer SHALL offer UI_Library selection (@svton/taro-ui)
6. WHEN admin or mobile Sub_Project is selected, THE Initializer SHALL offer Hooks_Library selection (@svton/hooks)

### Requirement 4: 业务功能选择与智能包匹配

**User Story:** As a developer, I want to select business features (like caching, payment, OAuth) and have the system automatically determine which packages are needed, so that I don't need to understand the underlying package structure.

#### Acceptance Criteria

1. THE Initializer SHALL display Business_Features grouped by category: 基础设施（缓存、队列、限流）、存储（对象存储、数据库）、认证授权（OAuth、权限控制）、第三方服务（支付、短信）、开发工具（日志、HTTP客户端、配置管理）
2. WHEN a user selects a Business_Feature, THE Initializer SHALL automatically resolve and select all required svton packages via Feature_Package_Mapping
3. WHEN a Business_Feature requires a Resource, THE Initializer SHALL highlight the resource configuration section
4. THE Initializer SHALL display which packages will be included based on selected features
5. WHEN a user hovers over a Business_Feature, THE Initializer SHALL show a tooltip with feature description and mapped packages
6. THE Initializer SHALL filter available Business_Features based on selected Sub_Projects (e.g., backend features only shown when backend is selected)

### Requirement 5: 资源凭证管理

**User Story:** As a developer, I want to manage resource credentials in one place, so that my generated project can connect to external services without manual configuration.

#### Acceptance Criteria

1. THE Initializer SHALL support managing credentials for: MySQL, Redis, Object Storage (Qiniu Kodo, AWS S3), SMS providers, Payment providers (WeChat Pay, Alipay), OAuth providers (WeChat, GitHub)
2. WHEN a user adds a Resource_Credential, THE Initializer SHALL validate the credential format
3. WHEN a user configures a Resource, THE Initializer SHALL provide a form with appropriate fields for that resource type
4. THE Initializer SHALL persist Resource_Credentials to user's account (encrypted in database)
5. WHEN generating a project, THE Initializer SHALL inject configured credentials into the project's environment files
6. THE Initializer SHALL mask sensitive credential values in the UI after entry
7. WHEN a Business_Feature is selected that requires a Resource, THE Initializer SHALL show the resource configuration inline

### Requirement 6: Git 集成

**User Story:** As a developer, I want to push my generated project directly to a Git repository, so that I can start collaborating immediately without manual setup.

#### Acceptance Criteria

1. THE Initializer SHALL support connecting to Git_Providers: GitHub, GitLab, Gitee
2. WHEN a user connects a Git_Provider, THE Initializer SHALL use OAuth to authorize access
3. THE Initializer SHALL allow users to select an existing repository or create a new one
4. WHEN creating a new repository, THE Initializer SHALL allow setting repository name, visibility (public/private), and description
5. WHEN a user generates a project with Git integration, THE Initializer SHALL push the generated code to the selected repository
6. THE Initializer SHALL initialize the repository with appropriate .gitignore and README.md
7. IF Git push fails, THEN THE Initializer SHALL provide error details and offer to download the project as ZIP instead

### Requirement 7: 项目生成与下载

**User Story:** As a developer, I want to generate and download my configured project, so that I can start development immediately with all settings pre-configured.

#### Acceptance Criteria

1. WHEN a user clicks generate, THE Initializer SHALL create a project containing all selected Sub_Projects and configurations
2. THE Initializer SHALL generate appropriate NestJS module imports based on selected Business_Features
3. THE Initializer SHALL generate a .env.example file with all required environment variables
4. THE Initializer SHALL generate a .env file with user-provided Resource_Credentials
5. WHEN generation is complete, THE Initializer SHALL provide options to: download as ZIP, push to Git, or both
6. THE Initializer SHALL display a summary of what was generated including selected features, packages, and configured resources
7. THE Initializer SHALL generate docker-compose.yml with services matching selected resources (MySQL, Redis, etc.)

### Requirement 8: 功能到包的映射注册表

**User Story:** As a platform maintainer, I want to define feature-to-package mappings in a registry, so that the initializer can automatically resolve which packages are needed for each business feature.

#### Acceptance Criteria

1. THE Feature_Package_Mapping SHALL define for each Business_Feature: name, description, category, target Sub_Projects, required packages, and required resources
2. THE Feature_Package_Mapping SHALL be stored as JSON configuration files
3. WHEN the Initializer loads, THE Initializer SHALL read the Feature_Package_Mapping to populate available features
4. THE Feature_Package_Mapping SHALL define the code snippets needed to integrate each package into a NestJS application
5. THE Feature_Package_Mapping SHALL define the configuration schema for each package

### Requirement 9: 配置预览

**User Story:** As a developer, I want to preview the generated configuration before downloading, so that I can verify the setup is correct.

#### Acceptance Criteria

1. WHEN a user requests a preview, THE Initializer SHALL display the generated project structure as a file tree
2. THE Initializer SHALL allow users to preview key configuration files (app.module.ts, .env, package.json, docker-compose.yml)
3. WHEN previewing a file, THE Initializer SHALL syntax-highlight the content
4. THE Initializer SHALL show which Business_Features contributed to each configuration file

### Requirement 10: 项目配置持久化

**User Story:** As a developer, I want to save and load my project configurations, so that I can reuse settings across multiple projects.

#### Acceptance Criteria

1. THE Initializer SHALL allow authenticated users to save current configuration as a named preset
2. THE Initializer SHALL store presets in user's account
3. WHEN a user loads a preset, THE Initializer SHALL restore all project settings, feature selections, and resource configurations
4. THE Initializer SHALL allow users to export configuration as a JSON file
5. THE Initializer SHALL allow users to import configuration from a JSON file
6. THE Initializer SHALL maintain a history of generated projects for each user



### Requirement 11: 资源池管理（可选功能）

**User Story:** As a platform administrator, I want to manage a pool of infrastructure resources (databases, Redis instances, domains, CDN, reverse proxies), so that developers can optionally allocate resources from the pool when creating projects.

#### Acceptance Criteria

1. THE Initializer SHALL support defining Resource_Pools for: MySQL instances, Redis instances, domains, CDN configurations, reverse proxy configurations
2. THE Initializer SHALL allow administrators to add infrastructure endpoints to Resource_Pools
3. WHEN an administrator adds a MySQL instance to the pool, THE Initializer SHALL store connection details and track available capacity
4. THE Initializer SHALL display resource pool status including total capacity and available resources
5. THE Resource_Pool feature SHALL be optional - projects can be created without using any pool resources

### Requirement 12: 项目资源自动开通（可选功能）

**User Story:** As a developer, I want to optionally provision new resources (database, user credentials) when creating a project, so that I can choose between manual setup or automatic provisioning.

#### Acceptance Criteria

1. WHEN a user creates a project requiring MySQL, THE Initializer SHALL offer options: skip resource configuration, use existing credentials, OR provision new database/user from pool
2. WHEN a user chooses to provision a new MySQL database, THE Initializer SHALL create a new database and user with generated credentials on an available MySQL instance
3. WHEN a user chooses to provision a new Redis namespace, THE Initializer SHALL allocate a dedicated Redis database number or key prefix
4. THE Initializer SHALL automatically inject provisioned resource credentials into the generated project
5. IF resource provisioning fails, THEN THE Initializer SHALL rollback any partial changes and display error details
6. THE Initializer SHALL track which resources are allocated to which projects
7. THE resource provisioning feature SHALL be entirely optional - users can skip all resource configuration

### Requirement 13: 域名与反向代理配置（可选功能）

**User Story:** As a developer, I want to optionally configure domain names and reverse proxy settings for my project, so that my application can be accessed via a custom domain if needed.

#### Acceptance Criteria

1. THE Initializer SHALL allow users to optionally specify domain names for each Sub_Project (e.g., api.example.com for backend, admin.example.com for admin)
2. WHEN a user specifies a domain, THE Initializer SHALL validate the domain format
3. THE Initializer SHALL generate nginx/caddy reverse proxy configuration files based on specified domains
4. THE Initializer SHALL support configuring SSL certificates (Let's Encrypt auto or custom certificate)
5. WHEN generating deployment configurations, THE Initializer SHALL include domain and proxy settings if configured
6. THE domain configuration feature SHALL be optional - projects can be created without any domain configuration

### Requirement 14: CDN 配置（可选功能）

**User Story:** As a developer, I want to optionally configure CDN settings for my project's static assets, so that I can choose whether to use CDN based on my needs.

#### Acceptance Criteria

1. THE Initializer SHALL allow users to optionally configure CDN for static assets (admin frontend, mobile assets)
2. WHEN a user configures CDN, THE Initializer SHALL generate appropriate asset URL prefixes in the project configuration
3. THE Initializer SHALL support multiple CDN providers (Qiniu, Aliyun, Cloudflare)
4. THE Initializer SHALL generate CDN purge scripts for deployment workflows if CDN is configured
5. THE CDN configuration feature SHALL be optional - projects can be created without CDN configuration

### Requirement 15: 资源生命周期管理

**User Story:** As a developer, I want to view and manage resources allocated to my projects, so that I can track usage and clean up unused resources.

#### Acceptance Criteria

1. THE Initializer SHALL display all resources allocated to each project
2. THE Initializer SHALL allow users to release/deallocate resources from a project
3. WHEN a project is deleted, THE Initializer SHALL prompt whether to release associated resources
4. THE Initializer SHALL track resource allocation history for auditing
