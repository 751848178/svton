# Devpilot 项目模块走查报告：项目信息 / 环境版本 / 部署记录

- 走查时间：2026-08-22
- 走查人：UX 走查员（ego-browser 真实点击）
- 目标站点：`http://localhost:3120`，项目 Picshare（id `cmrwxl1ks000k6enjiclutd5a`），账号 System Administrator
- 视口：1800x1009 全量走查 + 1280x800 响应式复查
- 截图目录：`evaluation/screenshots/2026-08-22/full-audit/`（info- 前缀 = 项目信息，ev- = 环境版本，deploy- = 部署记录，-1280 后缀 = 窄视口）

## 范围说明（重要）

任务书预期「项目信息 view」包含**环境卡片、版本列表、资源绑定**等区块，但当前线上版本的默认 view 只包含：项目信息摘要（仓库/默认分支/发布策略）、项目组件表、仓库解析与审核。环境/版本/资源绑定区块已不在此 view（疑似随发布工作台改版迁移）。隐藏 view `?view=environment-versions` 已失效（见 EV-1）。本报告覆盖的是当前实际渲染的全部 UI。

## 交互元素覆盖清单

### A. 项目信息 view（`/projects/:id` 默认 view）

| 区域 | 元素 | 结果 |
|---|---|---|
| 面包屑 | 「项目」链接 | 正常，跳转 /projects |
| 面包屑 | 项目名位置显示 `cmrwxl1k…` | 问题 INFO-3 |
| 页头 | 仓库地址文本（含链接样式图标） | 问题 INFO-10（纯文本不可点不可复制） |
| 页头 | 「创建发布」按钮 | 正常，跳转 `?view=releases&create=true` 并弹出创建发布 dialog，点「取消」正常关闭（截图 info-create-release-nav-01） |
| 工作台导航 | 项目信息 / 发布 / 项目配置 / 域名与入口 / 部署记录 5 个 tab | 正常，均可切换（发布/项目配置/域名与入口内容属其他走查范围） |
| 项目信息摘要 | 发布策略说明图标 ⓘ hover | 问题 INFO-9（合成事件与 CDP 真实 hover 均无可视 tooltip，说明文字只在 aria-label 上） |
| 项目组件表 | 4 个数据行 | 不可点击（cursor: auto），纯展示；表头无排序能力 |
| 项目组件表 | 每行「配置已变更」蓝色文本 ×4 | 问题 INFO-4（text-primary 链接色，实为纯 span，点击无任何反应） |
| 项目组件表 | backend 行「最近识别变更」描述 | 问题 INFO-11（描述为 `Picshare App / admin · node · 3001`，与 admin 行完全相同，端口与 backend 实际 3000 矛盾） |
| 仓库解析与审核 | 区块 summary 展开/折叠 | 正常 |
| 规范仓库身份 | 「验证并更新凭据」按钮 | 问题 INFO-1（点击直接发出 `POST /repository-analysis/connect` 写请求，无确认、无 loading、无结果 toast。走查中实际触发了一次凭据重连，审计事件 2026-08-22 11:17:51「已验证只读仓库」可证；无副作用需回滚） |
| 修订默认分支 | 「生效默认分支」输入框 | 可编辑（未提交） |
| 修订默认分支 | 「修订原因」textarea | 3 字符时提交按钮保持禁用；15 字符时按钮启用（截图 info-branch-revision-filled-01）；按红线未提交 |
| 修订默认分支 | 「提交高风险分支修订」空提交 | 按钮禁用即唯一校验形态，无错误提示文案（可接受，已记录） |
| 修订默认分支 | 「刷新权威状态」按钮 | 问题 INFO-8（点击触发刷新但无任何 loading/成功反馈） |
| 修订默认分支 | 「查看仓库身份审计」链接 | 正常，跳转审计事件页并带 category=仓库分析 过滤（截图 info-audit-link-01） |
| 仓库解析与审核 | 「基于当前 commit 重新解析」按钮 | **未点击**：该按钮无确认弹层、直接触发新解析运行（写操作），按安全红线规避，仅记录存在 |
| 仓库变更识别记录 | 6 条运行记录按钮 | 正常，点击在右侧切换该次运行的步骤详情（master-detail 交互，截图 info-runs-all-expanded-01） |
| 运行详情 | 「查看 1/100/7/12 条证据」折叠 ×4 | 展开/折叠正常；但「查看 100 条证据」实际只渲染 20 条且无加载更多 → 问题 INFO-2（截图 info-evidence-100-01） |
| 建议审核区 | 「技术证据：查看原始建议」×6 | 可展开，内容为 raw JSON dump（含 raw runId `cmsn0i2ju…`）→ 问题 INFO-5（截图 info-tech-evidence-raw-01） |
| 建议审核区 | 接受/编辑后接受/忽略 radio ×18 | 全部 disabled（该次运行已完成审核），只读展示选中态，正常 |
| 建议审核区 | 严重度徽章 `high`/`medium` | 问题 INFO-6（英文枚举与中文「· 有冲突」混排） |
| 建议审核区底部 | 「查看仓库分析审计事件」链接 | 正常跳转；但与「查看仓库身份审计」href 完全相同 → 问题 INFO-7 |

