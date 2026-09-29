# 固定运行机的 TLS 接入（Caddy）

目的：agent 不直接暴露公网明文 HTTP；API、安装脚本与 bundle 下载全部走 HTTPS。

## 步骤（在运行服务器上）

1. 安装 agent 时限制监听：`AGENT_BIND=127.0.0.1`（`bootstrap/install.sh` 支持）
2. 安装 Caddy（官方 apt/yum 源），复制 `Caddyfile.tmpl` 为 `/etc/caddy/Caddyfile`，
   替换 `__SHIP_DOMAIN__`（解析到本机）与 `__AGENT_PORT__`（默认 7410），`systemctl reload caddy`
3. 安全组：**删除 7410 的公网入站**，仅放行 80/443（ACME 与业务）
4. 控制器配置使用 `https://__SHIP_DOMAIN__` 作为 target url；`ship doctor` 验证鉴权与角色

## 引导分发（serve-bundle 走 HTTPS）

`Caddyfile.bundle.tmpl`：把 `https://__SHIP_HOST__/__BUNDLE_TOKEN__/...` 反代到 serve-bundle 的
本地监听 `127.0.0.1:7411`；控制器配置 `bundleBaseUrl: https://__SHIP_HOST__` 后，动态构建机的
cloud-init 引导全程走 HTTPS（安装脚本 + agent 包），且 URL 中的 token 路径同时充当访问门槛。

控制器本机无公网入站时，将 bundle 由带 TLS 的反代/对象存储分发：
`ship.config.yaml` → `builder.dynamic.tencent.bundleBaseUrl: https://<你的分发域名>`，
或直接 `installUrl: https://<分发域名>/install.sh` + `installToken`。

## 边界

- 本模板为代码交付；真实域名/DNS/证书链路属于环境输入，**未经真实环境验收前 F09 保持未验收状态**
- 证书说明（2026-09 更正）："公网 CA 不为 IP 签发证书"的说法已过时——Let's Encrypt 自 2025-07 起提供短期 IP 地址证书。命名入口仍是默认推荐（身份可控、续期稳定、客户端兼容性最好），但 https + IP 证书是合法组合
- 证书校验不可关闭；curl/Node 默认校验保持开启
