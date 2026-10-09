# Shipkit 平台运行托管与数据恢复

正式版本基线已冻结为 `shipkit/0.0.1`（`0d46cb90`）。该标签保存加固前基线；外部部署必须选择包含后续依赖与登录加固的固定提交及其锁文件。部署时使用选定的固定提交与锁文件；先构建，再让长期服务运行 `platform-start.mjs --production --reuse-build`。代码、持久数据和私密配置分目录保存，升级代码不搬动数据目录。

## Linux 托管

可移植示例位于 [ops/README.md](../ops/README.md)：

- [systemd 服务](../ops/shipkit-platform.service.example)：显式账户、工作目录、Node/pnpm 路径、私密 EnvironmentFile，失败重启、重启限速和本地进程组停止。
- [环境变量示例](../ops/platform.env.example)：`SHIPKIT_DATA_DIR`、同目录绝对 SQLite `DATABASE_URL` 与 HTTPS `SHIPKIT_PUBLIC_ORIGIN`。
- [Nginx HTTPS 示例](../ops/nginx-https.conf.example)：用户提供域名和已有证书，只代理 Web loopback 8769；API 8770 不直接公开。

这些示例不会安装或启用服务、签发证书、修改目标机器、读取真实凭据或创建云资源。当前平台与备份工具共同使用数据目录内 `.ops.lock` 独占维护锁；启动器持有至子进程退出，备份持有至完整结束。旧锁不能自动删除，需要先确认原服务与记录 PID 已停止。平台停机不会停止 Agent 的远端发布；先完成或协作取消任务，未知远端状态应先恢复平台核对，不能当作已停止。

实际部署仍需确定：Linux 主机/发行版、SSH 与服务账户、代码和数据目录、Node/pnpm 路径、域名/TLS、私密配置引用、备份位置及保留周期。配置示例中的占位符必须替换后才能使用。

## 离线备份与恢复

工具使用 Python 3.9+ 标准库 SQLite backup API，不增加第三方依赖。命令见 [ops/README.md](../ops/README.md)。数据布局要求 `DATA/platform.db` 与 `DATA/logs/` 同根；外置 `DATABASE_URL` 不在此最小工具支持范围内。

用户先停止平台服务。备份拒绝活 PID、现存服务/维护锁、活跃或未解决任务、清理进行中、符号链接、数据库与日志索引/字节不符；输出必须是源目录之外的新目录。备份包含全部数据库台账、全部归档任务日志和进程日志，生成 SHA256 清单。不按天删除归档任务日志。

校验同时检查 SHA256、完整文件集合、SQLite 完整性/外键、日志索引与字节。恢复只创建新的不存在目录，前后各校验一次；不覆盖现有数据，不自动切换 live，不执行迁移或启动服务。现有空目录也会被拒绝。实际切换前保留原目录与匹配代码版本，明确调整 EnvironmentFile 的数据路径；失败可回到原目录。

恢复先完整校验原备份，再仅删除新恢复目录中的全部 `AuthSession`，重新生成 SHA256 清单并再次校验。恢复后所有用户必须重新登录，避免旧备份重新激活已经登出的 cookie；旧版本没有此表时跳过。源备份保持不变，task/log/audit 等业务记录不受此清理影响。

备份不包含项目源码及其绝对目录、引用的配置/环境/凭据文件、TLS/SSH、外部云租约文件、Agent 数据及回滚快照、业务数据库/卷。分别保存这些恢复依赖；平台台账恢复不会重建已过期的远端回滚快照，也不会回滚业务数据。保留策略、异地副本和实际主机恢复演练由部署方案另行安排。

隔离测试覆盖 SQLite/日志恢复一致、损坏拒绝、活 PID/活任务拒绝、路径逃逸、日志不一致和现有目录保护；运行 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s shipkit/ops -p 'test_*.py'`。测试不读取 live 数据或调用 Agent/云 API。
