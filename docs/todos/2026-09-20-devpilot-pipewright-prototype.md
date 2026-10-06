# Pipewright 调研归档与 V3 原型增强

路线：todo-plan。范围：仓库文档 + 既有 V3 可交互原型；不修改生产应用/API，不部署真实环境。

## 执行状态

- [x] done：归档固定版本的 Pipewright 研究、建木对照、证据边界与采用决策，见 `docs-internal/devpilot/research/2026-09-20-pipewright/README.md`。
- [x] done：完成 8 项功能规划、页面映射、技术方案与 S1/S2/S3 验收切片，见 `docs-internal/devpilot/plans/2026-09-20-pipewright-*.md`。
- [x] done：原有 R-1042 详情新增 5 个可交互情景，保留旧流程切换；仅 sessionStorage 模拟。
- [x] done：构建通过、9/9 测试通过、桌面与窄屏交互实看、截图归档。见原型 `evidence/2026-09-20-pipewright/QA.md`。

生产功能仍待按 S1–S3 实施与独立验收；本 TODO 的完成指研究、规划和原型交付。

## 追加：当前应用布局对齐

- [x] done：补我的项目目录，项目首页改为基本信息 → 折叠仓库 → 发布/环境/组件 Tab；配置变 Header 次级入口。
- [x] done：配置保留已有环境和域名入口，部署记录从发布上下文进入；保留 Pipewright 情景。
- [x] done：验证导航、搜索、列配置、Tab、窄屏、构建与回归，更新原型合同。

以当前源码 ProjectsContent / ProjectDirectoryPanel / ProjectWorkbenchHeader / ProjectOverviewContent / ProjectOverviewTabs 为准；旧原型不是布局权威。仍不改生产代码。

## 当前依据与图谱

- 原型：`evaluation/design/devpilot-design-system-v3/prototype/`，使用原有 AppShell / ReleaseDetailFrame / Button / Status / useDialogFocus 和样式。
- 路径：App → ReleaseScreen → 新增发布情景组件 → 纯状态模型；原有入口配置情景继续保留。新状态不调用 API，仅 sessionStorage 保存模拟数据。
- 当前后端已经有 environment-version 的 reconcile / resume / recovery 接口。先研究其适用前置状态，不能把新规划写成需要重建一套发布系统。
- 技术边界：现有 release-delivery 持有领域决策，执行通过现有 Provider；不把 Pipewright Go/Vue 模块直接引入 NestJS/React。
- 不新增全局一级导航，不改变真实应用，不将原型 fixture 表述为真实生产通过。

## 验收

新制品必须重新预发；刷新后保留模拟待续接运行；重复继续不重复建运行；分批未确认不继续；恢复产生新记录并保留失败记录；部署成功与入口验证成功分离；原有页面仍可达。桌面和窄屏实看，所有新增源文件不超过 200 行。
