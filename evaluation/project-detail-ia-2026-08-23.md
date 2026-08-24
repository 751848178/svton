# 项目详情页 IA 重构（2026-08-23）：决策、五图与实现对照

> 依据实际代码梳理（非假设）：路由宿主 `project-route-host.tsx`、页头 `project-workbench-header.tsx`、
> 发布工作台 `project-delivery-route.tsx` / `release-order-detail-panel.tsx`、部署域
> `deployment.service.ts`（listRuns）与 `deployment-run-include.constants.ts`、数据链
> `DeploymentRun →(releaseStageAttempts)→ ReleaseStage →(releasePlanId)→ ReleasePlan →(releaseOrderId)→ ReleaseOrder`。

## 一、页面结构图（重构前 → 后）

```mermaid
graph TD
  subgraph 前["重构前：5-tab 平铺（?view= query 驱动）"]
    A1["/projects/:id 页头(icon+标题+仓库行)+5-tab nav"]
    A2["tab1 项目信息（dl 卡片+组件表+仓库解析）"]
    A3["tab2 发布 ?view=releases（列表+详情内嵌）"]
    A4["tab3 项目配置 /settings"]
    A5["tab4 域名与入口 /domains"]
    A6["tab5 部署记录 ?view=deployments（全项目列表+筛选）"]
  end
  subgraph 后["重构后：实体页 + 独立工作台 + 跟随上下文"]
    B0["/projects/:id ←返回 + 标题 | 右上: [配置▾(项目配置/域名与入口)] [创建发布]"]
    B1["基本信息区（去卡片 dl）+ 组件表 + 仓库解析与审核"]
    B2["/projects/:id/releases 发布工作台（独立二级页面，路径化）"]
    B3["  └ 发布单详情：步骤导航 + 动态 + 技术证据 + [部署记录]→Drawer"]
    B4["/projects/:id/settings、/domains（配置域，右上角下拉进入）"]
  end
  A1-->B0; A2-->B1; A3-->B2; A6-->B3; A4-->B4; A5-->B4
```

## 二、业务逻辑图（发布流程与部署归属）

```mermaid
graph LR
  C0["创建发布单(草稿)"] --> C1["步骤01 仓库与环境基线(门禁)"]
  C1 --> C2["步骤02 构建制品 BuildRun→Manifest"]
  C2 --> C3["步骤03 预发 Staging 部署 DeploymentRun"]
  C3 --> C4["步骤04 生产：申请审批→ReleaseRun→EnvironmentVersion 生效"]
  C3 -. "releaseStageAttempts 归属" .-> D1["DeploymentRun"]
  C4 -. "releaseRunId 生效记录" .-> D2["EnvironmentVersion"]
  D1 -->|"行内「查看记录」/详情[部署记录]"| Drawer["部署记录 Drawer（按发布单过滤）"]
```

## 三、数据流向图（页面 → API → 表）

```mermaid
graph LR
  P1["项目详情"] -->|"GET /project-directory"| API1[(project-directory presenter)]
  P1 -->|"useProjectDetail"| API2[("GET /deployments/runs?projectId")]
  P2["发布工作台 /releases"] -->|"useReleaseOrders"| API3[("GET /projects/:id/delivery/releases")]
  P2 -->|"useReleaseOrderDetail/Evidence/GateCatalog"| API4[("release-delivery 各端点")]
  Drawer2["部署 Drawer"] -->|"use-release-deployments"| API5[("GET /deployments/runs?projectId&releaseOrderId ← 新增过滤")]
  API5 --> DB[("DeploymentRun ⋈ ReleaseStageAttempt ⋈ ReleaseStage ⋈ ReleasePlan(releaseOrderId)")]
```

## 四、功能地图（项目域）

```mermaid
graph TD
  L["项目列表（动态列+配置 popover）"] --> D["项目详情：基本信息/组件/仓库解析"]
  D -->|"右上 创建发布"| R["发布工作台 /releases"]
  D -->|"右上 配置▾"| S["项目配置 /settings（6 子 tab）"]
  D -->|"右上 配置▾"| G["域名与入口 /domains"]
  R -->|"行/详情"| RD["发布单详情（4 步骤）"]
  RD -->|"[部署记录]"| DD["部署 Drawer（本单 runs）"]
```

## 五、组织架构图（前端组件分层）

```mermaid
graph TD
  UI["@svton/ui：Button/Tag/Modal/Drawer/Dropdown/Table/TableFilters/Avatar…"]
  AUI["@/components/ui 应用层：薄包装+领域件(StatusTag/ActionMenu/…)"]
  Pages["页面组件：route-host / delivery-route / domains-route / settings-content"]
  Panels["面板：information-panel / orders-panel / detail-panel(+drawer) / domains-table"]
  Hooks["hooks：use-project-detail / use-release-orders / use-release-deployments(新)"]
  UI --> AUI --> Panels --> Pages
  Hooks --> Panels
```

## 六、六项决策与实现对照

| # | 决策（设计/产品依据） | 实现 |
|---|---|---|
| 1 | 实体页惯例：← 返回（history>1 back 否则回列表），标题即身份 | `project-workbench-header.tsx` 重写 |
| 2 | 仓库/分支=低频参考，已在基本信息区与仓库解析区（重复违反"同一事实不进多容器"）→ 移除 | 同上（标题区仅名称） |
| 3 | 契约"排版优先于容器"→ 基本信息去卡片为分区排版 | `project-information-panel.tsx` |
| 4 | 发布=流程工作台非信息分区；双层 tabs（nav+步骤）认知负担大 → 独立二级页面（与 settings/domains 同级路径化）；`?view=releases` 302 兼容 | `/releases/page.tsx` + `releasesViewRedirectHref` |
| 5 | 低频配置不占一级导航 → 右上「配置▾」（@svton/ui Dropdown） | header 动作区 |
| 6 | 数据上部署即发布执行产物（releaseStageAttempts 归属链）→ 按单 Drawer + runId 深链聚焦；旧 `?view=deployments&runId` 重定向进 Drawer | `release-deployments-drawer.tsx` + API `releaseOrderId` 过滤 |

## 七、兼容与深链

- `?view=releases` → `/releases`（保留 create/releaseOrderId 等参数）
- `?view=deployments&runId=x` → `/releases?deploymentRunId=x`（详情页解析归属单开 Drawer）
- `deploymentRunHref(projectId, runId, releaseOrderId?)`：发布列表行与 run 行链接均携带 order 上下文
- 项目列表行「部署记录」动作移除（部署跟随发布，入口收敛到发布域）

## 八、遗留与建议

- `overview-tab.tsx` / `latest-deployment-hero.tsx` 为无引用死代码（含旧 view=deployments 注释），建议删除（本次未动，避免与在途分支冲突）
- Dashboard「最近部署」等站外入口若仍指向 `?view=deployments`，由统一重定向兜底，后续可直连 Drawer 深链
