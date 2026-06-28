# Devpilot Traefik 架构演进规划与开发指南

**文档版本**: v1.0  
**创建日期**: 2026-06-26  
**状态**: 已确认，待实施  
**目标读者**: 开发 Agent、开发人员、自校验系统

---

## 1. 架构决策与依据

### 1.1 核心决策

| 决策项 | 决策结果 | 替代方案 | 决策依据 |
|--------|---------|----------|----------|
| **网关选型** | Traefik | Nginx/OpenResty | 自动服务发现，无需修改配置文件 |
| **配置中心** | Devpilot Key-Center | Nacos | 规模太小（2-5台服务器），引入Nacos运维成本过高 |
| **配置注入方式** | 环境变量 + Docker Secrets | Nacos SDK | 部署时注入，配合蓝绿部署重启生效 |
| **服务发现** | Traefik Docker Provider | Nacos 服务发现 | Traefik 自动从 Docker labels 发现服务 |
| **蓝绿切换方式** | Traefik API 动态调整 weight | Nginx upstream 配置 reload | 秒级切换，无需 reload，支持金丝雀发布 |

### 1.2 决策依据详解

#### 为什么不用 Nginx？

**问题**：
- 每次新增服务/修改路由都需要修改 Nginx 配置文件
- 需要 `nginx -s reload`，虽然平滑但有风险
- 配置管理复杂，多产品混部时配置文件容易冲突

**Traefik 优势**：
- **自动服务发现**：容器启动/停止时，Traefik 自动更新路由规则
- **零配置修改**：通过 Docker labels 声明路由，不需要改网关配置
- **动态权重调整**：通过 API 调整流量权重，支持蓝绿/金丝雀发布
- **开箱即用**：Docker Compose 启动后，Traefik 自动发现服务

#### 为什么不用 Nacos？

**问题**：
- Nacos 需要 1C2G 资源，对小团队来说成本高
- 需要服务接入 Nacos SDK，改造成本大
- 配置实时推送能力在小规模下收益不明显

**替代方案**：
- **配置管理**：Devpilot Key-Center 已经能管理密钥
- **配置注入**：部署时注入环境变量，配合 Docker Secrets
- **配置更新**：蓝绿部署本身需要重启服务，环境变量更新自然生效
- **未来扩展**：等服务数超过 20 个再考虑引入 Nacos

---

## 2. 整体架构设计

### 2.1 架构图

```
                     ┌─────────────┐
                     │  用户流量    │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Traefik     │  ← 唯一入口，自动服务发现
                     │  (网关)      │
                     └──────┬──────┘
                ┌────────────┼────────────┐
                │            │            │
         ┌──────▼───┐  ┌───▼────┐  ┌───▼────┐
         │产品A-蓝   │  │产品A-绿  │  │产品B-蓝  │  ← Docker 容器，label 控制注册
         └──────────┘  └────────┘  └────────┘
                │
         ┌──────▼──────────────────────┐
         │       Devpilot (管理平台)    │
         │  ┌──────────┬─────────────┐ │
         │  │部署编排   │Traefik控制  │ │  ← 通过 Traefik API 切换流量
         │  ├──────────┼─────────────┤ │
         │  │密钥管理   │审批+审计    │ │
         │  ├──────────┼─────────────┤ │
         │  │资源管理   │多环境管理   │ │
         │  └──────────┴─────────────┘ │
         └──────────────────────────────┘
```

### 2.2 数据流向

```
部署流程：
  1. 开发推送代码 → Git Webhook → Devpilot 触发部署
  2. Devpilot 构建镜像 → 推送到镜像仓库
  3. Devpilot 调用 Traefik API → 部署绿环境（weight=0）
  4. 自动化冒烟测试 → 验证绿环境健康状态
  5. Devpilot 调用 Traefik API → 调整 weight（0% → 100%）
  6. 观察期 → 监控错误率/响应时间
  7. 确认或回滚 → Traefik API 调整 weight 或切回蓝环境

配置流程：
  1. 用户在 Devpilot 配置环境变量
  2. Devpilot Key-Center 加密存储
  3. 部署时 Devpilot 注入环境变量到容器
  4. 容器启动后读取环境变量
  5. 蓝绿切换时，新版本容器使用新配置启动
```

