# 第 0 步设计：简化交付主链路（六步、零内部名词）

日期：2026-08-17
依据：INVEST-1 UI 审计（agent_297e90f6）+ INVEST-2 设计原型与 API 映射（agent_62af5cd9）
范围：**纯前端实现**（apps/devpilot-web），复用现有后端端点，不碰后端、不删旧页面。

## 1. 目标与原则

- 一次发布 = 一个入口、一个向导、一个进度页；全程只用下方词汇表的用户词汇。
- 用户只需理解六个动作：选项目 → 选环境 → 确认配置 → 发布 → 看进度 → 回滚。
- 内部模型（BuildRun/Manifest/DeploymentRun/…）一律不出现在界面；流程机器自动做（如自动选最新成功构建的制品），只在出错时给人话原因。

## 2. 词汇表（内部概念 → 用户词汇，硬约束）

| 内部概念 | 界面用词 |
|---|---|
| ReleaseOrder | 发布单 |
| BuildRun / build | 构建 |
| Manifest / digest | 制品（仅展示短 ID，供报错引用） |
| staging / production | 预发环境 / 生产环境 |
| DeploymentRun | 部署 |
| EnvironmentVersion | 版本 |
| 回滚 / 回退 / 恢复（三词一义） | 统一"回滚" |
| preflight / gate | 发布前检查 |
| OperationApproval | 审批 |
| dry-run | 试运行（一般不出现） |
| ReleasePlan / ReleaseRun / Stage / Attempt / ConfigRevision | 不出现 |

## 3. 三个界面

### 界面 A：发布向导 `/projects/[id]/publish`（覆盖步骤②③④）

页内三步 stepper（参照 `/projects/create` 既有模式）：

1. **选环境**：环境卡片列表（预发/生产），只显示 名称+角色+当前版本+健康状态；不出现 name/key/修订。仅「预发环境」角色的启用环境可选（发布基线），其余环境置灰只读；恰好一个启用预发基线才能进入下一步，否则给指引文案与项目设置深链。点击卡片仅选中，进入下一步由「下一步」触发。
2. **确认配置**：生效配置表（见 §4）。存在未解决冲突或未配置密钥时"下一步"禁用并指明原因。
3. **确认发布**：一屏摘要（环境 / 配置条数与冲突数 / 分支与版本意图），主按钮"发布"。点击后：创建发布单 → 自动构建 → 自动部署预发 → 跳转界面 B。

数据端点：环境 `GET /project-environments?projectId=`；配置 `GET /project-environments/:id/config-revisions`（最新修订）；发布 `POST /projects/:pid/delivery/releases` → `POST /:roid/builds` → `POST /:roid/staging-deployments`（manifestId 自动取最新成功构建，用户不选）。

### 界面 B：发布进度 `/projects/[id]/publish/[releaseOrderId]`（覆盖步骤⑤）

- 单条时间线：发布前检查 → 构建 → 预发部署 → 生产发布。每步三态：进行中(带耗时)/成功/失败(人话原因 + 重试按钮)。
- 预发部署成功后，时间线下方出现主按钮 **"发布到生产"**：调用 `GET /:roid/production-preview` 展示一屏差异摘要 → 确认调 `POST /:roid/production-releases`。这是唯一的人工闸口。
- 审批需要时显示"等待审批"状态与入口链接，不再出现"请回到部署入口重新提交"式断链。
- SWR 轮询（运行中 5s，终态停），参照既有 `use-release-polling.hooks.ts` 模式。

### 界面 C：回滚（覆盖步骤⑥）

- 界面 B 的发布单详情与项目"版本历史"中均提供 **"回滚到此版本"**：`POST /delivery/environment-versions/:envId/recovery/preview`（展示回滚后变化一屏）→ 确认 `POST .../recovery/confirm`。
- 失败的发布单详情内直接给出"回滚到上一版本"按钮，不再藏于 4 跳之外。

