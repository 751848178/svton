# 多服务与选择性发布（schemaVersion: 2）

一个项目（如 TWGG 的 backend/admin/mobile）用一份 `ship.yaml` 描述为一个**发布组**：默认一次发布构建、推送并更新全部应用服务；`--services` 只发布选中的服务；`--plan` 只读输出计划。原有 v1 单应用 `ship.yaml` 不需要任何修改，CLI、归属规则与快照全部沿用。

- 入门示例：[examples/demo-multi](../examples/demo-multi/)（两个服务、多阶段 target、envFile、健康检查）。
- 能力要求：**控制器 CLI 与构建机、运行端 agent 必须同为支持 `multi-service-v2` 的版本**。旧 agent 会在创建构建机之前被明确拒绝，不会静默退化成单镜像部署。
- 第一阶段限制：镜像平台显式声明并逐个校验（组默认 `linux/amd64`，可按服务覆盖为 `linux/arm64`）；不含多架构构建。

## 用户操作契约

```bash
ship release --plan --json                 # 只读计划：不构建、不拉取、不改任何状态
ship release --services admin --plan --json
ship release --services admin --json        # 只构建/推送/更新 admin
ship release --services backend,mobile --json
ship release --json                         # 默认全部应用服务
ship build --services admin --json          # 只构建不部署
ship rollback <group> [--services a,b]      # 撤销最近一次发布的 changedServices，或显式服务集
ship rollback <group> --base-release <id>   # 计划冲突检查：用 `ship release --plan` 输出的 baseReleaseId；
                                            # 期间发生过新发布则拒绝，防止过期计划覆盖新版本
```

选择解析规则（全部在创建构建机**之前**拒绝，不产生费用）：

- `--services` 为空、含空名、重名或非法字符 → 拒绝；
- 名称不在 `services` 中 → 拒绝并列出可用服务名；
- 首次部署没有可继承快照 → 必须覆盖全部服务，缺一个都拒绝；
- 运行端组合里存在而新规格里没有的服务 → 拒绝（下线运行中的服务需要显式迁移，不随发布静默丢弃）；
- 未选中服务的规格发生了变化（端口/挂载/网络等）→ 拒绝并提示把它加入 `--services`；继承服务保持已提交快照原样；
- 新增到 ship.yaml 但未选中、又没有已提交版本可继承的服务 → 计划阶段即拒绝（与运行端合并判定一致，构建前失败）；
- `--keep-env` 用于首次部署 → 计划阶段拒绝（无已提交环境可保留）；对已部署组合则按服务混合继承：有环境的继承旧环境，明确无环境的保持无环境。

## 规格与兼容

```yaml
schemaVersion: 2
name: twgg                     # 发布组名 = 部署身份（v2 组在运行端占据 apps/<name>/）
services:
  backend:
    dockerfile: apps/backend/Dockerfile
    context: apps/backend
    target: prod               # Dockerfile 构建目标，逐服务传入并校验
    ports: ["8080:8080"]
    healthcheck: { path: /healthz, hostPort: 8080 }
  admin:
    dockerfile: apps/admin/Dockerfile
    envFile: admin.env         # 运行端私有交付，绝不进入镜像/计划输出/JSON 日志
    networks: ["twgg-net"]     # 外部网络：必须已存在，切换前逐一核验
    volumes:                   # 外部命名卷 / 只读绝对路径 bind mount
      - "twgg-uploads:/srv/uploads"
      - "/srv/data:/srv/data:ro"
```

- v1 `ship.yaml` 原样可用；v1 与 v2 **互不接管**：同名应用若已有 v1 部署痕迹，v2 明确拒绝并要求人工迁移；反之亦然。
- 迁移（显式、可审计）：在运行端 `apps/<name>/` 手工写入 `group.json`（`{"schemaVersion":2}`）与 `project.json`（`{app,project,env}`），并核对 compose 项目/容器/网络/卷的实际归属；工具不会自动导入或改名。
- 基础设施服务（MySQL/Redis 等）不在默认选择中：它们由既有栈管理，本能力只管声明在 `services` 里的应用服务。

## 构建、快照与发布语义

