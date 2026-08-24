# Devpilot 项目工作台：代码依据与结构图

本文档只描述当前 `master` 已存在或本次已接入的代码路径，不把设计意图写成已实现能力。

## 1. 业务逻辑图

```mermaid
flowchart LR
  Intake[创建项目] --> Env[创建阶段确定环境]
  Intake --> Repo[绑定仓库与默认分支]
  Repo --> Analysis[按指定 branch / commit 解析]
  Analysis --> Review[审核组件与配置变更]
  Review --> Info[更新项目信息中的组件列表]
  Info --> Release[创建名称 + x.y.z 发布单]
  Release --> Build[构建并冻结 Manifest]
  Build --> Staging[预发部署与验证]
  Staging --> Gates{发布门禁}
  Gates -->|未通过| Explain[展示原因、影响与处理入口]
  Gates -->|通过| Approval{是否需要生产审批}
  Approval -->|待审批| Explain
  Approval -->|已批准| Production[生产发布]
  Production --> Version[更新环境当前版本]
  Config[项目配置：选择已有环境] --> Version
  Config --> Target[部署目标]
  Config --> Resource[资源绑定]
  Config --> Secret[变量与密钥]
  Config --> Access[访问权限]
  Config --> Verify[验证与监控]
  Domain[域名与入口] --> Site[Site 项目作用域配置]
  Site --> Target
```

代码依据：

- 发布单入口与阶段 API：`release-order.controller.ts`。
- 版本切换、审批、门禁、目标就绪和路由激活：`environment-version.service.ts`。
- 仓库解析启动参数和审核应用：`repository-analysis.controller.ts`、`repository-suggestion-apply.repository.ts`。
- 项目域名查询与操作：`site.controller.ts`、`use-sites.ts`。

## 2. 组织架构图

```mermaid
flowchart TB
  subgraph Web[devpilot-web]
    Route[ProjectRouteHost]
    Header[ProjectWorkbenchHeader + Nav]
    InfoUI[ProjectInformationPanel]
    ReleaseUI[ProjectDeliveryRoute + Release Workbench]
    ConfigUI[ProjectSettingsContent + EnvironmentSettingsDetail]
    DomainUI[ProjectDomainsRoute]
    Hooks[Project / Release / Version / Analysis / Site Hooks]
    Route --> Header
    Route --> InfoUI
    Route --> ReleaseUI
    Route --> ConfigUI
    DomainUI --> Header
    InfoUI --> Hooks
    ReleaseUI --> Hooks
    ConfigUI --> Hooks
    DomainUI --> Hooks
  end

  subgraph API[devpilot-api]
    ReleaseController[ReleaseOrderController]
    VersionController[EnvironmentVersionController]
    AnalysisController[RepositoryAnalysisController]
    SiteController[SiteController]
    ReleaseDomain[Release services / gate evaluators / repositories]
    AnalysisDomain[Analysis worker / suggestion apply]
    SiteDomain[Site plan / sync / route switch]
    ReleaseController --> ReleaseDomain
    VersionController --> ReleaseDomain
    AnalysisController --> AnalysisDomain
    SiteController --> SiteDomain
  end

  subgraph Data[Persistence and execution]
    Prisma[(Prisma / MySQL)]
    Executor[Server executor]
    Audit[Audit events]
  end

  Hooks --> ReleaseController
  Hooks --> VersionController
  Hooks --> AnalysisController
  Hooks --> SiteController
  ReleaseDomain --> Prisma
  AnalysisDomain --> Prisma
  SiteDomain --> Prisma
  ReleaseDomain --> Executor
  SiteDomain --> Executor
  ReleaseDomain --> Audit
  AnalysisDomain --> Audit
  SiteDomain --> Audit
```

## 3. 功能地图

