# V2-06 进度组件调研与取舍

本清单只记录两类证据：本目录截图中可以直接看到的布局，以及官方文档明确描述的组件能力。截图是静态取样，不代表已经验证 hover、键盘、折叠动画、日志加载或其他动态行为。

## 截图索引

| 截图 | 原始尺寸 | 用途 |
| --- | ---: | --- |
| [`element-plus-simple-steps.png`](./element-plus-simple-steps.png) | 520 × 120 | 横向轻量步骤段与方向分隔 |
| [`patternfly-vertical-progress-stepper.png`](./patternfly-vertical-progress-stepper.png) | 470 × 150 | 单轴纵向节点、标题和说明 |
| [`mui-vertical-stepper.png`](./mui-vertical-stepper.png) | 260 × 220 | 当前步骤展开、动作就地展示 |
| [`vercel-deployment-status.png`](./vercel-deployment-status.png) | 2672 × 676 | 部署对象、状态和来源信息同区展示 |
| [`github-actions-job-steps.png`](./github-actions-job-steps.png) | 1358 × 558 | 作业步骤折叠及可用日志的展开方式 |
| [`carbon-progress-states.png`](./carbon-progress-states.png) | 1824 × 1026 | 完成、当前、未开始的图标与连接线语义 |
| [`devpilot-v2-06-rejected.png`](./devpilot-v2-06-rejected.png) | 1440 × 1024 | 被否定的实体鱼骨条、散列表时间线和重复摘要 |

## 社区与产品对比

| 产品 / 组件 | 截图可见事实 | 官方文档能力 | 对 V2-06 的取舍 |
| --- | --- | --- | --- |
| Element Plus Steps | `simple` 示例使用浅背景步骤段和细方向提示，整体高度低 | 官方支持 `active`、步骤状态、图标、横向/纵向与 simple 模式 | 采用“平面分段 + 细 chevron”方向感，不复制突出的鱼骨切口 |
| PatternFly Progress Stepper | 垂直轴把节点、标题、说明收在同一阅读线 | 官方提供 vertical、compact、description、issue/failure 等变体及 `aria-label` 指引 | 采用单轴、节点邻近内容；不保留独立时间列或远端状态列 |
| MUI Stepper | 当前步骤展开说明和动作，后续步骤保持收起 | 官方 `StepContent` 支持纵向展开/收起，`StepButton` 可用于可导航步骤 | 采用“当前项默认展开、前后项收起”，把运行详情动作放进当前步骤 |
| Carbon Progress Indicator | 完成、当前、未开始同时依赖图标、线和文本，而非单一颜色 | 官方列出 complete/current/not started，以及 hover、focus、error、disabled 视觉状态 | 采用颜色 + 图标 +文字三重编码；交互态只写实现合同，不在静态稿里声称已验证 |
| GitHub Actions | job 标题可展开，日志仅在展开区域出现并与具体运行步骤关联 | 官方说明可查看、搜索、下载 job logs，完成结果含 success/failure/canceled/neutral | 终态前禁用“查看终态日志”；不伪造实时日志、心跳或逐步时间 |
| Vercel Deployments | 部署条目把环境、状态、耗时、分支/提交放在同一对象上下文 | 官方支持按 branch、status、environment 筛选与管理部署 | 保留运行对象与状态的邻近关系；不将部署列表样式误用为运行内微步骤 |
| Cloudflare Pages | 本次未保存独立截图 | 官方调试路径从 deployment details 进入 build log | 终态日志入口必须依赖真实日志可用性，不把“将来可看”表现成当前可看 |
| Ant Design Steps | 本次未保存独立截图 | 官方 Steps 用于有顺序的子任务，并支持当前状态与可导航步骤 | 参考状态与导航合同；不直接采用其圆节点横向样式 |

## 最终测量

顶部 segmented chevron rail：

- 外框 `1148 × 40`，`1px #D0D5DD`，圆角 `6px`，裁切内容。
- 四段各 `287 × 40`，零 gap、零 overlap、无突出 tip/notch。
- 三个边界各叠加 `15px chevron-right`；相邻 current/blocked 时为白色，否则为 `#CBD5E1`。
- 段内左右 padding `16px`，图标 `14px`，图标与文字 gap `8px`，文字 `13px / 600`；current/blocked 为 `700`。
- 状态：completed `#E8F1FF / #1D4ED8`；current `#0F62FE / white`；pending `#E4E7EC / #475467`；disabled `#F8FAFC / #98A2B3`；blocked `#E5484D / white`。

DeploymentRun timeline：

- 单列宽 `920px`；marker 列 `24px`，内容 gap `12px`，连接线 `2px`。
- completed/future 节点 `18px`，current 节点 `20px`。
- 收起行 `56px`；current 展开行 `176px`，展开块高 `160px`。
- 展开块背景 `#F8FAFC`、边框 `#E4E7EC`、圆角 `6px`、padding `12px 14px`。
- 操作按钮 `144 × 38`；终态日志按钮 disabled，并显示“运行完成后开放”。

## 最终决策

顶部只负责有限阶段的顺序与可选择性，采用 segmented chevron rail；下方只负责当前 DeploymentRun 的真实状态，采用单轴时间线。两者不共享状态绘制逻辑。静态设计稿记录 `aria-current`、`aria-disabled`、hover/focus 的实现合同，但动态交互、焦点管理与无障碍行为必须在应用实现阶段另行验证。

## 官方链接

- [Ant Design Steps](https://ant.design/components/steps/)
- [Element Plus Steps](https://element-plus.org/en-US/component/steps.html)
- [Carbon Progress Indicator](https://carbondesignsystem.com/components/progress-indicator/style/)
- [PatternFly Progress Stepper](https://pf6.patternfly.org/components/progress-stepper/)
- [MUI Stepper](https://mui.com/material-ui/react-stepper/)
- [GitHub Actions workflow run logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs)
- [Vercel deployment overview](https://vercel.com/docs/deployments/overview)
- [Vercel managing deployments](https://vercel.com/docs/deployments/managing-deployments)
- [Cloudflare Pages debugging](https://developers.cloudflare.com/pages/configuration/debugging-pages/)