---

## 3. Devpilot 模块改造与新增

### 3.1 现有模块改造

#### `proxy-config` 模块

**现状**：生成 Nginx 配置文件，sync() 是 stub（模拟）

**改造方案**：
- **不再生成 Nginx 配置文件**
- **改为调用 Traefik API** 管理路由和服务
- 保留配置生成逻辑，但输出为 Traefik Docker labels 或 Kubernetes annotations

**文件变更**：
- `apps/devpilot-api/src/proxy-config/proxy-config.service.ts` - 改造 generateNginxConfig() 为 generateTraefikConfig()
- `apps/devpilot-api/src/proxy-config/proxy-config.controller.ts` - 新增 Traefik 相关接口

**验收标准**：
- [ ] 不再生成 Nginx 配置文件
- [ ] 能够生成 Traefik Docker labels
- [ ] 能够通过 Traefik API 创建/更新/删除路由

#### `deployment` 模块

**现状**：部署执行逻辑完整，使用 ServerExecutor

**改造方案**：
- **扩展部署流程**：部署完成后自动调用 traefik-control 切换流量
- **支持蓝绿部署**：部署时创建绿环境，验证通过后切换
- **支持回滚**：切换失败时自动回滚到蓝环境

**文件变更**：
- `apps/devpilot-api/src/deployment/deployment.service.ts` - 新增蓝绿部署逻辑
- `apps/devpilot-api/src/deployment/dto/` - 新增蓝绿部署 DTO

**验收标准**：
- [ ] 部署流程支持蓝绿模式
- [ ] 部署完成后自动调用 traefik-control 切换流量
- [ ] 支持一键回滚

### 3.2 新增模块

#### `traefik-control` 模块

**功能**：封装 Traefik REST API，提供蓝绿切换接口

**核心能力**：
- 获取所有路由和服务
- 动态调整服务权重（蓝绿切换）
- 健康检查
- 服务注册/注销

**文件结构**：
```
apps/devpilot-api/src/traefik-control/
├── traefik-control.controller.ts   # REST API 接口
├── traefik-control.service.ts      # 业务逻辑
├── traefik-api.client.ts          # Traefik API 客户端
├── dto/
│   ├── switch-request.dto.ts      # 切换请求 DTO
│   └── weight-config.dto.ts       # 权重配置 DTO
└── traefik-control.module.ts      # 模块定义
```

**API 设计**：
```
POST   /api/traefik/services/:serviceName/switch   # 蓝绿切换
GET    /api/traefik/services/:serviceName/weight   # 获取当前权重
PUT    /api/traefik/services/:serviceName/weight   # 调整权重
GET    /api/traefik/health/:serviceName            # 健康检查
GET    /api/traefik/routes                         # 获取所有路由
```

**验收标准**：
- [ ] 能够通过 Traefik API 获取服务列表
- [ ] 能够动态调整服务权重
- [ ] 能够进行健康检查
- [ ] 单元测试覆盖率 > 80%

#### `release-strategy` 模块

**功能**：蓝绿/金丝雀发布流程编排

**核心能力**：
- 蓝绿发布：部署绿环境 → 验证 → 切换 → 观察 → 确认/回滚
- 金丝雀发布：按比例逐步切换流量（10% → 50% → 100%）
- 自动化验证：健康检查、冒烟测试、回归测试
- 观察期监控：错误率、响应时间、资源使用率

**文件结构**：
```
apps/devpilot-api/src/release-strategy/
├── release-strategy.controller.ts   # REST API 接口
├── release-strategy.service.ts      # 业务逻辑
├── release-strategy.executor.ts     # 发布执行器
├── strategies/
│   ├── blue-green.strategy.ts      # 蓝绿发布策略
│   └── canary.strategy.ts          # 金丝雀发布策略
├── dto/
│   ├── create-release.dto.ts       # 创建发布 DTO
│   └── release-config.dto.ts       # 发布配置 DTO
└── release-strategy.module.ts      # 模块定义
```

