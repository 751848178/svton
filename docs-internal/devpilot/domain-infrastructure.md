# 域：基础设施

> 功能域目标与进度文档。基于实际代码梳理。

## 域目标

管理服务器接入、反向代理配置、CDN 配置与域名/Nginx 配置生成。

## 功能清单

- 服务器列表与详情（`servers`、`servers/[id]`）
- 代理配置（`proxy-configs`、`proxy-configs/[id]`）
- CDN 与 CDN 配置（`cdn`、`cdn-configs`、`cdn-configs/[id]`）
- 域名/Nginx 配置生成（`domain`）

## 架构与数据流

```
domain 页（已迁移样板）
  → useDomainConfig hook（useSetState 管理配置对象）
  → api.get/post('/domain/validate' | '/domain/nginx-config' | '/domain/certbot-script')
  → downloadTextFile 触发文件下载

servers 页
  → 服务器 CRUD + SSH 凭证管理（含 modal）
  → 341 行，需拆 hook + modal 组件
```

## 关键文件

- `(dashboard)/domain/` — ✅ 已迁移（types/hooks(useSetState)/utils）
- `components/ui/modal.tsx` — @svton/ui Modal 归一化封装（解决 React 19 TS2786）

## 当前进度

| 项 | 状态 |
|---|---|
| domain 页端到端拆分（useSetState） | ✅ |
| Modal 类型归一化封装 | ✅ |
| servers / servers[id] | ⏳ 待迁移（含 modal） |
| proxy-configs / proxy-configs[id] | ⏳ 待迁移 |
| cdn / cdn-configs / cdn-configs[id] | ⏳ 待迁移 |

## 遗留项

- servers/proxy-configs/cdn-configs 均含手写 modal，需替换为 `@svton/ui` Modal（经 components/ui/modal 封装）。
- 服务器 SSH 凭证属敏感数据，迁移时确认不写日志。
