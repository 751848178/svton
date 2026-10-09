# Shipkit 15 项问题逐项验收

日期：2026-10-08。状态：15 项处理与逐项验收通过。

浏览器验收由根代理在真实本机平台执行，使用 TWGG 已完成任务 `cmuzi71n00004x84w03xr4xtu`，迁移后的发布版本为 `0.0.2`。验收回看保存的选择、计划、执行、结果及运行端历史；未再次发布业务。

## 逐项结果

| 编号 | 最终处理与验收观察 | 证据 |
| --- | --- | --- |
| 1 | 回滚弹窗默认省略长镜像引用；点击展开全文并复制精确值，弹窗宽度保持稳定。 | [桌面回滚](platform-ui-refinement/rollback-desktop.png)、[移动回滚](platform-ui-refinement/rollback-mobile.png) |
| 2 | 任务归档镜像与当前服务镜像共用紧凑预览、展开、复制交互；摘要完整保留。 | [桌面结果](platform-ui-refinement/result-desktop.png)、[390px](platform-ui-refinement/result-390.png)、[320px](platform-ui-refinement/result-320.png)、[768px](platform-ui-refinement/result-768.png) |
| 3 | 服务和整体健康检查使用统一标签列与状态列，与任务结果、取消、恢复及资源状态对齐。 | [健康检查](platform-ui-refinement/health-desktop.png) |
| 4 | 创建构建机日志的正文独立呈现；移除空的「日志」标签，状态和阶段证据有各自清晰区域。 | [创建构建机日志](platform-ui-refinement/log-provision.png) |
| 5 | 修正选择器全局选中背景与文字颜色；日志服务筛选和配置目标筛选均可读，键盘选择可用。 | [日志筛选](platform-ui-refinement/log-service-selected.png)、[目标选中](platform-ui-refinement/settings-selected.png) |
| 6 | 使用 Anser 解析 ANSI，并按 BuildKit 阶段、缓存、完成、警告和错误做语义上色；原始日志仍可读取。 | [构建日志](platform-ui-refinement/log-build.png)、[移动日志](platform-ui-refinement/log-mobile.png) |
| 7 | 六个阶段统一使用日志正文、阶段状态、检查结果和排障数据；重复轮询、游标及无内容事件不再逐条占位。空 JSON 不计为证据；真实健康检查保留三个服务终态，只展示实际保存的整体 `passed` 结果。 | [构建日志](platform-ui-refinement/log-build.png)、[创建日志](platform-ui-refinement/log-provision.png)、[健康检查日志](platform-ui-refinement/log-verify.png)、[检查证据](platform-ui-refinement/health-evidence.png) |
| 8 | 完成任务的选择服务、核对计划可点击回看，保持原任务 ID；页面无编辑输入或执行命令，仅读取保存计划。开始新发布进入独立流程。 | [只读服务范围](platform-ui-refinement/selection-readonly.png)、[只读计划](platform-ui-refinement/plan-readonly.png) |
| 9 | 版本号按项目持久化，默认下一修订号，也可填写 `1.0.0`；失败任务占用独立版本。TWGG 首轮失败为 `0.0.1`，已完成任务为 `0.0.2`，下一默认值 `0.0.3`。 | [版本记录](platform-ui-refinement/history-desktop.png)、[下一版本](platform-ui-refinement/new-version.png) |
| 10 | 平台发布任务为主表；运行 Agent 的实际变更和回滚快照作为默认折叠的补充。已载入任务可关联版本，其余标为「未关联任务」；首次变更显示「无旧快照」并禁用回滚。 | [默认历史](platform-ui-refinement/history-desktop.png)、[展开运行端历史](platform-ui-refinement/history-expanded.png)、[移动历史](platform-ui-refinement/history-mobile.png) |
| 11 | 任务详情标题直接显示 `0.0.2`；项目名、发布记录和返回关系由面包屑承担，不再把项目名和斜杠重复放进标题。 | [结果标题](platform-ui-refinement/result-desktop.png)、[计划标题](platform-ui-refinement/plan-readonly.png) |
| 12 | 项目详情、发布记录和任务详情都属于项目子页面；主导航只保留「项目」，提供明确的面包屑及返回父页面动作。 | [历史导航](platform-ui-refinement/history-desktop.png)、[移动导航](platform-ui-refinement/nav-mobile.png) |
| 13 | 连接页明确当前选中的部署目标及可选目标数量。TWGG 当前为一个 `prod` 目标；Agent 的 `127.0.0.1:17410` 是连接端点，可通过 SSH 隧道到运行服务器，临时构建机单独说明。 | [当前项目连接](platform-ui-refinement/settings-desktop.png) |
| 14 | 连接与配置从项目详情头部进入，显示项目范围与返回项目详情动作；移除系统管理导航分类下的项目配置入口。 | [配置页面](platform-ui-refinement/settings-desktop.png)、[移动配置](platform-ui-refinement/settings-mobile.png) |
| 15 | 明示名称、服务入口 URL 是手工维护的显示信息；目标、服务标识、Agent 地址、构建规格及镜像仓库从项目配置读取。已有目标选择不创建云资源，入口填写不自动配置 DNS 或代理。 | [元数据来源](platform-ui-refinement/metadata-desktop.png)、[目标选择](platform-ui-refinement/settings-selected.png) |

