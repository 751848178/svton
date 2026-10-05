# TWGG 真实生产链路验收（2026-10-05–06）

用户授权恢复真实 TCR/CVM/TWGG 操作、端点升级和应用接管。验收范围是本机控制端 → 按量构建机 → 私有 TCR → 运行端 → 全量/部分发布/回滚。MySQL、Redis、归档和其他项目保留。

状态：完成。本次真实发布链路全部门槛已关闭；证据见 [production-chain-evidence.json](production-chain-evidence.json)。不把该结果扩展成所有业务功能的人验或后续规划已实现。

## 已核实基线与改动

- 运行端 `81.70.201.31`：原 7 容器明确归属。只停止原 TWGG backend/admin/mobile；MySQL、Redis、nginx-proxy-manager、happy-server 保留。旧应用容器仍保留为停止状态。
- 备份目录 `/root/.ship/production-backups/20261005-native/`：数据库一致性转储、Redis、原配置与部署元数据、48 表行数与 9 表校验值；本机私有副本已保存。默认关闭启动 seed，未修改 migration SQL。
- 本机最终 CLI SHA256 `7742d6ba705f82c897a932f0b02e149c0d2f15e163bf37f7f41083da9ffce7da`；agent SHA256 `a7a8da9fe8c2f106c0d32fc81c35927519456f71d11e65710b01bc905ed0642b`。219 个 JS 与当前源码编译产物一致；运行端 221 文件字节验证通过，外部 env/unit/token 与容器不变。
- Shipkit `fcf26690`：100 GiB 云系统盘、真实定时器可见性等待、密码校验/错误脱敏、动态 bundle 根目录布局；`0a7e710e`：异步销毁确认最多 3 分钟，每 5 秒查询，取消补偿仍有限。
- TWGG `d70980a`：默认不 seed、原生三服务规格、私有源排除及一键发布；`a3d0c02`：发布参数边界、只构建干净 HEAD、移除无主本地锁；H5 内容 hash、缓存头、缺失资源 404、Taro rem 与移除调试浮层。
- TWGG `c788de3`：连接入口提示改为 stderr，真实 `--services admin --plan --json` 的 stdout 可整体解析；仅 admin 为 build+deploy，backend/mobile 继承当前版本。先验证旧输出混入提示的失败，再验证修复；本次只改输出通道，无须重建应用镜像。
- 最终 Shipkit `pnpm test`：526 主测试、4 包校验、17 installer 全过；当前包 smoke 通过。TWGG 真实 shell/Git/archive 与启动回归 14/14，H5 真实 Taro 构建两次、产物各 8/8、实际 nginx HTTP 9/9。

## 已完成的真实证据

- 首轮三镜像构建/推送/部署通过，release `muve7m8l-712a0137`，均 linux/amd64 且 archVerified；真实业务只读 15 项 API/代理/资源探针通过，48 表行数及 9 表 checksum 与部署前一致。
- 定时销毁独立验证：`ins-8s9txdyg`，ActionTime `2026-10-05T14:36:53Z`；未调用主动删除，`14:37:10.374Z` 实例和 timer 均已从云端查询消失。
- 首次布局失败构建机 `ins-hzfin8na` 经真实取消补偿主动删除并清账本；首轮成功构建机 `ins-08xnzdam` 已确认删除。旧 6 秒确认误报已修复，云端消失后通过原生 down 清理保留账本。
- TCR 精确 digest 匿名读取拒绝；同一认证流程的官方公开镜像正对照成功。未把初始 401 challenge 当作私有仓库证明。
- H5 首次页面异常核实为旧客户端缓存；手机验收也发现手写 rem 与 Taro 基准不符。a3d0c02 修复已通过真实第二轮部署验收：正常缓存启用，390×844 下根字号 20.8px、标题 22.88px、登录按钮完整可见，交互校验正常、无 React 错误或调试浮层。HTML no-cache、hash JS/CSS immutable、旧/缺失资产 404 均从生产 HTTP 验证。

## 四轮真实验收

| 轮次 | release | 实测结果 |
| --- | --- | --- |
| 首次接管 | `muve7m8l-712a0137` | 三镜像 TCR 构建/推送/拉取/部署，保留数据库、卷与非目标项目 |
| 再次全量 | `muvfhtnl-996bd808` | 最终 wrapper 完全自动创建/引导 builder、三镜像发布及主动释放；无需手动引导 |
| 只发 admin | `muvfs64u-9e458f09` | 仅 admin 构建/推送/替换；backend/mobile 的完整容器元数据不变 |
| admin 回滚 | `muvfv4z8-0c02f385` | 使用 base-release 冲突保护，admin 恢复第二轮 digest；backend/mobile 完整元数据不变 |

四轮均通过 15 项业务/API/代理/资源只读探针、48 表行数和 9 表校验值比对。只发 admin 的镜像摘要确实改变，回滚摘要确实恢复，不以相同镜像重打标签代替回滚证明。

- 全量 builder `ins-6m9tmw9w`、部分 builder `ins-mpnhg79c` 均从云端回读：SA9.2XLARGE16、8 核/16 GiB、100 GiB CLOUD_BSSD、专用安全组、精确定时销毁 UNDO；完成后实例和 timer 均消失、原生 ledger 清空。
- 最终 ap-guangzhou 查询实例为 0、本机 builder ledger 为 0、运行端活动任务为 0；两轮新 SSH bridge 均自动清掉死连接的反向端口。仅用于首次调试的 2 个 root 转发密钥已精确移除，专用 bridge 账户保持可用。
- MySQL、Redis、nginx-proxy-manager、happy-server：与接管前完整容器 ID/StartedAt 一致，R2–R4 挂载和镜像也不变；两个 TWGG 数据卷 CreatedAt 保持 2026-09-25。Redis DBSIZE 仍为 0。
- 最终三个运行镜像均实际检验 linux/amd64、RepoDigest 与组合记录一致；归档 bind 在实际 backend UID100 下可读写，PORT=3000、seed=false。MySQL 转储 gzip 完整性检查通过。
- 最终组合与 R2 相同，版本记录为 `muvfv4z8-0c02f385`；这是对 admin 回滚后的已验证版本，包含 H5 缓存/rem 修复。

## 用户操作

本机已安装 `ship`、两个 SSH 连接入口与私有云/TCR/运行配置。TWGG 工作区先提交代码，执行：

```sh
cd /Users/zhaoxingbo/Workspace/ai-driven/twgg
sh scripts/shipkit/release.sh                 # 全量
sh scripts/shipkit/release.sh --services admin # 只更新管理端
sh scripts/shipkit/release.sh --plan --json    # AI Agent 只读计划
```

回滚无须新建构建机：

```sh
ship-runtime-connect
ship rollback twgg --config .shipkit/ship.config.json --to prod --services admin --json
```

当前入口保留既有 IP/端口：管理端 `http://81.70.201.31:3101`、H5 `http://81.70.201.31:10086`。可选域名/TLS 未收到选择，按已说明的假设保留现有入口；未修改其他项目反向代理。用户现有应用账号密码保持原样；API/工作台认证验收使用短效 180 秒只读会话并已清理，未重置用户密码或提交业务单据。

日志与安全证据目录：`/tmp/codex-tool-runs/svton/production-chain/`。私有凭据、完整 env、临时访问令牌、数据库备份不进入仓库或报告。

联动业务探针与同机多环境是后续独立规划；本次不宣称这些场景已实现。应用镜像回滚不回滚数据库。