### B. 隐藏 view：`?view=environment-versions`

| 区域 | 元素 | 结果 |
|---|---|---|
| 路由 | `?view=environment-versions` 整页 | 问题 EV-1（静默回退到项目信息 view，无任何提示；源码确认 `environment-versions-panel.tsx` 已无人引用，路由只有 releases/deployments 分支。截图 ev-overview-01） |

### C. 部署记录 view（`?view=deployments`）

| 区域 | 元素 | 结果 |
|---|---|---|
| 列表 | 10 条运行卡片初始展示，无筛选器/排序控件 | 问题 DEP-5（任务书预期的筛选器在当前版本不存在；30 条记录只能「查看全部」一次全展开） |
| 列表行 | 首行来源 `release_order`、无环境徽章；第 3、4 行缺操作人 | 问题 DEP-8（字段口径不一致 + raw 枚举） |
| 列表行 | 「查看记录」链接 ×10 | 正常，跳转 `&runId=` 深链并聚焦该运行（截图 deploy-runid-deeplink-01） |
| 列表行 | 「发布：F383 final closure …」链接 ×9 | 正常，旧格式 `?tab=releases&releasePlanId=` 正确 302 重定向到新 `?view=releases&releasePlanId=` |
| 列表行 | 「详情与日志」按钮 ×10 | 全部可展开/收起，正常（截图 deploy-all-expanded-01） |
| 运行详情 | 已完成运行（2026-08-10）的「执行任务」区块 | 问题 DEP-2（状态自相矛盾，历史问题重现） |
| 运行详情 | 目标类型 `release-artifact`/`server` | raw 英文枚举，并入 DEP-8 |
| 运行详情 | 「运行日志」折叠 | 内容为 raw JSON 数组 → 问题 DEP-6（截图 deploy-logs-result-01） |
| 运行详情 | 「执行结果」折叠 | raw JSON 对象，含 raw manifestId、deploymentUri（拼接 projectId）→ 问题 DEP-6 |
| 失败运行 | 失败原因展示 | 问题 DEP-7（`Connection lost before handshake` 要展开三级才能看到） |
| 已阻塞运行 | 命令计划「敏感值已脱敏」 | 问题 DEP-1（**P0**：明文 DATABASE_URL 密码、JWT_SECRET、BOOTSTRAP_ADMIN_PASSWORD；截图 deploy-secret-plaintext-01；对照组 deploy-secret-leak-01 中另一运行正确 REDACTED） |
| runId 深链 | 聚焦条「已按部署运行聚焦：oc3de5qf（仅显示该运行）」 | 问题 DEP-3（显示截断 ID、无「清除聚焦/查看全部」出口，只能手改 URL 或重进 tab） |
| runId 深链 | 黄色 banner「最近一次部署失败…」 | 问题 DEP-4（聚焦的是 7-31 的历史失败运行，最近一次 8-10 实为已完成，文案与事实矛盾） |
| 分页 | 「查看全部（30）」 | 正常，展开至 30 条；按钮变为「收起」，点击回到 10 条（已验证 30→10） |
| 底部 | 「历史运行技术证据」折叠 | 问题 DEP-9（只有两段说明文字，无任何证据条目；「保留 46 条运行」与列表「全部 30」口径不一致） |

### D. 1280x800 响应式复查

| View | 结果 |
|---|---|
| 项目信息（含仓库解析展开态） | 无横向滚动、表格不溢出（截图 info-overview-1280 / info-analysis-1280）；仓库 URL 折行断词 → 问题 DEP-10 同类（INFO 侧并入 INFO-10 说明） |
| 部署记录（含详情展开态） | 无横向滚动、命令 pre 不溢出（截图 deploy-overview-1280 / deploy-detail-1280）；服务器名 `F383 Picshare Deploy (f383-pi cshare-deploy)` 折行断词 → 问题 DEP-10 |
| environment-versions | 与项目信息同页（EV-1），不单独复查 |

## 问题清单