## 交互与回归检查

- 已完成任务的四个步骤均可回看；历史服务和镜像不以当前 live 数据替代保存计划。旧计划缺少源码来源或镜像证据时明确显示未记录。
- 历史任务加载前和恢复后均禁止生成计划、启动发布及修改版本。新流程生成的计划保留已核对版本；项目下一版本刷新只更新尚未编辑、尚未生成计划的默认输入。
- 配置检查结果按项目、配置路径和目标隔离；切换目标时清理旧结果，延迟返回的旧目标结果与错误不会冒充当前检查。
- 运行端首次变更不会误匹配 `remoteReleaseId=null` 的失败任务。真实远端 ID 可关联平台版本，未知 ID 保留原标识并显示未关联。
- 下拉选中、键盘操作和移动导航已检查；320、390、768px 的结果页及移动端历史、回滚、配置、日志页面保留可读布局。

## 自动检查

| 检查 | 结果与实际证据位置 |
| --- | --- |
| Web 测试 | 33/33；包含历史只读、版本输入刷新、配置检查范围、运行端版本关联及空证据过滤的回归。最新全量日志：`/tmp/codex-tool-runs/svton/platform-ui-refinement/evidence-tests.log`。 |
| API 测试 | 6/6；覆盖版本分配、幂等、并发和迁移。日志：`/tmp/codex-tool-runs/svton/release-version-api-tests.log`。 |
| 类型与构建 | Web 类型检查、Web 构建、API 构建通过；日志位于 `/tmp/codex-tool-runs/svton/platform-ui-refinement/`。 |
| 设计与结构 | Impeccable 检测结果 `[]`；两应用 `src` 下 89 个 TS、TSX、CSS 文件均不超过 200 行。 |
| 真实版本迁移 | 一致性备份后迁移；平台 SQLite 的 13 张表原有字段和行摘要保持，integrity 为 `ok`，外键错误为 0。 |
| 任务与资源边界 | 23 个任务、24 个计划，活动任务为 0；本轮未创建新发布任务、回滚任务或 CVM。 |

Web 回归目录：`apps/shipkit-web/test/`；新增 `release-controller.test.mjs`、`release-review.test.mjs`、`runtime-history.test.mjs` 及日志展示相关测试。API 回归目录：`apps/shipkit-api/src/tasks/`。独立阶段日志保存在 `/tmp/codex-tool-runs/svton/platform-ui/`；主验收、浏览器观察、迁移和构建日志保存在 `/tmp/codex-tool-runs/svton/platform-ui-refinement/`。

真实迁移证明：`/tmp/codex-tool-runs/svton/platform-ui-refinement/db-migration-verification.json`。浏览器观察记录包括 `browser-readonly.json`、`browser-history.json`、`browser-settings.json`、`browser-other-logs.json`、`browser-select-colors.json`、`browser-responsive.json` 和最终空证据过滤后的 `browser-final-health.json`。最终 Web 构建日志为同目录 `web-build-final.log`（exit 0），重启后 Web 与 API 均返回 200。

## 已有配置检查结果

真实配置检查仍报告 backend 环境文件引用缺失，属于既有项目配置。已完成的真实发布采用 `keepEnv=true` 保留运行端环境，服务当前健康。此轮 UI 验收通过不代表所有项目配置检查都通过；未为消除此提示修改业务配置或重新发布。

最终视觉检查通过：根代理实际查看了桌面结果、健康列、只读步骤、历史、回滚、日志和配置截图，以及 320/390/768px 结果页和 390px 回滚、导航、配置、日志截图。最终重启后健康面板只显示一条已保存的整体检查结果，三个服务完成状态仍分别保留；浏览器停留在 TWGG `0.0.2` 结果页。

设计上下文记录仍使用旧格式，可另行使用 `impeccable init` 整理；本轮沿用既有界面并完成上述修复。
