# 多服务与选择性发布实现证据（2026-10-05）

目的：记录 MS-01–MS-05（本地可验证部分）与 MS-07 的实现、命令、退出码和证据位置；明确仍未验收的真实环境门槛。全程未创建云实例、未修改生产容器/网络/卷、未执行数据库迁移。

## 命令与退出码

| 检查 | 命令 | 退出码 | 结果 | 日志 |
| --- | --- | --- | --- | --- |
| 类型检查/编译 | `npx tsc -p tsconfig.json --noEmit` / `npm run build` | 0 | 全部源文件 ≤200 行（拆分 group-store→group-snapshots/group-store-types 后最大 196） | `/tmp/codex-tool-runs/svton/multiservice/build4.log` |
| 全量测试 | `pnpm test` | 0 | 372/372（基线 317 + 本轮新增 55：spec-v2 12、selection 4、plan 6、group-store 6、group-deploy 12、group-rollback 5、multi-build 7、lifecycle 4、multi-isolation 1 等） | `regression-final2.log` |
| 包冒烟 | `pnpm run smoke:package` | 0 | all checks passed（仓库外隔离安装 + 既有部署隔离回归） | `smoke-final.log` |
| 示例校验 | `loadSpecAnyFile(examples/demo-multi/ship.yaml)` | 0 | version 2，web+api 两服务 | （内联输出） |
| 真实 Docker 隔离 e2e | `node scripts/e2e-multi-docker.mjs` | 0 | E2E PASSED（19 项断言全过，清理后零残留容器/网络） | `e2e-docker-final.log`（复跑 `e2e-docker-run10.log` 同绿） |

日志目录：`/tmp/codex-tool-runs/svton/multiservice/`（regression-run1/2 为过程中的中间失败记录，保留备查）。

## 真实 Docker e2e 覆盖（scripts/e2e-multi-docker.mjs）

1. 非法 `--services` 经真实 CLI exit 2 拒绝（任何构建前）；`--plan --json` 只读输出。
2. 全量发布：两服务真实 `docker build --target prod --platform linux/arm64`（arch 实际校验）、逐服务 compose 项目 `ship_<组>_<服务>` 激活、HTTP 健康检查返回各服务 PROD 内容（证明 target 生效）。
3. 外部网络核验并挂载；声明 envFile 私有落盘 runtime.env（manifest 无内容）。
4. 部分发布（只发 api）：web 容器 **ID 与 StartedAt 不变**（真实验证未选服务不重启）；api 重建且内容更新、digest 变化。
5. 真实 CLI 回滚：仅撤销最近 changedServices（api 恢复 v1 内容），web 容器仍不变。

边界：本机 daemon 注册表流量走系统代理导致本地 registry 不可用，该脚本不覆盖推/拉 registry 环节（digest 固定语义通过本地镜像 ID 固定实现）；推拉顺序与失败语义由 `group-deploy.test.ts`（拉取失败零切换等）与既有云上动态构建机全链路证据覆盖。

## 关键故障注入证据（dist 测试，372 内）

- 拉取第二批失败 → 零 up；健康检查失败 → 仅变更服务恢复到前组合镜像；up 失败 → 已启动项目窄清理（首部署）或恢复；状态提交失败（目录只读注入）→ 恢复变更服务且 state 不变。
- 拉取窗口被同名容器抢占 → 切换拒绝且恢复不触碰外来资源（v2 复刻 v1 保护）。
- 并发两个部分发布（Promise.all 经组锁）→ 最终组合同时含两者更新。
- 回滚：过期 baseReleaseId 拒绝；从未一起发布的服务集拒绝；恢复失败时 pre-rollback 组合保持。
- 旧 agent（缺 multi-service-v2 能力）：运行端在构建前拒绝、构建机在提交任何构建前拒绝；动态构建机释放失败与构建成功分报（builderRelease:'failed' 不影响发布结果且明确待清理）。

## 过程中发现并修复的实现缺陷

1. group-state 只读端点曾调用会写 binding 的断言——改为只读 inspect（计划绝不写状态）。
2. up 失败时服务未记入恢复集——登记点移到归属核验后、`compose up` 前（onBeforeUp）。
3. macOS realpath 差异（/var vs /private/var）导致拒绝自家容器——归属比较改用 realpath（v1 同路径受益；真实 Docker e2e 揪出）。
4. group-store 230 行超限——拆出 group-snapshots/group-store-types。

## 待用户明确恢复后验收（不因本地通过而视为交付）

- MS-06 真实 TWGG：首次 v2 接管迁移、再次全量、只发 admin、应用回滚、H5 页面、MySQL/Redis 与非目标容器/卷/数据不变。
- MS-05 真实云门槛：动态 CVM 主动删除、ActionTimer 定时销毁回读、TCR 推拉全链路。