### INFO-1 「验证并更新凭据」无确认、无反馈直接执行写操作（P1）
- 位置：项目信息 → 仓库解析与审核 → 重新连接只读凭据
- 复现：点击「验证并更新凭据」
- 预期：写操作前给确认，或至少给 loading + 成功/失败 toast
- 实际：点击瞬间发出 `POST /api/projects/:id/repository-analysis/connect` 并重新拉取数据，按钮无 loading、页面无任何提示。用户无法感知操作是否成功（本次走查实际触发了一次凭据重连，审计页可见对应事件）
- 截图：info-credential-after-01.png（点击后页面无任何变化）

### INFO-2 「查看 100 条证据」实际只渲染 20 条且无加载更多（P1）
- 位置：项目信息 → 仓库变更识别记录 → 运行详情 → 文件盘点
- 复现：选中一条运行 → 展开「查看 100 条证据」
- 预期：展示 100 条，或标明「仅展示前 20 条」并提供加载更多
- 实际：列表正好 20 条后戛然而止，摘要却写「已盘点 518 个文件」，三处数字（518/100/20）互相打架
- 截图：info-evidence-100-01.png

### INFO-3 面包屑裸露 raw 项目 ID（P2）
- 位置：两个 view 顶部面包屑
- 实际：显示「项目 / cmrwxl1k…」而非项目名 Picshare（页头 20px 之下就是项目名，信息重复且 ID 无意义）

### INFO-4 「配置已变更」链接样式但不可点击（P2）
- 位置：项目组件表每行「最近识别变更」列
- 实际：`text-primary` 链接蓝色的纯 span，无 href 无 onClick。用户预期点开看变更详情，点了没反应

### INFO-5 技术证据为 raw JSON dump，含 raw runId（P2）
- 位置：确认组件与配置变更 → 每条建议的「技术证据：查看原始建议」
- 实际：直接渲染数千字符的原始 JSON（单个 pre 滚动高度达 18904px），内含 `runId: cmsn0i2ju000b14oy6bk9ir3j` 等 raw ID，无语法高亮之外的任何可读化处理
- 截图：info-tech-evidence-raw-01.png

### INFO-6 严重度徽章英文枚举与中文混排（P2）
- 位置：建议卡片右上角
- 实际：`high · 有冲突`、`medium · 有冲突`——同一徽章内中英混排

### INFO-7 两个不同文案的审计链接指向完全相同地址（P2）
- 位置：「查看仓库身份审计」（修订默认分支区）与「查看仓库分析审计事件」（页底）
- 实际：href 均为 `/audit-events?projectId=…&category=repository_analysis`，冗余

### INFO-8 「刷新权威状态」无任何反馈（P2）
- 实际：点击后无 loading、无 toast、数据无可见变化，与 INFO-1 同类但为只读刷新

### INFO-9 发布策略说明图标无可视 tooltip（P2）
- 实际：说明文字只挂在 aria-label 上，合成事件与 CDP 真实 hover 均未出现可视 tooltip；鼠标用户看不到解释（屏幕阅读器可读到）

### INFO-10 仓库地址纯文本，不可点击不可复制（P2）
- 位置：页头「仓库 https://github.com/...git」，旁有一个形似外链的图标
- 实际：图标 aria-hidden 纯装饰，地址不可点、无复制按钮；1280px 下 URL 折行断词（`…picshare.gi t`）

### INFO-11 backend 组件行的「最近识别变更」描述张冠李戴（P1）
- 位置：项目组件表 backend 行
- 实际：描述为 `Picshare App / admin · node · 3001`（与 admin 行逐字相同），而建议区 backend 的端口是 3000。展示数据自相矛盾，误导用户
- 截图：info-overview-01.png

### EV-1 环境版本管理 view 已失效，URL 静默回退无提示（P1）
- 位置：`/projects/:id?view=environment-versions`
- 预期：渲染环境版本管理面板（任务书指定的隐藏 view）
- 实际：渲染内容与默认项目信息 view 逐字相同，tab 高亮「项目信息」，地址栏保留 `view=environment-versions`，无任何「该页面不存在」提示。源码佐证：`project-route-host.tsx` 只对 `deployments`/`releases` 分流，`environment-versions-panel.tsx` 除自身 spec 外无人引用（死代码）。环境版本管理能力在项目详情中已无任何入口
- 截图：ev-overview-01.png

