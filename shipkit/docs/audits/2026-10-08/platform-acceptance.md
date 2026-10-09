# Shipkit 平台 MVP 验收

2026-10-08，svton 本机工作区。正式入口 http://127.0.0.1:8769，API 127.0.0.1:8770；标准 `pnpm shipkit:start` 已完成完整构建、迁移、就绪检查，前后端保持运行。原型 8768 及其文件保持原样。

早间运行状态复核：上一轮终端中的平台与隔离Agent进程已退出，日志没有捕获明确退出原因。已使用当前用户launchd后台托管恢复；新平台supervisor与Agent helper父进程均为1，8769/8770/19741返回HTTP200，独立子代理重复确认。当前登录会话内keepalive托管不依赖对话终端，数据库和归档保持。该恢复没有启动新发布或改变业务容器。操作记录见 [service-recovery.json](service-recovery.json)。

## 实现与证据

| 范围 | 实际验收 |
|---|---|
| 项目与配置 | SQLite 注册、本机目录/私密配置引用、Git branch/commit/dirty、Agent/Docker/version、服务版本及显示元数据，准确区分声明/配置与执行验证 |
| 全量/部分/重复发布 | 独立 Docker Agent 19741、Registry 19555、API 19901、Web 19902；实际 build/push/deploy/HTTP 内容断言；未选服务继承；每次明确启动创建独立任务 |
| 历史回滚 | 选择历史变更，恢复该变更的 parent 对应服务；当前基线携带锁校验；实际网页从 api-v3 恢复 api-v1，web 保持；缺快照与范围外服务分别 HTTP409/400 |
| 并发及输入 | 当前任务 HTTP409 门禁；旧基线与计划后输入变化在创建构建机前拒绝；首次部分部署 HTTP400；计划过期和身份/目标边界集成测试 |
| 取消 | 实际构建取消与运行端探针期间取消得到 Agent 确认，运行基线保留/恢复；提交区不可取消协议回归；首次部署取消撤下全组容器并保留外部数据 |
| 故障恢复 | 探针失败恢复旧版；删除测试专属网络导致真实恢复失败，任务记录 recovery failed；恢复网络后修复发布成功 |
| 日志与资源 | fsync 日志及 DB 游标；终态全部 log/event 页归档；归档失败保留动态机；SDK 模拟取消覆盖保留窗口、释放失败独立结果、实际租约保护和重试归档前置 |
| 重启 | 运行端执行中关闭平台，删除该隔离任务 runtime 映射；重启通过 operation ID 找回，both Agent 角色正确，健康检查成功，终态日志和原历史保留 |
| 探针状态 | 新 Agent 持久逐服务 succeeded/skipped/failed probe；最终真实 partial release 的 verify/api 和 verify整体均 succeeded；兼容旧归档的整体明确终态证据 |
| 桌面/手机 | 同一 Ego 空间 46，1440px/390px；计划手动开始、四步切换、手动结果、重复发布、历史回滚、阶段/服务日志、Select键盘、原生入口、标题返回、手机Drawer/Esc、刷新保留taskID |
| 身份与私密值 | 固定本机 Actor/Workspace、真实 FK、可替换 policy、来源/Host/JSON 写边界；20 个真实任务、424 个响应、40页事件、105,273日志字节私密候选扫描零泄露 |

未操作 TWGG/deyi/CRM/Devpilot 业务容器，未更改生产配置、密码或已安装 Agent，未创建收费云实例，未 push/merge。隔离网络/卷的哨兵数据在发布、回滚、取消和恢复失败后仍存在。

## 可复核资料

