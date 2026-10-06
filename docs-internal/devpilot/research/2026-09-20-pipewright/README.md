# Pipewright 调研与采用决策

日期：2026-09-20。对象：`huangchengsir/pipewright`，不是同名 Python 库或流水线转换工具。
源码基线：`1cd0604ebb0b58408e706baced3a52209b5eaae7`；最新正式版核验为 v1.5.3（2026-08-29）。

本目录是调研事实源；[功能规划](../../plans/2026-09-20-pipewright-improvements.md)、[技术方案](../../plans/2026-09-20-pipewright-technical-design.md)、[原型合同](../../../../evaluation/design/devpilot-design-system-v3/prototype/PIPEWRIGHT_PLAN.md) 引用它。

## 结论

Pipewright 的 CI/CD、SSH 多机部署、环境版本、容器运维、域名和访问入口与 Devpilot 高度重合。优先借鉴失败续接、按目标展示结果、制品存储和交付验收的组织方式。当前不引入整套 Go 服务、不迁移账号权限、不复制 Vue 页面、不替换现有发布状态机。

## 证据等级

| 等级 | 本次含义 |
|---|---|
| SOURCE | 读取了实现，不代表测试或部署通过 |
| DECLARED | 官方 README / release 声明，未验证运行 |
| PROPOSED | 面向 Devpilot 的设计决策，不是上游或本项目已实现能力 |

本次没有安装 Pipewright、执行上游测试、启动实例或进行安全审计；不使用功能列表证明生产成熟度。

## 已核验事实与采用边界

| 主题 | 证据与限制 | Devpilot 决策 |
|---|---|---|
| 部署策略 | SOURCE：rolling / canary / blue_green 等代码存在；canary 按主机小批健康门控 | 学批次状态、暂停/中止，不宣传按流量权重灰度 |
| 蓝绿 | SOURCE：按产物类型选择 stage/cutover 或镜像路径，其他类型可退化 | 必须先声明 Provider 能力与实测切流证据，暂不开放生产控件 |
| 制品库 | SOURCE：SHA-256 内容寻址、临时文件提交、真实字节保存与去重 | 复用思想和测试用例，保持现有 Manifest 唯一权威，不重复建库 |
| PR 预览 | SOURCE：钩子从分支约定解析 PR 号，读取已有代理路由；失败可只记日志 | 不能照搬；必须用 SCM webhook 的明确 PR 标识，独立状态、配额、销毁证据 |
| 访问入口 | DECLARED：Caddy、HTTPS、DNS provider 与部署联动 | 借鉴交付体验；复用现有 Site/路由接口，不直接引入第二套 Caddy 控制面 |
| 账号 | DECLARED：single-admin | 不满足我们的团队隔离与生产审批需求，保留现有鉴权 |
| 前端 | SOURCE：Vue 3 / Naive UI / Vite；后端 Go | 与 NestJS / React 不同，只移植有价值的小模块/交互合同 |
| AI | SECURITY 明确核心 CI/CD 不依赖 AI | AI 仅解释失败，任何执行决策继续由确定性服务端门禁负责 |

## 直接复用清单

- 许可上：MIT 允许使用、修改、分发和商业使用；保留版权与许可声明，逐项检查第三方依赖。
- 工程上：领域 Go 代码并非可直接 import 的 TypeScript 模块；如未来采用 Go 执行服务，先证明其接口、认证、幂等、取消、日志脱敏与制品绑定合同。
- 当前批准方向：参考部署异常处理、制品与目标证据的模型；不复制上游代码。本次原型为自主实现，无新增上游代码或依赖。
- 暂缓：整套后台移植、通用 DAG 编辑器、自动流量灰度、自动指标回滚、无人审批生产部署。

## 建木对照

建木更适合参考版本化节点、类型化输入输出、容器执行和 Worker 扩展；Pipewright 更适合参考部署/运维/访问入口闭环。建木主仓库 MulanPSL-2.0，不能覆盖所有独立 Runner；Runner 仍是待逐项核验的候选。正式版页面本次显示 v2.8.0（2024-12-02），master 2026-04-14 仍有修复，不能由发行日期推断停更。

## 来源账本

所有 Pipewright 源码链接固定到本次 SHA，README 功能声明与源码抽查分开。

- P01 [仓库介绍](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/README.md)
- P02 [MIT LICENSE](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/LICENSE)
- P03 [部署策略](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/internal/deploy/strategy.go)
- P04 [内容寻址制品存储](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/internal/artifactstore/store.go)
- P05 [PR 预览钩子](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/internal/httpapi/previewenv_hook.go)
- P06 [前端依赖](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/web/package.json)
- P07 [安全策略](https://github.com/huangchengsir/pipewright/blob/1cd0604ebb0b58408e706baced3a52209b5eaae7/SECURITY.md)
- P08 [v1.5.3 发行](https://github.com/huangchengsir/pipewright/releases/tag/v1.5.3)
- J01 [建木节点协议](https://github.com/jianmu-dev/jianmu-docs/blob/comyan/guide/custom-node.md)
- J02 [建木发行](https://gitee.com/jianmu-dev/jianmu/releases)
- J03 [建木许可证](https://github.com/jianmu-dev/jianmu/blob/master/LICENSE)

## 当前 Devpilot 审查基线

工作区 HEAD：47daa01d，含既有未提交内容。9 月 20 日前序检查：web/API 类型检查通过，发布相关 119 项单元测试通过，9 项 DB 集成跳过。Devpilot 本机服务当时全部停止，3120 连接拒绝。这是时间点证据，不是长期可用性结论。

源码问题：生产面板按“存在任意运行”冻结；预发完成判断没有绑定新制品；恢复入口远离失败现场；凭据加载错误被空列表掩盖。后续方案核验发现后端已有 reconcile/resume，故问题不能概括成后端完全没有恢复能力。详见技术方案的当前路径。