**API 设计**：
```
POST   /api/release-strategies         # 创建发布
GET    /api/release-strategies/:id     # 获取发布详情
PUT    /api/release-strategies/:id/switch   # 切换流量
PUT    /api/release-strategies/:id/confirm  # 确认发布
PUT    /api/release-strategies/:id/rollback # 回滚发布
GET    /api/release-strategies/:id/logs     # 获取发布日志
```

**验收标准**：
- [ ] 支持蓝绿发布流程
- [ ] 支持金丝雀发布流程
- [ ] 支持自动化验证
- [ ] 支持一键回滚
- [ ] 单元测试覆盖率 > 80%

---

## 4. Docker Compose 配置

### 4.1 Traefik 配置

```yaml
# apps/devpilot-api/docker-compose.traefik.yml

version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"  # 启用 Dashboard（生产环境应关闭）
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik Dashboard
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./traefik.yml:/etc/traefik/traefik.yml"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.localhost`)"
      - "traefik.http.routers.dashboard.service=api@internal"

  devpilot-api:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.devpilot-api.rule=Host(`api.localhost`)"
      - "traefik.http.services.devpilot-api.loadbalancer.server.port=3000"
      - "traefik.http.services.devpilot-api.weight=100"  # 可以通过 API 调整

  devpilot-web:
    build: ../devpilot-web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.devpilot-web.rule=Host(`app.localhost`)"
      - "traefik.http.services.devpilot-web.loadbalancer.server.port=3000"
```

### 4.2 蓝绿部署示例

```yaml
# 产品 A - 蓝环境（当前生产）
services:
  product-a-blue:
    image: product-a:v1.0
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.product-a.rule=Host(`product-a.localhost`)"
      - "traefik.http.services.product-a.loadbalancer.server.port=3000"
      - "traefik.http.services.product-a.weight=100"  # 当前接收 100% 流量

# 产品 A - 绿环境（新版本）
services:
  product-a-green:
    image: product-a:v1.1
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.product-a.rule=Host(`product-a.localhost`)"
      - "traefik.http.services.product-a.loadbalancer.server.port=3000"
      - "traefik.http.services.product-a.weight=0"  # 当前接收 0% 流量
```

**切换流程**：
1. 部署绿环境（weight=0）
2. 验证绿环境健康状态
3. 调用 Traefik API 调整权重：蓝 0%，绿 100%
4. 观察期（10 分钟）
5. 确认：停掉蓝环境；或回滚：调整权重：蓝 100%，绿 0%

---

## 5. 开发路线图

### 5.1 第一阶段（第 1-2 周）：基础架构搭建

**目标**：Traefik 接入，实现基本网关功能

**任务**：
- [ ] 创建 `traefik-control` 模块
- [ ] 实现 Traefik API 客户端
- [ ] 实现蓝绿切换 API
- [ ] 修改 `proxy-config` 模块，不再生成 Nginx 配置
- [ ] 创建 Docker Compose 配置（Traefik + 示例服务）
- [ ] 编写单元测试

**验收标准**：
- [ ] Traefik Dashboard 可以访问
- [ ] 示例服务可以通过 Traefik 访问
- [ ] 能够通过 API 调整服务权重
- [ ] 单元测试覆盖率 > 80%

### 5.2 第二阶段（第 3-4 周）：部署流程集成

**目标**：部署流程支持蓝绿发布

**任务**：
- [ ] 扩展 `deployment` 模块，支持蓝绿部署
- [ ] 创建 `release-strategy` 模块
- [ ] 实现蓝绿发布流程编排
- [ ] 实现自动化健康检查
- [ ] 实现一键回滚
- [ ] 编写单元测试

**验收标准**：
- [ ] 部署流程支持蓝绿模式
- [ ] 能够进行自动化健康检查
- [ ] 支持一键回滚
- [ ] 单元测试覆盖率 > 80%

### 5.3 第三阶段（第 5-6 周）：可观测性与优化

**目标**：接入监控，优化发布流程

**任务**：
- [ ] 接入 Prometheus + Grafana
- [ ] 发布时自动对比错误率/响应时间
- [ ] 实现金丝雀发布（按比例切换流量）
- [ ] 优化部署流程性能
- [ ] 编写集成测试

**验收标准**：
- [ ] 能够监控服务错误率/响应时间
- [ ] 支持金丝雀发布
- [ ] 集成测试覆盖率 > 60%

---

## 6. Agent 开发上下文

### 6.1 Agent 任务清单

Agent 需要能够执行以下任务：

#### 任务 1：创建 `traefik-control` 模块

**输入**：
- 模块名称：`traefik-control`
- Traefik API 端点：`http://localhost:8080/api`
- 需要实现的接口：见 3.2 节

