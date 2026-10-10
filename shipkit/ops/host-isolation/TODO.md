# 临时主机限定隔离

Routing: todo-plan；只拥有 `ops/host-isolation/**` 和 container README 专节。

目标：Docker 26 上保护 Shipkit loopback 发布端口与专用 Agent；guard 失败只阻止
Shipkit 启动，不阻止 Docker/TWGG。未经根任务部署授权，不写远端主机。

源确认链：base compose/spec → override/spec generator → external bridge；
systemd guard → 自有 iptables chains → Server/Agent 启动检查。
v2 renderer 已支持 external networks；核心 worker 负责 restartPolicy。

- [x] done：配置校验、自有防火墙规则、冻结 ownership receipt、限定 systemd units。
- [x] done：复用 base 的 override 与临时 spec 生成；compiled spec validator/renderer 通过，base 保留且拒绝覆盖。
- [x] done：21 条纯 mock tests；启动前置失败无 firewall 写入；源码 <=200 行。
- [x] done：opt-in synthetic systemd QA 脚本与纯安全测试；独立 review 无阻断。
- [x] done：安装文档与模块交接；不提交、不远程运行 QA/服务。
- [ ] pending：目标 Compose 2.27.0 的实际合并结果与实际容器 HostConfig。
- [ ] pending：独立 VM 的 L2/DNAT/direct-route、真正 boot/restart 故障 schedule。

接受边界：规则只命中新 CIDR 或 gateway 专用 Agent 端口；不改全局 FORWARD
策略，不 flush Docker/其他规则，不改 docker.service，不重启真实 Docker。
Server on-failure:3；自身 unit Requires/After guard，Docker不依赖guard。
代理目录/凭据分离不等于项目权限沙箱；Runtime 安装、接管与真正自升级由根任务完成。

本地共享内核 privileged systemd fixture 曾触发 systemd-binfmt 清空注册的行为，
已停止并删除 fixture 容器、镜像及源码；不使用其结果作为通过证据，不自行全局修复。
替代 QA 只建随机自有 marker units，真实 Docker 只读；尚未在目标执行。
纯测试日志：`/tmp/codex-tool-runs/svton/self-hosting/host-isolation/unit.log`。
派生 spec 日志：`/tmp/codex-tool-runs/svton/self-hosting/host-isolation/derived-spec.log`。
