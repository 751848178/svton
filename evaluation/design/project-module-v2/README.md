# Devpilot 项目模块 V2 代表页

本目录实现用户选定的「方向 1 主体 + 方向 3 Header」。设计不是状态标本或说明板，而是十个独立、可操作的产品时刻：

- `V2-01 Project Directory`：紧凑项目目录，展示纯文本运行状态、活动组件、线上版本、Production 主域名和真实行级操作。
- `V2-02 Version Configuration`：生产环境已有版本选择，显示切换资格、发布证据、明确空态和折叠技术标识。
- `V2-03 Production Preflight Blocked`：Picshare R1 预发完成后的生产预检阻断，聚焦 DNS/TLS 真实探测证据与重新检查动作。
- `V2-04 Project Overview`：当前生产、最近发布、运行组件和唯一近场 blocker。
- `V2-05 Release Orders`：基于真实列表字段的六行发布单目录，包含版本、来源、粗状态、当前阶段和固定操作列。
- `V2-06 Staging Deployment Running`：R1 预发 DeploymentRun 进行中的运行级进度和状态摘要。
- `V2-07 Production Release Review`：当前生产与候选发布核对，明确预发证据不会写入生产状态。
- `V2-08 Awaiting Approval`：只展示待审批请求、请求人、请求时间、风险摘要与审批责任，不创建生产部署。
- `V2-09 Production Success`：审批通过后完成生产部署、入口探测，并创建当前环境版本。
- `V2-10 Deployment Evidence Drawer`：复用 V2-09 成功页作为底图，在同页以 scrim 和右侧 Drawer 展示生产证据。

## 视觉与交互约束

- 十个根画板均为 `1440 × 1024`。
- 顶栏固定 `64px`：蓝色几何 cube mark、Devpilot、Test Org，以及靠右组合的搜索、通知红点、帮助和 `SY`。
- 项目详情标题直接显示项目名与仓库信息，不使用重复的 folder 图标槽位。
- 每帧只有一个实心主操作；问题修复动作紧邻问题，不使用泛化的「立即处理」。
- 表格行高为 `56–59px`，行级操作使用文字动作和可聚焦的 ellipsis。
- 页面正文、表格值与证据标签以 `12–14px` 为主，页面标题为 `21–26px`。
- 页面主体不以内部状态 ID、API 或路由为主视觉；运行与制品等技术标识仅在证据抽屉按需展示，不出现设计注释或说明 footer。
- 发布阶段使用中线连接的节点 stepper：完成态为浅蓝节点与连线，正常当前态为深蓝节点，待选择态为较深灰，禁用态为接近白色的浅灰，阻断态为红色；进度状态不使用绿色表达完成。
- V2-06 的执行进度使用纵向节点与连接线，只展示 DeploymentRun 可证明的运行级状态：运行已创建、执行器运行中、结果与证据待写入；不把尚未持久化的执行器内部微步骤伪装成实时事件。右侧内容由当前 run status 派生，不伪装成运行中日志；终态日志仅在执行完成后展示并按策略保留。

## 核心交互合同

| 页面 | 核心动作 | 下一状态 |
| --- | --- | --- |
| V2-01 | 创建项目；行内进入项目、发布或精确修复 | 进入项目接入流程、项目工作台或对应配置页 |
| V2-02 | 切换版本 | 创建一次受审计的部署操作；当前版本不可重复切换 |
| V2-03 | 重新检查生产预检 | 重新计算门禁；全部通过后才允许创建生产审批 |
| V2-04 | 创建发布 | 创建发布单并进入发布详情 |
| V2-05 | 创建发布；行内查看发布证据 | 进入新发布或既有发布单详情 |
| V2-06 | 查看运行详情 | 查看当前预发 DeploymentRun 的整体状态；完成后再展示终态结果与日志 |
| V2-07 | 提交生产审批 | 创建待审批 OperationApproval，不创建生产运行 |
| V2-08 | 无重复提交主动作 | 审批决定后进入生产执行或终止发布 |
| V2-09 | 打开生产站点 | 在已生效 EnvironmentVersion 上验证生产入口 |
| V2-10 | 关闭证据抽屉 | 返回同一生产成功页；日志和原始证据默认收起 |

## 维护与生成

`src/*.js` 按 tokens、基础控件、全局壳层、项目壳层和页面拆分，每个维护源文件不超过 200 行。`project-module-v2.generated.js` 是生成物，不直接编辑。

Header 的 RGBA cube mark 位于 `assets/devpilot-cube-mark.png`。`inject-assets.mjs` 会把这个独立透明资产以内嵌 data URI 注入十个品牌容器，避免 OpenPencil 0.8.4 将本地路径渲染为 broken-image。

```bash
node evaluation/design/project-module-v2/build.mjs
op start --file evaluation/design/project-module-v2/project-module-v2.op
op design @evaluation/design/project-module-v2/project-module-v2.generated.js
node evaluation/design/project-module-v2/stabilize-version-board.mjs
node evaluation/design/project-module-v2/inject-assets.mjs
op save evaluation/design/project-module-v2/project-module-v2.op
```

`stabilize-version-board.mjs` 会复制后替换版本配置根画板，以规避 OpenPencil 0.8.4 对中间大画板首次插入时偶发的壳层遗漏；替换后文档仍只有十个根画板。V2-10 的 Drawer 必须保持在 `layout:none` 根的前置层级，这是 0.8.4 导出的实际层叠顺序。导出必须逐帧串行执行，避免并行导出遗漏字体或壳层文本。

Canonical 导出位于 `exports/`，命名为 `V2-01-*.png` 至 `V2-10-*.png`；每个根画板只保留一张同名 PNG。
