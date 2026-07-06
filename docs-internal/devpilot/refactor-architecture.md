# Devpilot 控制平面重构架构

> 本文档基于实际代码梳理，记录 @svton/\* 全栈统一重构后的架构、数据流与组织结构。
> 更新日期：2026-06-29。

## 一、重构总览

devpilot 控制平面（devpilot-web + devpilot-api）完成以下统一改造：

| 层         | 改造前                                                   | 改造后                                                                      |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| 后端响应   | 控制器裸返回数据                                         | `@svton/nestjs-http` 统一信封 `{ code, message, data }`，排除 SSE/下载      |
| 前端请求   | 201 行 `lib/api.ts`（fetch 拼装 + 重复 stream/download） | `lib/api-client/` 按职责拆分 7 文件 + `@svton/api-client` 适配器            |
| 请求 hooks | 各页手写 useEffect + loading/error                       | `hooks/api/use-api.ts` 基于 SWR 的 useQuery/useMutation                     |
| 状态管理   | zustand（3 store）                                       | `@svton/service`（3 service）+ 手写 token 持久化                            |
| UI 组件    | 原生 div + 手写 modal + 重复 statusClasses               | `@svton/ui` + 领域封装（StatusTag/PageHeader/ErrorBanner/MetricCard/Modal） |
| 回调优化   | 内联函数（每次渲染新建）                                 | `@svton/hooks` usePersistFn/useBoolean/useSetState                          |

## 二、组织架构图

```
svton (monorepo, pnpm workspace)
├── packages/                    # 框架包（被 devpilot 消费）
│   ├── ui/                      # @svton/ui 组件库
│   ├── hooks/                   # @svton/hooks
│   ├── service/                 # @svton/service（装饰器状态管理）
│   ├── api-client/              # @svton/api-client（请求框架）
│   └── nestjs-http/             # @svton/nestjs-http（后端响应信封）
│
├── apps/
│   ├── devpilot-api/            # NestJS 后端
│   │   └── app.module.ts        # 注册 HttpModule.forRoot（信封）
│   │
│   └── devpilot-web/            # Next.js 前端（本次重构重点）
│       └── src/
│           ├── lib/
│           │   ├── api-client/  # 请求层（fetch-adapter/interceptors/index/stream/compat/registry）
│           │   └── auth/        # token-storage（持久化 + cookie 同步）
│           ├── store/
│           │   ├── services/    # @svton/service（auth/team/project-config）
│           │   └── hooks.ts     # 兼容性 hooks（旧 useAuthStore 等签名）
│           ├── hooks/api/       # use-api.ts（SWR 封装）
│           ├── components/
│           │   ├── providers/   # AuthProvider + ServiceProviders
│           │   └── ui/          # 领域封装（StatusTag/PageHeader/ErrorBanner/MetricCard/Modal）
│           └── app/(dashboard)/ # 功能页（按域拆分）
│
└── docs-internal/devpilot/      # 本文档所在
```

## 三、数据流向图

### 请求流（前端 → 后端）

```
页面组件
  │ useQuery / useMutation (hooks/api/use-api.ts)
  ▼
apiAsync('GET:/teams', params)        # @/lib/api-client/index.ts
  │ createApiClient(fetchAdapter, { baseURL, interceptors })
  ▼
fetch-adapter                         # lib/api-client/fetch-adapter.ts
  │ fetch(baseURL + path, { credentials: include })
  │   ← 请求拦截器注入 Authorization / X-Team-Id
  ▼
devpilot-api (NestJS)
  │ HttpModule ResponseInterceptor    # app.module.ts
  │   剥离信封前的 { code, message, data }
  ▼
controller → service → repository → prisma
```

### 认证流

```
登录页 → auth.service.login(input)
  │ apiAsync('POST:/auth/login')
  ▼ 后端返回 { accessToken, user }
  commit(token, user)
  │ writePersistedAuth → localStorage + cookie('token')
  ▼
middleware.ts (SSR 路由保护)
  │ 读 cookie('token') → 放行或重定向 /login
  ▼
api-client token 拦截器
  │ readPersistedAuth().token → Authorization: Bearer
```

## 四、功能地图（域划分）

| 域         | 文档                           | 范围                                                                           |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------ |
| 认证与团队 | `domain-auth-team.md`          | login/register/teams/teams[id]/auth-provider                                   |
| 项目生成   | `domain-project-generation.md` | projects(+new/import/[id])、project-wizard、presets                            |
| 资源管控   | `domain-resource-control.md`   | resource-requests、resource-control、admin、access-policies、keys、backups     |
| 基础设施   | `domain-infrastructure.md`     | servers、proxy-configs、cdn、domain                                            |
| 运维治理   | `domain-ops-governance.md`     | monitoring、logs、audit-events、execution-governance、applications、git、sites |

## 五、页面结构图（已迁移样板）

每个功能页统一拆分为：

```
<feature>/
├── page.tsx          # <200 行，仅组合（PageHeader + 子组件 + 状态展示）
├── types.ts          # 接口定义
├── constants.ts      # 标签/选项常量
├── utils.ts          # 纯函数（格式化、判断）
├── hooks/
│   └── use-*.ts      # 数据获取 + 变更（usePersistFn 稳定引用）
└── components/
    └── *.tsx         # 单一职责子组件（卡片/表格/表单/弹窗）
```

## 六、关键技术决策