- [核心七项](platform-api-evidence.json)：注册、首次全量约束、真实全量/部分/重复发布、历史父快照恢复、持久日志。
- [六项故障边界](platform-fault-evidence.json)：并发、输入改变、构建取消、失败恢复、运行端取消、跳过探针/外部数据。
- [真实恢复失败及修复](platform-recovery-evidence.json)。第三项计划拒绝在旧 API 上曾返回不准确 422，已修复并单独验证 HTTP409/400，见下方完整日志路径。
- [控制平台重启与丢失映射](platform-restart-evidence.json)。
- [首次部署取消](platform-first-cancel-evidence.json)：独立 app、两个容器全部撤下、current null、只读外部卷数据保留。
- [最终逐服务健康证据](platform-final-probe-evidence.json)。
- [私密响应审计](platform-api-secret-audit.json)：仅命中计数，未保存候选值。
- [桌面详情](screenshots/platform-desktop-detail.png)、[计划](screenshots/platform-desktop-plan.png)、[日志](screenshots/platform-desktop-log.png)、[结果](screenshots/platform-desktop-result.png)、[手机导航](screenshots/platform-mobile-navigation.png)、[手机日志](screenshots/platform-mobile-log.png)。最终状态复查见 [browser-evidence.json](browser-evidence.json)。
- 最终重建后的 [桌面6/6执行页](screenshots/platform-desktop-execution-final.png) 与 [手机6/6执行页](screenshots/platform-mobile-execution-final.png) 已逐张查看。手机宽度/文档宽度同为390；正常终态没有待清理阻塞提示。显示名通过真实表单保存后刷新恢复，运行目标仍为local。

## 回归

| 命令/检查 | 结果 | 完整日志 |
|---|---|---|
| `pnpm --filter shipkit test` | 595/595；包4/4；安装器17/17 | `/tmp/codex-tool-runs/svton/platform-shipkit-final-tests-complete.log` |
| `pnpm --filter @svton/shipkit-api test` | 2/2，真实SQLite/FK/HTTP/策略/持久化/取消/清理边界 | `/tmp/codex-tool-runs/svton/shipkit-api-integration.log` |
| web type-check / test / build | 通过，9/9 | `/tmp/codex-tool-runs/svton/shipkit-web-final-{typecheck,tests,build}.log` |
| cleanup完整归档与拒绝销毁 | 通过，活跃job/未flush/错误租约/配置变化/持久失败拒绝 | `/tmp/codex-tool-runs/svton/shipkit-cleanup-archive-test.log` |
| `pnpm shipkit:start` | 完整构建+迁移+启动，两个端口就绪 | `/tmp/codex-tool-runs/svton/platform-startup-acceptance.log` |
| 历史缺失/越界及首次部分拒绝 | HTTP409 / HTTP400 / HTTP400 | `/tmp/codex-tool-runs/svton/platform-history-rejections.log`、`platform-first-partial-rejection.log` |
| 源文件上限 / diff whitespace | 维护源文件≤200行，通过 | 本次源计数与 `git diff --check` |

早期 Docker 轮次因缺 buildx 插件真实失败，记录保留；补齐隔离 Docker 配置后第5轮核心链通过。默认沙箱测试曾因临时目录/本机端口权限失败，获准后重跑完整套件通过。完整套件曾发现静态 mock provider 不支持额外 status 调用，已限制该调用到动态分支并完成回归。最终绿色结果不覆盖这些早期失败记录。

## 环境边界

云 SDK 模拟证明 provider/租约/预算/取消/归档/释放失败行为；本次没有真实新建或销毁收费云机器。生产已安装 Agent 需人工升级到新的安全协议能力后才能通过平台发布门禁。平台台账可以长期保留，Agent 可回滚快照的保留期仍由 Agent 决定。

归档途中持久写入失败再重试可能重复少量日志行；jobID/原始游标可追溯，已落盘内容不会丢失。该情况拒绝销毁未完成归档的构建机。云本地租约状态缺失时不会宣称实例已清理，需根据云实际状态确认。

命令复制按钮已实现，页面命令已检查 `--services` / `--to` / `--from-dir` 参数。最后的系统剪贴板读回检查期间用户接管 Ego 空间，浏览器操作立即停止，没有换浏览器或夺回控制；剪贴板完全一致的断言未完成，不列为已验证项目。

使用与启动见 [platform-local.md](../../platform-local.md)，数据库模型与API见 [platform-api.md](../../platform-api.md)。