**输出**：
- `apps/devpilot-api/src/traefik-control/` 目录下所有文件
- 单元测试文件
- 更新后的 `apps/devpilot-api/src/app.module.ts`

**自校验**：
- [ ] 所有文件已创建
- [ ] 代码编译通过（`pnpm --filter @svton/devpilot-api typecheck`）
- [ ] 单元测试通过（`pnpm --filter @svton/devpilot-api test`）
- [ ] 能够通过 API 调整服务权重

#### 任务 2：改造 `proxy-config` 模块

**输入**：
- 现有 `proxy-config` 模块代码
- 改造方案：见 3.1 节

**输出**：
- 修改后的 `proxy-config.service.ts`
- 修改后的 `proxy-config.controller.ts`
- 更新后的单元测试

**自校验**：
- [ ] 不再生成 Nginx 配置文件
- [ ] 能够生成 Traefik Docker labels
- [ ] 代码编译通过
- [ ] 单元测试通过

#### 任务 3：创建 Docker Compose 配置

**输入**：
- Traefik 配置要求：见 4.1 节
- 蓝绿部署示例：见 4.2 节

**输出**：
- `apps/devpilot-api/docker-compose.traefik.yml`
- 示例服务 Docker Compose 文件

**自校验**：
- [ ] Docker Compose 配置语法正确（`docker compose config`）
- [ ] 能够启动 Traefik 和示例服务
- [ ] Traefik Dashboard 可以访问
- [ ] 示例服务可以通过 Traefik 访问

### 6.2 Agent 自校验流程

```
Agent 自校验流程：
  1. 代码生成完成后，运行类型检查
     pnpm --filter @svton/devpilot-api typecheck
  2. 运行单元测试
     pnpm --filter @svton/devpilot-api test
  3. 运行构建
     pnpm --filter @svton/devpilot-api build
  4. 启动 Docker Compose
     docker compose -f apps/devpilot-api/docker-compose.traefik.yml up -d
  5. 验证 Traefik Dashboard 可访问
     curl http://localhost:8080/dashboard/
  6. 验证 API 接口可用
     curl http://localhost:3000/api/traefik/services
  7. 验证蓝绿切换功能
     调用 API 调整服务权重，观察 Traefik Dashboard 变化
```

### 6.3 Agent 开发规范

**代码规范**：
- TypeScript 严格模式
- 使用 NestJS 标准结构
- 所有 DTO 使用 `class-validator` 进行校验
- 所有服务方法编写单元测试

**测试规范**：
- 单元测试覆盖率 > 80%
- 使用 Jest 测试框架
- Mock 外部依赖（Traefik API）

**文档规范**：
- 所有 API 接口编写 Swagger 文档
- 使用 `@nestjs/swagger` 装饰器

---

## 7. 技术细节与注意事项

### 7.1 Traefik API 使用

**Traefik API 端点**：
- Dashboard API：`http://localhost:8080/api`
- 获取服务列表：`GET /api/http/services`
- 获取路由列表：`GET /api/http/routers`
- 更新服务配置：Traefik 不支持通过 API 动态更新服务配置，需要通过 Docker labels 或文件 provider

**重要提醒**：
- Traefik 的 Docker provider 不支持动态更新服务权重
- 要实现动态权重调整，需要使用 **Traefik Service Weight** 功能，通过 **File Provider** 动态更新配置文件
- 或者使用 **Traefik Kubernetes CRD**，如果在 K8s 环境