1. **fetch 而非 axios**：`@svton/api-client` 的 `createUnifiedResponseAdapter` 接收 `typeof fetch`，devpilot 保持 fetch 不引入 axios，适配器手写以支持 `credentials: include` 与信封剥离。
2. **手写 token 持久化**：`@svton/service` 无内置持久化，token-storage.ts 隔离 localStorage + cookie 同步，键名 `auth-storage` 与历史 zustand 一致避免清会话。
3. **统一响应信封排除**：`HttpModule.forRoot({ excludePaths: [下载正则, SSE正则] })`，保护 StreamableFile 与 text/event-stream。排除路径精确为：
   - `^/api/projects/generate$`（生成 ZIP，StreamableFile）
   - `^/api/projects/[^/]+/download$`（产物下载）
   - `^/api/logs/streams/[^/]+/(events|tail)$`（日志 SSE）
4. **Modal 类型归一化**：`@svton/ui` 的 forwardRef 组件在 React 19 + workspace 跨包消费下触发 TS2786，`components/ui/modal.tsx` 用 `(props) => JSX.Element` 断言归一化。
5. **装饰器工厂调用**：`@svton/service` 的 `@observable()`/`@action()` 是工厂，需带括号；devpilot-web tsconfig 开启 `experimentalDecorators`/`emitDecoratorMetadata`。

## 七、迁移进度（截至本文档更新）

| 基础设施            | 状态                          |
| ------------------- | ----------------------------- |
| skills 安装（6 个） | ✅ 完成                       |
| 后端响应信封        | ✅ 完成（290 单测通过）       |
| api-client 请求层   | ✅ 完成（7 文件，均 <200 行） |
| SWR hooks           | ✅ 完成                       |
| store → service     | ✅ 完成（zustand 移除）       |
| 领域 UI 封装        | ✅ 完成（5 组件）             |

| 页面迁移                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 状态                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| backups / audit-events（allEvents memo dependency warning 已修复） / git / presets / domain / resources（resourceTypes memo dependency warning 已修复） / keys / teams / teams[id]（member row avatar no-img-element warning 已修复） / cdn / cdn-configs / cdn-configs[id] / proxy-configs / proxy-configs[id] / servers / servers[id] / projects / projects-new / projects-import / resource-instances / resource-control（action run contract 已补齐） / resource-requests / admin/resource-pools / admin/resource-types / operation-approvals（approvals memo dependency warning 已修复） / execution-policies / access-policies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ✅ 已迁移（每文件 <200 行）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| projects/[id]（types/utils/components/hooks 已抽取，Site copy follow-up href helper contract、load effect dependency warning 和 deployment-config difference utility split 已完成，当前 route/components/hooks/types/utils 均 <200 行）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ✅ 已迁移                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 其余超大/超限面（monitoring Web 当前源码文件均 <200 行，API DTO barrel split、scheduler config/summary/type split、controller route/access split、resource metric dashboard service split、service SLO dashboard read-model split 与 notification delivery read service split、notification delivery payload builder split、notification delivery dispatch service split、notification retry orchestration service split、alert escalation orchestration service split、notification-channel service split、alert silence service split、alert event service split、alert rule service split、alert evaluation event service split、Site certificate evaluation service split、status evaluation service split 与 Service SLO evaluation service split、smoke-check evaluation service split、log-count evaluation service split、deployment/backup status evaluation service split、resource alert evaluation service split、Service SLO rule template service split、alert evaluation dispatch service split、dashboard direct-service wiring split、notification direct-service wiring split、silence direct-service wiring split 与 event direct-service wiring split 与 rule direct-service wiring split 与 scheduler direct-service wiring split 已完成，`monitoring.service.ts` 已低于 200 行，MonitoringService 已收敛为 alert evaluation orchestration / logs 目录 Tail hook effect dependencies 与 `use-logs.ts` data/action split 已完成，当前源码文件均 <200 行 / sites 1910，focusedSite takeover effect dependency warning、format TLS/date utility split、live action hook split、data/takeover hook split、SiteCard action buttons split、Add Site basic fields split 与 focused plan/run summary split 已完成，Sites 目录当前全部源码文件 <200 行 / execution-governance `supervisor.ts` type split 与 `supervisor-panel.tsx` 只读视图拆分已完成，supervisor panel 入口 38 行且 focused components/utils 均 <200 行 / applications route header actions、creation hook 与 service row SLO summary 已拆出，applications page/use-applications/service-row 当前均 <200 行） | ⏳ 待迁移（模式已验证可复用；resource-requests、access-policies 与 admin/resource-types 已完成页面级拆分；logs Agent Follow metadata contract 已修复，Tail hook metadata/stream effects 和 Logs data actions 均已抽到 <200 行 focused hooks，Logs/Sites 当前源码文件均低于 200 行；execution-governance supervisor DTO 类型与只读 panel view 已分层；monitoring 已恢复 P6 progress，已完成 API DTO input split、scheduler config/summary/type split、controller route/access split、resource metric dashboard read-model split、service SLO dashboard read-model split、notification delivery read/access split、payload builder split、dispatch service split、retry orchestration service split、alert escalation orchestration service split、notification-channel service split、alert silence service split、alert event service split、alert rule service split、alert evaluation event service split、Site certificate evaluation service split、status evaluation service split、Service SLO evaluation service split、smoke-check evaluation service split、log-count evaluation service split 和 deployment/backup status evaluation service split 和 resource alert evaluation service split 和 Service SLO rule template service split 和 alert evaluation dispatch service split 和 dashboard direct-service wiring split 和 notification direct-service wiring split 和 silence direct-service wiring split 和 event direct-service wiring split 和 rule direct-service wiring split 和 scheduler direct-service wiring split，`monitoring.service.ts` 已低于 200 行，后续继续从 P6 外剩余产品能力或其它 progress 边界推进；applications route shell、主 hook 与 service row 当前均低于 200 行） |