## 4. 生效配置表（对齐 design-v2 画板 20）

- 列：`键 / 值(或状态) / 来源 / 操作`。
- 来源三分：**自定义**（可编辑/删除）、**资源注入**（只读，显示"来自 资源实例X"，不可手改，只能换绑定——链接到既有绑定入口）、**密钥**（显示"已配置/未配置"；未配置=阻断发布）。
- 合并计算（前端，纯函数）：最新修订的 plainVariables + secretReferences + resourceReferences（从资源实例 envTemplate 提取键，逻辑参照 `environment-resource-instance-list.tsx:22-33` 的既有提取方式，收敛为一个共享 util）。
- 冲突规则（与后端 409 策略一致，不自造覆盖语义）：同键多来源 → 行高亮 + 冲突标识 + "去解决"（编辑自定义变量或调整绑定）；**存在冲突不得进入下一步**。冲突判定参照后端 `environment-variable-ownership.model.ts` 的三源口径，前端实现同名等价纯函数并附注释说明对齐关系。
- 密钥状态：secretReferences 与可见密钥列表比对；比对不上=「密钥不可见（未配置或无权限）」，**警告不阻断**（密钥值本就不可见，未出现在列表不等于未配置），给密钥中心深链。唯一发布阻断项是未解决的冲突。

## 5. 实施范围

**新建**（`src/app/(dashboard)/projects/[id]/publish/` 及配套 hooks/components/models，每个文件 ≤200 行、单一职责）：

- `page.tsx`（向导壳）、`[releaseOrderId]/page.tsx`（进度壳）
- 向导三步组件、`effective-config-table` 组件族（表格/冲突横幅/来源徽标）
- 发布进度时间线组件族（步骤项/生产确认/审批提示/回滚入口）
- hooks：`use-publish-wizard`（环境+配置+提交编排）、`use-release-progress`（轮询+步骤归并）、`use-release-rollback`（preview→confirm）
- models（纯函数）：`effective-config.model.ts`（合并+冲突）、`release-progress.model.ts`（后端状态→四步时间线映射）
- i18n：zh + en（若存在 en）词条，全部走词汇表

**修改（最小接线）**：

- 项目交付页（`project-delivery-summary.tsx` 或项目页头部）加主按钮 **"发布"** → `/projects/[id]/publish`
- 旧链路（ReleaseOrderCreateModal 四步 stepper、DeployWizard、ReleaseCreateWizard）**保留不动**，本期不删不藏导航

**禁止触碰**（用户未提交的工作区改动）：
`apps/devpilot-api/**` 全部；`apps/devpilot-web/src/app/(dashboard)/applications/hooks/use-application-service-config.hooks.ts`；以及 `git status` 中其余脏文件。

## 6. 验收标准

1. 新用户从项目列表 ≤3 次点击进入发布向导。
2. 向导与进度页 **0 个词汇表外的内部名词**（zh/en 双语检查）。
3. 冲突/未配置密钥可见、可定位、未解决不能发布。
4. 发布后：四步时间线自动推进；预发成功一键"发布到生产"；全程无"重新提交"式断链。
5. 回滚从发布单详情一步可达（preview→confirm 两段确认）。
6. `type-check` 与 `lint` 通过（日志存 `/tmp/codex-tool-runs/svton/`）；新文件均 ≤200 行。
7. 不修改任何后端文件与既有脏文件；旧功能零回归（不改旧组件行为）。

## 7. 明确不做（本期）

后端任何改动；删除/隐藏旧发布链路；实时日志流（SSE）；资源绑定管理界面重构（仅链接到既有入口）。

本期未做的后续项（follow-ups）：

- 版本历史页回滚入口：回滚目前仅在发布进度页提供（发布单详情一步可达），版本历史页的「回滚到此版本」入口留待后续。
- models 目录归位：publish/components 下的 `*.model.ts`（纯函数模型）暂随组件目录，后续统一迁至独立 models 目录。
- resume_intake。
