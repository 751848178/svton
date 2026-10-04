# 本机控制端安装与配置

路线：todo-plan。用户授权复核后安装本机控制端，并复用 ZCode 之前用于 Shipkit 的腾讯云凭据。保留现有工作区修改；本轮不创建云机器或执行真实部署。

- [done] 安装前复核：修复状态提交失败恢复及分发端口误用；317/317 全套、17/17 安装器、50/50 包内回归、20 项冒烟通过，重新打包并校验字节一致。
- [done] 用户目录安装独立 CLI；复用 ZCode Shipkit 实测凭据，通过只读云 API 验证，文件权限 0600，不输出密钥。
- [done] 仓库外最小环境、AI 调用路径和新登录 shell 验证通过；doctor 准确提示缺部署配置。模板已创建，剩余事项记录在 local-controller-install.md。

证据目录：`/tmp/codex-tool-runs/svton/local-install/`。
