# Devpilot 全站 UI 走查记录（第一轮 · 基于真实渲染）

> | 项 | 内容 |
> | --- | --- |
> | 评估时间 | 2026-08-21 ~ 2026-08-22 |
> | 评估方式 | ego-browser 真实浏览器走查（登录态：System Administrator），逐页截图 + DOM 验证 |
> | 运行实例 | `http://localhost:3120`（web）+ `http://localhost:3121`（api，Docker 部署） |
> | 截图归档 | `evaluation/screenshots/2026-08-22/`（25 张，文件名 = 路由名） |
> | 对比基线 | `evaluation/devpilot-ux-evaluation-2026-07-25.md`（纯源码静态审计） |

## 1. 总体判断

相比 2026-07-25 的静态审计结论有实质进步：列表检索/分页基本补齐，项目工作台结构符合设计契约，发布单详情的决策卡设计到位。当前的主要问题集中在**执行层整洁度**：渲染缺陷、文案不一致、技术概念泄漏三类，具有平台级传染性。

### 已改善项（旧报告问题已闭环）

- 项目列表 / 发布单 / 资源申请：搜索框 + 筛选 + 排序 + 分页均已落地（`projects.png`、`wb-releases-view.png`、`resource-requests.png`）
- 项目工作台五个目的地：`项目信息 / 发布 / 项目配置 / 域名与入口 / 部署记录`，与 workbench 契约一致
- 项目配置 rail：`版本 / 部署目标 / 资源绑定 / 变量与密钥 / 访问权限 / 验证与监控` + 环境单选，符合契约（`wb-settings.png`）
- 上下文问题行采用"紧凑行 + 行内动作"（"生产环境缺少可用入口 → 配置生产入口 →"、"两套环境组件不一致 → 查看组件差异 →"）
- 发布单详情：决策卡（先处理当前阻断）+ 阶段 stepper + 右侧证据栏（`release-order-detail.png`）
- 操作审批：新增超时警告（"该审批已等待超过 24 小时"）与"未附带代码差异摘要"提示（`operation-approvals.png`）
- 资源实例页：不再平铺 credentials 明文，改为"含凭证"标记（`resource-instances.png`）
- 密钥中心 reveal 模式保持完好（`keys.png`）

## 2. 本轮新发现问题清单

### P1 渲染缺陷 / 可用性 bug

| # | 问题 | 证据 | 说明 |
| --- | --- | --- | --- |
| F1 | 项目列表表头与单元格标签重复渲染 | `projects.png` + DOM 验证 | div 伪表格，表头行有列名，每个单元格内又渲染一遍（"项目形态""环境基线""PRODUCTION""最近活动"），疑似响应式卡片 label 在桌面端未隐藏 |
| F2 | 监控页"资源指标"面板整块空白无空态 | `monitoring.png` | 半页白盒，仅有 15m/1h/6h/24h 切换器；右侧服务 SLO 全为"无数据 / -" |
| F3 | "查看发布单"是 button 伪装链接 | DOM 验证：`button.text-primary.hover:underline` | 不能新标签打开 / 不能复制链接；点击后 URL 会更新（`?releaseOrderId=...`）深链可用，但元素语义错误 |

### P2 一致性 / 信息翻译

| # | 问题 | 证据 | 说明 |
| --- | --- | --- | --- |
| F4 | 导航文案 ≠ 页面 H1 | `resource-control.png` | 侧边栏"资源操作" vs 页面"资源管控" |
| F5 | 面包屑混用 raw ID 与英文 | `wb-release.png` | `项目 / cmrwxl1k... / Publish` |
| F6 | 项目列表列头 "PRODUCTION" 英文大写 | `projects.png` | 全站中文语境下的突兀英文 |
| F7 | 后端概念泄漏到 UI | `resource-requests.png`、`wb-deployments-view.png`、`wb-releases-view.png` | 状态列 `已交付 + pool · 处理完成` 双标签；部署来源显示原始枚举 `release_order / API`；发布单名称/版本号重复（"0.0.1 / 0.0.1"）+ raw cuid 直接展示 |
| F8 | 发布向导环境卡片混乱 | `wb-release.png` | "生产"与"Production"两张卡并存（数据层重复环境直接暴露）；所有环境挂"待检查"但无检查内容说明 |
| F9 | 资源操作页违反"集合用表格"原则 | `resource-control.png` | 每个 Docker 容器一张大卡，卡内重复 4 组相同操作（详情/日志/指标/重启 + 风险 tag + 演练/执行按钮） |
| F10 | 审计事件被轮询噪音淹没 | `audit-events.png` | 100 条全是 `docker.container.stats blocked` 低风险事件，执行人列全为 "-" |
| F11 | 审批单标题拼接后端标识符 | `operation-approvals.png` | `release-2026-07-30T11:17 / 应用部署 - admin (application_deploy:cmrwxma81...)` |

### P3 细节打磨

| # | 问题 | 证据 | 说明 |
| --- | --- | --- | --- |
| F12 | 密钥描述泄漏内部开发备注 | `keys.png` | "seed.js ignores; resolves $DEVPILOT_* placeholder" 直接展示 |
| F13 | CDN 页"添加凭证"与"添加"按钮并列 | `cdn-configs.png` | "添加"语义不明 |
| F14 | 仪表盘统计卡不可点击下钻 | `dashboard.png` | 旧报告问题仍在 |
| F15 | 团队页布局宽度与其他页不一致 | `teams.png` | 内容居中窄列 vs 其他页全宽 |
| F16 | 文档站首屏仍"待补充" | `docs.png` | 旧报告问题仍在 |
| F17 | 资源申请页"交付运行治理"全 0 仍占大版面 | `resource-requests.png` | 7 个 0 计数卡 + 运维语言按钮（"处理下一条队列/恢复超时运行"）出现在用户申请页 |
| F18 | Tab URL 策略混用 | 链接验证 | 发布/部署记录用 `?view=` 查询参数，项目配置/域名与入口用独立路由 |

## 3. 优化建议（按投入产出排序）

1. **立即**：修 F1 表格 label 重复；F2 监控面板补空态/真实数值；F3 导航动作改回 `<a>`
2. **立即**：统一"导航文案 = H1 = 面包屑"单一事实源（F4/F5/F6）
3. **短期**：建立"技术 ID 折叠规则"——cuid / Manifest / BuildRun / 枚举值一律进详情展开区，主文案只保留业务语言（F7/F10/F11/F12）
4. **短期**：资源操作页改表格 + 操作列（≤3 直出 + 省略号菜单）（F9）
5. **中期**：发布向导环境卡片合并重复环境、"待检查"给可展开的检查项说明（F8）
6. **中期**：审计/日志加来源归属列与关键字过滤，屏蔽轮询噪音事件（F10）
7. **持续**：F13~F18 逐页打磨

---

*第二轮（项目模块六子域深度评审）见 `devpilot-project-module-review-2026-08-22.md`。*
