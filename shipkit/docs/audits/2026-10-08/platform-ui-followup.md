# Shipkit 后续六项交互调整与验收

完成时间：2026-10-09 00:03（Asia/Shanghai）。当前本机工作台已加载本轮构建：Web `127.0.0.1:8769`，API `127.0.0.1:8770`。沿用 TWGG 已完成任务 `cmuzi71n00004x84w03xr4xtu`、版本 `0.0.2`，在真实历史及归档日志上验收。

## 逐项结果

| 项 | 最终行为 | 实际验收与证据 | 结果 |
| --- | --- | --- | --- |
| 1 | 回滚行展示「恢复至 · sha256:…」，hover 或键盘 focus 显示完整镜像引用，右侧复制 icon；不展开行 | [桌面气泡](platform-ui-followup/rollback-tooltip-desktop.png)、[320px 气泡](platform-ui-followup/rollback-tooltip-320.png)。复制成功反馈、复选框仍选中；320px 复制按钮 44×44，右边界270px，弹窗正文宽度/滚动宽度均288px | 通过 |
| 2 | 本次归档镜像和当前镜像复用同一短摘要、完整气泡、复制 icon | [桌面完整气泡](platform-ui-followup/image-tooltip-desktop.png)、[390px 镜像列表](platform-ui-followup/images-390.png)。没有镜像展开结构，6个复制按钮均44×44；页面宽度390px，无横向溢出 | 通过 |
| 3 | 易读日志正文白底；当前视图用深绿底、白字和勾标识，步骤/完成/警告/错误各有颜色 | [构建日志桌面](platform-ui-followup/log-build-desktop.png)、[手机日志](platform-ui-followup/log-390.png)。实测正文背景为白色，原始文本切换仍可用，完整日志读取后允许下载 | 通过 |
| 4 | 日志是非 modal 面板，无遮罩、不锁滚动；页面点击不同阶段直接切换；小屏提供阶段选择器 | 桌面实际从创建构建机切到构建镜像，页面步骤中心可点击，未产生 aria-modal 或 body overflow 锁。390px 同样点击页面步骤切换，再用选择器切到推送镜像；标题、正文、服务筛选同步更新。另有[768px 布局](platform-ui-followup/log-768.png) | 通过 |
| 5 | 日志底部按「阶段结果与检查证据」及「远端任务与已载入事件」分组，各服务/任务独立显示状态、时间和关键字段；原始 JSON 保留在技术详情 | [服务结果](platform-ui-followup/log-structured-results-desktop.png)、[远端任务](platform-ui-followup/log-structured-tasks-desktop.png)。真实构建结果3项、任务3项、已载入事件235条；任务显示服务、Agent用途、状态、时间、ID和游标，事件按类型汇总后展开 | 通过 |
| 6 | 导航新增「资源管理 → Agent 资源」，集中管理已有配置连接；标明运行时机器/构建机器、关联项目和部署目标，支持连接检查及进入项目配置 | [检查结果桌面](platform-ui-followup/agents-checked-desktop.png)、[手机资源页](platform-ui-followup/agents-390.png)。全局入口清除 project/task 参数；搜索 agent 可命中菜单；TWGG关联入口进入其连接与配置 | 通过 |

## 已有 Agent 的真实检查

按照用户选择「先管理已有配置中的 Agent」实现。列表直接聚合已注册项目配置，同一端点合并展示，多用途保留所有项目关联；没有新增/编辑连接表单或资源创建动作。项目配置读取失败独立显示，不阻断其他连接。

| 端点 | 配置用途及关联 | 2026-10-09 检查结果 |
| --- | --- | --- |
| `http://127.0.0.1:17410` | 运行时机器；TWGG prod，显示名称「腾讯云81.70.201.31」 | 00:02:12，1/1关联可用；实际角色运行、凭据权限运行，Agent0.5.0、Docker可用 |
| `http://127.0.0.1:19741` | 运行时机器与构建机器；首次取消验收、Shipkit隔离验收项目各2个关联 | 00:02:54，4/4关联可用；实际角色与凭据权限均运行与构建，Agent0.5.0、Docker可用 |

连接端点可能是本机转发或SSH隧道，不当作实际机器IP。连接检查只访问已有配置的状态接口，并按每个关联的凭据分别验证；版本、角色、Docker在检查前保持「未确认」。结果是当时的检查快照。按需构建配置独立展示为创建策略，不计为已有机器。

## 必要修复与边界

浏览器发现共享 Tooltip 在动画首挂载前测量，导致气泡停在0,0；Modal内气泡挂到body还会被inert；默认nowrap使长引用横向溢出。本轮修复实际挂载后的测量、滚动/resize/尺寸变化跟随、视口边缘限制、所属Modal层挂载及换行。Popover仅接入新的浮层ref绑定，保留原有坐标策略。320px回滚行另修正Grid最小内容宽度，避免复制图标被挤出弹窗。

日志切换按任务/阶段/服务隔离，旧请求不能覆盖新阶段正文；切换阶段会重置服务筛选、显示方式和游标。全局Agent页不触发项目详情或发布任务查询。API拒绝客户端传入任意地址，只检查当前工作区既有配置，并在检查时再次确认端点未变。

## 自动检查

完整日志保存在 `/tmp/codex-tool-runs/svton/platform-ui-followup/`；这里只列完成结果。

| 检查 | 结果 | 日志 |
| --- | --- | --- |
| Web测试 | 45/45 | `root-web-tests-final.log` |
| API测试（含隔离SQLite与真实HTTP集成） | 7/7 | `agents-api-all-tests.log` |
| 平台Agent发现/检查测试 | 1/1 | `agents-platform-tests.log` |
| 共享UI完整测试 | 127/127 | `root-ui-tests-final.log` |
| Web/API/UI类型检查及Shipkit/API/UI/Web构建 | 通过 | `agents-*-typecheck.log`、`tooltip-typecheck.log`、`root-*-build*.log` |
| 维护源码行数与补丁空白检查 | 131个源码文件最大192行，无超过200行文件；git diff --check通过 | 源码限定统计 |

浏览器证据JSON：`browser-images-final.json`、`browser-rollback-final.json`、`browser-final-small-screen.json`、`browser-log-switch.json`、`browser-log-evidence.json`、`browser-mobile.json`、`browser-tablet.json`、`browser-agents-final.json`。桌面1440、平板768、手机390及回滚320px已检查；截图均实际打开查看。

SQLite只读前后对照：任务23、计划24、活动任务0。TWGG仍保留失败0.0.1与成功0.0.2，后者运行端版本`muzihzxx-64466737`；本轮没有新增业务发布、回滚、数据库迁移或云构建机。业务源代码版本c788de3未重发。