1. 同一台（动态或静态）构建机串行构建全部选中服务；全部构建成功后才开始推送；**每个推送必须返回合法 `sha256:<64hex>` digest，缺失/非法/与 ref 不一致都拒绝**——没有可部署 manifest 落在可变 tag 上；运行端 `/api/deploy-group` 也只接受 `@sha256:` 固定的 imageRef。manifest 记录每个服务**实际生效的平台**（服务覆盖优先于组默认）与 `archVerified`（构建端报告的 arch 与声明一致才为 true，未知 arch 如实记为未校验，绝不假报）。from-dir 发布记录确定性 `contentDigest`（对上传源码树按排序路径+内容求 sha256，同一棵树必得同一摘要），不伪造 Git SHA；继承服务保留各自旧出处。
2. 运行端为每个服务维护独立 compose 项目 `ship_<组>_<服务>`（下划线不可能出现在组/服务名里，派生名无碰撞），未选中服务的 compose 文件原样不动，容器不会重启（容器 ID 与 StartedAt 不变）。
3. 请求只携带**变更服务**；运行端在组锁内读取最新提交状态并合并——两个并发部分发布互不覆盖，都不会丢更新。
4. 每次发布/回滚写入完整组合快照（每服务镜像 digest、规格、私有 env、源码出处），`changedServices` 与父版本入历史；回滚本身也是一条新的完整记录。
5. 切换顺序：核验外部网络/卷/bind 路径 → **全部**选中镜像拉取成功 → 逐服务 `up -d`（无 `--remove-orphans`；每次 up 前重新核验 compose 归属**与项目/环境绑定**，拉取窗口内绑定丢失/损坏/变更即拒绝）→ 全部变更服务健康检查通过 → 提交状态。任何一步失败只恢复本次实际变更的服务，恢复前再次核验绑定与归属，恢复后**重新探测健康**：仍不健康则如实报告 `recovery.succeeded=false`；无声明探针时明确报告"验证跳过"而非"验证通过"。首部署失败的清理只对归属核验通过的本组项目执行 down。未选服务、外部容器与卷保持原状；绝不 `compose down` 全组、全局 prune 或删卷。
6. 首次部署失败且无旧快照：明确报告实际清理范围（只移除本次启动的服务项目），不假报"已回到旧版本"。
7. 数据库迁移与恢复不在本能力内：应用镜像回退不等于数据库回退，也不证明 schema 兼容。

## 生命周期

- 多服务构建复用同一动态构建机预算（构建+推送每服务 ×2 + 15 分钟余量），成功、失败、超时都会主动释放；**用户 Ctrl-C（SIGINT/SIGTERM）触发有界主动释放**（约 10 秒预算，无论 keep 配置——keep 只作用于正常完成），释放失败如实提示人工核验，不假报已销毁；进程被强杀仍由云端定时销毁兜底。
- 镜像 GC（`ship gc`）同时理解 v1 单应用与 v2 组：保护双方当前/上一版本及**所有保留组合快照**里的全部镜像（含继承与回滚来源），坏快照或布局标记损坏时拒绝计算可删除集（fail-closed），不做全局 prune。
- 部署成功但构建机释放失败：两者**分别报告**——发布 JSON 里的 `build.builderRelease: {"builderRelease":"failed",...}` 与告警日志标明待清理，运行中的应用不受影响、不会被回滚，也不假报资源已释放。
- `ship builder down` / `ship builder status` 照常可用。

## 验收边界（截至 2026-10-05）

- 已验证（2026-10-05 修复轮后）：单元/集成全量（含 R01–R12 回归：恢复归属/绑定复核、恢复后再健康、digest/arch 门槛、GC v1+v2、信号取消、命名卷渲染、混合 keep-env、新服务拒绝、计划一致性）+ 本机真实 Docker 隔离多轮发布（全量 → 只发 api → 坏探针故障恢复 → 回滚；未选服务容器 ID 与 StartedAt 不变、外部命名卷数据保留且不重建、混合 keep-env、新增未选服务在构建前拒绝、清理后零残留）。脚本：`node scripts/e2e-multi-docker.mjs`（辅助模块 `e2e-multi-docker-lib.mjs`）。
- 本机真实 Docker e2e 的边界：构建机 Docker daemon 的注册表流量走系统代理，本机无法起可用本地 registry，因此该脚本用本地 daemon 的 digest 固定镜像直接部署；推送/拉取顺序语义由单元测试与既有云上动态构建机全链路证据覆盖。
- 待用户明确恢复后执行（不计入本轮交付）：MS-06 真实 TWGG 首次接管/再次全量/只发 admin/回滚/H5 页面与数据保留验收；MS-05 真实 CVM 主动删除与定时销毁回读。

## 声明式依赖与尚未交付的契约

- `dependsOn` 已支持：规格层校验（引用存在、不自依、不重复），`ship release --plan` 在 `constraints.declaredDependencies` 中列出；选择不会被静默扩大——缺关联服务时提示所需集合，由操作者显式加入。
- **联动探针（跨服务调用级验证）未实现（TODO）**：当前健康检查只覆盖单服务自身探针；"backend 起来后 admin 能调通它"这类跨服务联动测试尚无规格字段与执行路径，不宣称已实现。
- **同机多环境并存未实现（TODO，保留拒绝）**：同一 agent 上同一组名只能服务一个环境（绑定拒绝 prod/staging 并存）；按 (项目,环境,服务) 派生目录与 compose 项目的并存命名扩展保留为后续工作。

## 给其他项目（deyi、Devpilot 等）

不要复制发布脚本：把服务写进各自的 `ship.yaml`（见上方规格），运行端配置同一套 agent 即可。专用脚本只应保留一次性的首次接管迁移（显式绑定核对），后续发布一律走本协议。
