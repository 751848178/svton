# 多服务规划与当前代码提交基线

日期：2026-10-04。目的：保存当前单服务工具链与TWGG适配代码，交付多服务/选择性发布规划和续接提示词；没有实施这些新增功能，也没有恢复生产部署。

## 提交范围

- svton：`shipkit/` 当前全部相关源码、安装器模板/生成安装脚本、测试、用户文档、分阶段审计及本轮规划。
- TWGG：`.gitignore`、`apps/mobile/config/index.ts`、`apps/mobile/nginx.conf`、`scripts/shipkit/`。
- svton中Devpilot/UI等其他任务改动保留。开始时全仓671项status记录，其中103项位于Shipkit（未跟踪目录记录展开后文件更多）。
- dist、pack、node_modules、.pack-stage、临时测试输出、私有凭据、部署备份和未合并的tmp r2草稿不进入提交。
- `e2e/fixtures/tls` 的三个私钥是本机测试证书，subject为测试CA/127.0.0.1，受 `http-ca.test.ts` 使用；不是已部署服务器证书。

## 本轮结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `pnpm --filter shipkit test` | exit 0；317/317；installer 17/17；包含tsc和生成安装脚本一致性检查 | `/tmp/codex-tool-runs/svton/shipkit-baseline-test-verified-20261004-234423.log` |
| `pnpm run smoke:package`（shipkit目录） | exit 0；仓库外隔离安装及包内50项部署隔离回归通过 | `/tmp/codex-tool-runs/svton/shipkit-package-smoke-baseline-20261004-234523.log` |
| TWGG构建脚本mock（明确复制当前repo脚本） | exit 0；12/12 | `/tmp/codex-tool-runs/svton/commit-plan/twgg-build-mocks-final.log` |
| TWGG Compose mock（明确import当前repo模块） | exit 0；18/18 | `/tmp/codex-tool-runs/svton/commit-plan/twgg-compose-mocks-final.log` |
| TWGG Bash/Python静态检查 | 3个Bash入口与5个Python模块均通过 | `/tmp/codex-tool-runs/svton/commit-plan/twgg-syntax-checks.json` |
| TWGG React解析与Nginx契约 | React 24项、路由9项断言通过；本轮未运行真实Nginx | `/tmp/codex-tool-runs/svton/commit-plan/twgg-react-alias.log`、`twgg-nginx.log` |
| 当前实际私有凭据与候选提交内容交叉检查 | 207个候选文件、4个秘密值，0处匹配；后续暂存前再次检查 | `/tmp/codex-tool-runs/svton/commit-plan/current-credential-match-scan.json` |
| `git diff --check` | 两仓相关范围exit 0 | 本轮工具结果与暂存前复验 |

TWGG检查使用的当前源码摘要见 `/tmp/codex-tool-runs/svton/commit-plan/twgg-current-source-hashes.json`。临时mock是本轮验证工装，不作为原生多服务能力或生产验收证据；后续实现应在仓库建立对应持久回归。

## 提交前发现与处置

- 初次全套检查在 `file-lock.test.ts` 活持有者用例失败，随后因为fixture未释放持有者而不退出；第二次在 `file-lock-race.test.ts` s5发现同类问题。两次各316/317通过，最终仅结束本次命令所创建的挂起测试子进程取得结果，未结束其他用户进程。
- 原用例依赖150ms固定等待，并要求300ms超时一定带 `is alive` 诊断；在其他测试进程争用注册表时，可以安全超时且没有取得该诊断。
- 两个用例改为等到真实进入持有者段后才启动等待者；断言超时、等待者回调从未执行、原持有者token未变化；finally释放持有者，确保断言失败也能退出。
- 本轮额外修复只涉及两个测试fixture，不改变TCP锁运行协议。调用链已按源码确认：测试→withFileLock/heldToken→claimPort/probeBanner；其余生产源码为此前修复基线。
- 源码结构检查继续遵循200行标准；既有test文件按技能明确的测试豁免处理，没有新增运行职责或依赖环。
- 最终完整检查317/317通过，包外安装检查通过；早期失败日志保留：`shipkit-baseline-test-20261004-232026.log`、`shipkit-baseline-test-final-20261004-233814.log`。
- 新手方案及M2处置记录增加当前状态摘要，旧审计历史保持不变；runtime/TCR早期保留密码记录链接到后续真实状态。

## 已完成事实与未完成门槛

- 原生Shipkit仍是单镜像/单服务；新增 `--services`、`--plan` 和v2规格仅在规划中，没有可执行实现。
- TWGG r1已完成真实三镜像构建/推送/部署。业务表值和权限关系未变，既有seed刷新四表时间字段；不能称数据字节完全一致。
- H5 React修复已保存源码，未完成r2部署与页面验收；Compose专用适配仍仅适用首次基线。
- 本机原生动态模板仍有占位项，之前云机操作是专用流程，不能宣称当前直接 `ship release` 已接管TWGG。
- 2026-10-04 23:07（北京时间）云端回读确认临时实例 `ins-0w34bd50`、`ins-ik6ays6c` 及其专属安全组均不存在；证据 `/tmp/codex-tool-runs/svton/twgg-release/instance-release-verification.json`。本轮未再创建云资源。
- 当前线上运行服务器与部署保持原状。真实多服务、选择性发布、H5、数据库兼容及云费用生命周期验收，在用户明确恢复后另行执行。

## 续接入口

- 规划：`docs/plans/multi-service-release.md`。
- 进度：`docs/todos/2026-10-04-multi-service-release.md`，从MS-01开始。
- 可直接复制的实现提示词：`docs/handoffs/2026-10-04-multi-service-release.md`。
- handoff技能确认当前长会话适合切片；新实现任务只需以上材料和Git基线，不必重读历史对话或原始日志。未自动创建新任务。
