# Devpilot Web Docker Workspace Build

## Goal

让本机 `devpilot-app-web` 能从当前源码独立构建并运行，不再依赖宿主机残留的 workspace `dist`。

## Scope

- In scope: Web Dockerfile 的 workspace 构建闭包、镜像构建、容器替换与 HTTP/SSR 健康验证。
- Out of scope: 改动业务 UI、重新执行完整 Production 浏览器 E2E。

## Clarifications And Assumptions

- Confirmed: Web 直接依赖 6 个 `@svton/*` 包；`service` 依赖 `api-client`，`ui` 依赖 `hooks`。
- Confirmed: 当前失败是容器内缺少 `@svton/hooks/dist`，不是页面业务代码错误。

## Workflow Routing

`routing: todo-plan + noisy-tools; Docker 构建涉及 workspace 依赖顺序与真实容器验证。`

## Functional TODO Breakdown

### F1. 可复现的 Web 镜像构建

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | 映射 Web workspace 依赖闭包。 | package manifests / imports | 六个直接包，两个内部依赖边 |
| F1.2 | done | 在 Web Dockerfile 内按依赖顺序编译 workspace 包。 | `apps/devpilot-web/Dockerfile` | 六包按 `api-client/hooks/logger/nestjs-http/service/ui` 构建 |
| F1.3 | done | 独立构建 Web 镜像。 | Docker build | `devpilot-app-web:local`，digest `d6d2200e...` |

### F2. 本机运行验证

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | 替换 `devpilot-app-web` 容器。 | local Compose stack only | Compose recreate 成功 |
| F2.2 | done | 验证 3120 页面、SSR/API 连通与新镜像身份。 | read-only HTTP/container checks | `/` 200、`/login` 200、API healthy、容器镜像 ID exact |

## Verification Plan

- Web type-check 与 build。
- `docker compose ... build web`。
- 强制重建 Web 容器；验证 `/` HTTP 200、API health 200、容器镜像 ID 与新镜像一致。

## Change Log

- 2026-08-13: 创建计划并开始 Dockerfile 修复。
- 2026-08-13: Docker 镜像构建、容器替换及 HTTP/API 健康验证完成。