### DEP-1 已阻塞运行的命令计划明文展示密钥，「已脱敏」声明不实（P0）
- 位置：部署记录 → 已阻塞运行（2026-07-29 11:50）→ 详情与日志 → 命令计划（敏感值已脱敏）→ 3. 写入环境配置
- 实际：标题声称「敏感值已脱敏」，但命令原文包含明文 `DATABASE_URL=mysql://user_db_picshare:65a75047aeb000b0f79bc59af9c7fdf1@…`、`JWT_SECRET=f383-picshare-jwt-secret-dev`、`BOOTSTRAP_ADMIN_PASSWORD=f383-bootstrap-admin-pwd-dev`。同页另一失败运行（2026-07-31）同位置正确显示 `***REDACTED***`——脱敏逻辑对部分历史运行失效，属于凭据泄露
- 截图：deploy-secret-plaintext-01.png（明文）、deploy-secret-leak-01.png（对照组正确脱敏）

### DEP-2 已完成运行详情自称「尚未创建执行任务，可能正在等待审批或被门禁阻断」（P1，历史问题重现）
- 位置：部署记录 → 2026-08-10 已完成运行（release_order）→ 详情
- 实际：状态徽章「已完成」，但执行任务区显示「尚未创建执行任务，可能正在等待审批或被门禁阻断」，审批区「该运行未关联审批单」，应用/服务/服务器均为 `-`。状态与详情完全不自洽

### DEP-3 runId 聚焦条无退出出口且显示截断 ID（P1）
- 位置：部署记录 `&runId=` 深链
- 实际：聚焦条「已按部署运行聚焦：oc3de5qf（仅显示该运行）」——显示的是截断片段而非完整 runId，且整条没有任何「清除聚焦/查看全部」按钮，用户只能手改 URL 或重进 tab 才能回到列表
- 截图：deploy-runid-deeplink-01.png

### DEP-4 「最近一次部署失败」banner 文案与事实矛盾（P1）
- 位置：聚焦历史失败运行时出现在列表顶部
- 实际：聚焦的是 2026-07-31 的失败运行，banner 却写「最近一次部署失败」；列表里最近一次（2026-08-10）是已完成。文案把「当前聚焦的这次」说成「最近一次」，与 DEP-2 同属状态不自洽家族
- 截图：deploy-runid-deeplink-01.png

### DEP-5 部署记录无筛选/排序能力（P1）
- 实际：30 条运行只能 10 条/全部两档展开，不能按环境（dev/staging/production）、状态（失败/已阻塞）、来源、时间筛选或排序。找一个失败运行要靠肉眼翻。任务书预期的筛选器在当前版本不存在

### DEP-6 运行日志与执行结果为 raw JSON，raw ID 裸露（P2）
- 实际：「运行日志」是 JSON 数组原文（`[{"level":"error",…}]`），不是逐行日志样式；「执行结果」是 JSON 对象，含 `manifestId: cmsn2i525…`、`deploymentUri: release-target://cmrwxl1ks…/…` 等拼接 raw ID
- 截图：deploy-logs-result-01.png

### DEP-7 失败原因埋藏过深（P2）
- 实际：失败运行列表行无任何原因摘要，需点「详情与日志」→ 再展开「运行日志」才能看到 `Connection lost before handshake`。失败排查是部署记录的核心场景，原因应至少在详情首屏可见

### DEP-8 列表行字段口径不一致 + raw 枚举（P2）
- 实际：首行来源显示 raw 枚举 `release_order`（其他行为 `API`）；首行无环境徽章（其他行有 `dev`）；第 3、4 行缺操作人（其他行有 System Administrator）；目标类型显示 `release-artifact`/`server` raw 英文

### DEP-9 「历史运行技术证据」无证据内容，口径与列表矛盾（P2）
- 实际：折叠区只有两段说明文字（「保留 46 条运行和 3 条日志证据；74 项旧数据保持未验证」），没有任何证据条目列表；「46 条运行」与列表「查看全部（30）」口径对不上
- 截图：deploy-history-evidence-01.png

### DEP-10 1280px 下长文本折行断词（P2）
- 实际：无横向滚动、无列重叠（历史「1280px 表格列重叠」问题未重现）；但部署详情「服务器」列 `F383 Picshare Deploy (f383-picshare-deploy)` 折行断成 `(f383-pi cshare-deploy)`，项目信息仓库 URL 同样断词。建议长 token 用 truncate + title 而非 break-all
- 截图：deploy-detail-1280.png、info-overview-1280.png

## 走查操作声明

- 走查中唯一实际触发的写操作是「验证并更新凭据」（INFO-1 的复现步骤），其性质为只读凭据重验，审计页已留痕，无配置变更，无需回滚。
- 「提交高风险分支修订」「基于当前 commit 重新解析」按红线未提交/未触发；「创建发布」弹窗打开截图后已取消。