**推荐方案**：
- 使用 **Traefik File Provider** + **动态配置文件**
- Devpilot 通过 API 更新配置文件，Traefik 自动重新加载

**示例**：
```yaml
# dynamic-config.yml
http:
  services:
    product-a:
      weight: 100  # 可以通过 API 修改这个文件
      servers:
        - url: "http://product-a-blue:3000"
        - url: "http://product-a-green:3000"
```

### 7.2 蓝绿切换实现

**方案 A：使用 Traefik Service LoadBalancer**

```yaml
# dynamic-config.yml
http:
  services:
    product-a:
      weight: 100  # 可以通过 API 修改这个文件
      servers:
        - url: "http://product-a-blue:3000"
          weight: 100
        - url: "http://product-a-green:3000"
          weight: 0
```

**切换脚本**（Devpilot 调用）：
```bash
# 读取当前配置
cat dynamic-config.yml

# 修改权重（蓝 0%，绿 100%）
# 可以通过 Node.js fs 模块修改文件
# Traefik 会自动重新加载 File Provider 配置

# 验证切换结果
curl -X GET http://localhost:8080/api/http/services/product-a
```

**方案 B：使用 Traefik Docker Labels + 环境变量**

```yaml
# docker-compose.yml
services:
  product-a-blue:
    image: product-a:v1.0
    labels:
      - "traefik.http.services.product-a-blue.loadbalancer.server.port=3000"
  
  product-a-green:
    image: product-a:v1.1
    labels:
      - "traefik.http.services.product-a-green.loadbalancer.server.port=3000"
  
  # 使用动态服务，通过权重控制流量分配
  # 这个方法需要 Traefik 2.0+ 和企业版，或者使用开源的 Traefik Mesh
```

**推荐方案**：使用 **File Provider + 动态配置文件**

```
实现步骤：
1. Devpilot 维护一个动态配置文件（dynamic-config.yml）
2. Traefik 配置 File Provider 监听这个文件
3. 蓝绿切换时，Devpilot 修改 dynamic-config.yml
4. Traefik 自动重新加载配置（无需重启）
5. 流量按新的权重分配
```

### 7.3 健康检查实现

**Traefik 健康检查配置**：

```yaml
# dynamic-config.yml
http:
  services:
    product-a:
      servers:
        - url: "http://product-a-blue:3000"
        - url: "http://product-a-green:3000"
      healthCheck:
        path: "/health"
        interval: "10s"
        timeout: "5s"
      # 不健康的实例会自动从负载均衡中摘除
```

**服务健康检查接口实现**（Node.js 示例）：

```typescript
// apps/devpilot-api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || 'unknown',
    };
  }
}
```

---

## 8. 风险评估与应对措施

### 8.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| Traefik 配置错误导致服务不可用的 | 高 | 中 | 1. 配置变更前自动备份<br>2. 配置验证（traefik config check）<br>3. 灰度发布配置变更 |
| Traefik 性能瓶颈 | 中 | 低 | 1. 性能测试<br>2. 监控 Traefik 指标<br>3. 准备扩容方案 |
| Docker Socket 权限风险 | 高 | 中 | 1. 限制 Traefik 容器权限<br>2. 使用只读挂载<br>3. 定期安全审计 |
| 服务发现延迟 | 中 | 中 | 1. 配置健康检查<br>2. 设置合理的超时时间<br>3. 监控服务发现状态 |

### 8.2 实施风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 开发进度延迟 | 中 | 中 | 1. 分阶段实施<br>2. 优先实现核心功能<br>3. 预留缓冲时间 |
| 团队学习曲线 | 中 | 高 | 1. 提供培训材料<br>2. 编写详细文档<br>3. 两两配对编程 |
| 现有功能回归 | 高 | 中 | 1. 完善单元测试<br>2. 自动化回归测试<br>3. 灰度发布新功能 |

---

## 9. FAQ

### 9.1 为什么选择 Traefik 而不是 Nginx？

**答案**：Traefik 专为容器化环境设计，支持自动服务发现，不需要手动修改配置文件。对于多产品混部的场景，Traefik 的 Docker Provider 可以自动从 Docker labels 发现服务，大大简化了配置管理。