```mermaid
mindmap
  root((项目工作台))
    项目信息
      仓库地址
      默认分支
      当前发布策略（只读）
      项目组件
        组件与服务
        分支与 commit
        已审核配置变更
      仓库变更识别记录
    发布
      发布单表格
      创建名称与 x.y.z 版本
      构建
      预发部署
      生产发布
      门禁与审批
      技术证据
    项目配置
      已有环境切换
      版本
      部署目标
      资源绑定
      变量与密钥
      访问权限
      验证与监控
    域名与入口
      项目环境筛选
      代理与域名配置
      Site 同步能力
    部署记录
      环境部署运行
```

## 4. 数据流向图

```mermaid
sequenceDiagram
  actor User as 用户
  participant Web as 项目工作台
  participant API as Devpilot API
  participant DB as Prisma/MySQL
  participant Exec as Server Executor

  User->>Web: 创建发布（名称 + x.y.z）
  Web->>API: POST /projects/:id/delivery/releases
  API->>DB: 保存 ReleaseOrder 与发布策略快照
  API-->>Web: 发布单详情
  User->>Web: 构建 / 预发 / 生产操作
  Web->>API: 发布阶段命令
  API->>DB: 校验仓库证据、Manifest、配置修订、目标、并发与审批
  alt 门禁未通过
    API-->>Web: 阻断原因与恢复动作
    Web-->>User: 在当前步骤解释并给出上下文操作
  else 门禁通过
    API->>Exec: 执行构建或部署
    Exec-->>API: 运行结果与证据
    API->>DB: 保存运行、审计与环境版本
    API-->>Web: 最新步骤和状态
  end

  User->>Web: 在项目配置选择已有环境和已有版本
  Web->>API: POST /environment-versions/:environmentId/actions
  API->>DB: 复用目标、门禁、审批和版本候选校验
  API-->>Web: applied / pending approval / blocked

  User->>Web: 管理项目域名与入口
  Web->>API: GET/POST/DELETE /sites?projectId&environmentId
  API->>DB: 保存项目作用域 Site 配置
  API->>Exec: 经计划、审批和同步运行应用代理配置
```

## 5. 页面结构图

```mermaid
flowchart TB
  Header[项目名称 / 仓库 / 默认分支 / 创建发布]
  Tabs[项目信息｜发布｜项目配置｜域名与入口｜部署记录]
  Issue[紧凑上下文问题：原因 + 影响 + 行内处理链接]
  Header --> Tabs --> Issue
  Issue --> InfoPage[项目信息：事实字段 + 组件表 + 次级解析记录]
  Issue --> ReleasePage[发布：筛选 + 常规表格 + 操作列]
  Issue --> ConfigPage[项目配置]
  Issue --> DomainPage[域名与入口：环境筛选 + Site 表格]
  Issue --> DeployPage[部署记录]
  ConfigPage --> EnvSelect[当前环境：仅已有环境 Select]
  EnvSelect --> SideNav[左侧：版本 / 目标 / 资源 / 变量密钥 / 权限 / 验证]
  SideNav --> Main[中部配置内容]
  Main --> Context[右侧或行内详情：只显示当前对象必要证据与动作]
  ReleasePage --> Actions[操作列：前三项直出；超过三项进入省略菜单]
```

## 代码所有权索引

- 页面壳与导航：`apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/project-workbench-*.tsx`
- 项目信息：`project-information-panel.tsx`、`use-repository-analysis.hooks.ts`
- 发布列表与流程：`project-delivery-route.tsx`、`release-orders-panel.tsx`、`release-workbench/`
- 项目配置：`project-settings-content.tsx`、`settings/environment-settings-*.tsx`
- 版本切换：`settings/environment-version-config.tsx`、`use-environment-versions.ts`
- 域名与入口：`project-domains-route.tsx`、`project-domains-table.tsx`、`sites/hooks/use-sites.ts`
- API 发布边界：`apps/devpilot-api/src/release-delivery/`
- API 仓库解析边界：`apps/devpilot-api/src/repository-analysis/`
- API Site 边界：`apps/devpilot-api/src/site/`
