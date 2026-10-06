# V3 原型增量：发布异常闭环

本次保留原有 AppShell、项目导航、发布列表、发布详情、配置和证据抽屉。在发布详情增加“改进后发布流程”，可以切回“原有入口配置流程”。没有重建独立产品原型。

- [研究事实](../../../../docs-internal/devpilot/research/2026-09-20-pipewright/README.md)
- [功能规划](../../../../docs-internal/devpilot/plans/2026-09-20-pipewright-improvements.md)
- [技术方案](../../../../docs-internal/devpilot/plans/2026-09-20-pipewright-technical-design.md)

## 交互情景

| 情景 | 操作顺序 | 可检查结果 |
|---|---|---|
| 新构建 | 发布详情 → 新构建需要重新预发 → 部署并验证 B → 确认生产 | A/B 证明区分；生产请求进入待核对 |
| 中断 | 生产请求中断 → 核对 → 继续此次运行 | 原 PR-1042 不变；重复事件不新增运行；部署后另做访问验证 |
| 首批 | 首批通过 → 继续剩余 2 台或中止 | 继续模拟第 2 台失败，第 3 台未执行；中止保留第 1 台新版本 |
| 失败 | 部分失败 → 恢复 1.3.2 → 确认 | 新 RV-1043，旧运行/错误保留，目标回到旧版本 |
| 入口 | 部署完成入口未通过 → 重新验证 | 当前运行 1.4.0 与访问状态分开；通过后完成 |

演示固定使用 3 台目标。数据保存在本标签页 sessionStorage；刷新或离开详情后返回仍可读取。重置情景会清空该情景的模拟进度。所有确认均为本地 fixture 转换，页面明确标注；没有真实构建、审批、SSH、DNS、TLS 或数据库动作。

## 文件与职责

- `src/screens/ReleaseScreen.jsx`：保留旧视图，切换增量流程。
- `src/components/DeliveryScenarioFlow.jsx`：展示操作状态、目标和事件。
- `src/components/deliveryScenarioModel.js`：唯一模拟转换与目标读模型。
- `src/hooks/useDeliveryScenario.js`：会话存储，不承载真实 API。
- `src/components/DeliveryScenarioConfirm.jsx`：复用原对话框视觉与焦点控制。
- `tests/delivery-scenario.test.mjs`：证明关键不变量，不替代后端测试。

## 字段与真实合同映射

| 原型字段 | 接入目标 | 当前等级 |
|---|---|---|
| candidate/proven | Manifest 与有效预发证明 | CURRENT_SOURCE；需修匹配判断 |
| phase/actions | 生命周期与服务端可执行动作聚合 | PROTOTYPE / BACKEND 扩展 |
| run | 原 ReleaseRun ID | CURRENT_SOURCE；原型固定 PR-1042 |
| targets | 部署目标回执、健康与批次读模型 | PROTOTYPE / BACKEND 扩展 |
| current/history | EnvironmentVersion 与恢复记录 | CURRENT_SOURCE；原型模拟 |
| events | 运行事件、审计与探测证据 | CURRENT_SOURCE；原型模拟 |

不能把这些 fixture 名称直接当拟议数据库列。所有派生状态由同一领域事实生成；新增 DTO/字段以技术方案审计为准。

## 后续原型范围

PW06 模板、PW07 PR 预览本次仅规划；不添加会让用户误认为可用的菜单。PW08 凭据错误修复先进入真实接入页任务。高级灰度/蓝绿保持关闭。真实生产导航优先遵循当前工作台合同，存量 V3 导航不作为旧路由恢复依据。

## 当前项目框架对齐

2026-09-20：情景从「我的项目 → 项目首页发布记录 → R-1042」进入。目录、三个同页 Tab、折叠仓库详情和页头配置入口对齐当前应用源码；情景仍为本地模拟。