### 9.2 Traefik 是否支持动态权重调整？

**答案**：Traefik 开源版不支持通过 API 动态调整权重。但可以通过以下方式实现：
1. 使用 File Provider + 动态配置文件
2. 修改配置文件后，Traefik 自动重新加载
3. Devpilot 通过 API 修改配置文件，实现权重调整

### 9.3 为什么不使用 Nacos？

**答案**：对于 2-5 台服务器的规模，引入 Nacos 的运维成本过高。Nacos 需要至少 1C2G 的资源，而且需要服务接入 Nacos SDK，改造成本大。Devpilot 的 Key-Center 已经能够满足配置管理需求。

### 9.4 蓝绿切换是否需要停机？

**答案**：不需要。蓝绿切换是秒级完成的，用户无感知。切换过程：
1. 部署绿环境（不接流量）
2. 验证绿环境健康状态
3. 调整权重（蓝 0%，绿 100%）
4. 观察期（10 分钟）
5. 确认或回滚

### 9.5 如何回滚？

**答案**：回滚是秒级的。只需要调整权重（蓝 100%，绿 0%），流量就会切回蓝环境。如果绿环境有问题，可以立即停止绿环境容器。

---

## 10. 附录

### 10.1 相关文档

- [Devpilot 项目纳管、Webhook 与站点管控演进说明](./project-onboarding-control-plane-roadmap.md)
- [Devpilot 需求与进度盘点](./requirements-and-progress.md)
- [Traefik 官方文档](https://doc.traefik.io/traefik/)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Traefik File Provider](https://doc.traefik.io/traefik/providers/file/)

### 10.2 参考项目

- [Coolify](https://coolify.io/) - 自托管 PaaS
- [Portainer](https://www.portainer.io/) - 容器管理平台
- [Dokploy](https://dokploy.com/) - 应用部署平台

### 10.3 配置模板

#### Traefik 基础配置

```yaml
# traefik.yml
api:
  dashboard: true
  insecure: true  # 生产环境应关闭

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
  file:
    filename: "/etc/traefik/dynamic-config.yml"
    watch: true  # 自动重新加载配置文件

log:
  level: "INFO"

accessLog: {}
```

#### 动态配置文件模板

```yaml
# dynamic-config.yml
http:
  services:
    product-a:
      servers:
        - url: "http://product-a-blue:3000"
          weight: 100
        - url: "http://product-a-green:3000"
          weight: 0
      healthCheck:
        path: "/health"
        interval: "10s"
        timeout: "5s"
  
  routers:
    product-a:
      rule: "Host(`product-a.localhost`)"
      service: "product-a"
      entryPoints:
        - "web"
```

### 10.4 单元测试模板

```typescript
// apps/devpilot-api/src/traefik-control/traefik-control.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TraefikControlService } from './traefik-control.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

describe('TraefikControlService', () => {
  let service: TraefikControlService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraefikControlService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            put: jest.fn(),
            post: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:8080'),
          },
        },
      ],
    }).compile();

    service = module.get<TraefikControlService>(TraefikControlService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get services', async () => {
    const mockResponse = {
      data: {
        'product-a@docker': {
          loadBalancer: {
            servers: [
              { url: 'http://product-a-blue:3000' },
            ],
          },
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };

    jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse as any));

    const services = await service.getServices();
    expect(services).toBeDefined();
    expect(httpService.get).toHaveBeenCalledWith('http://localhost:8080/api/http/services');
  });
});
```

---

## 11. 文档维护

### 11.1 更新记录

| 版本 | 日期 | 更新内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-06-26 | 初始版本，记录 Traefik 架构决策与规划 | Devpilot Team |

### 11.2 维护指南

**何时更新此文档**：
- 架构决策发生变化
- 新增/修改模块
- 技术方案调整
- 验收标准变更

**如何更新此文档**：
1. 更新版本号
2. 添加更新记录
3. 通知相关开发人员
4. 更新 Agent 上下文（如需要）

---

**文档结束**

**下一步**：根据此文档，Agent 可以开始实施第一阶段任务（创建 `traefik-control` 模块）。
