# Pipewright 参考原型：验证记录

日期：2026-09-20。验证对象：当前 V3 原型增量。仅本地模拟，不是 Devpilot 生产验收。

## 自动检查

- `npm run build`：通过，包含 Sites 产物准备。
- `node --test tests/delivery-scenario.test.mjs tests/sites-worker.test.mjs`：9/9 通过，0 跳过。包含新制品证明、未知结果禁止重放、重复 resume、分批中止、恢复历史与访问验收，以及既有 Sites 测试。
- 新增 DeliveryScenarioFlow / DeliveryScenarioConfirm 的 Impeccable detector：exit 0，空结果。非全站视觉/无障碍合规声明。
- 新增/修改文档本地相对链接检查：0 错误。
- 新增状态、Hook、视图、确认层及样式文件均少于 200 行。改动集中在原型，无生产应用/API 修改。

完整构建和测试日志：`/tmp/codex-tool-runs/svton/pipewright-prototype-{build,tests}.log`；detector：`pipewright-prototype-detect.json`。

## 实际浏览器交互

本机 Vite 4183，ego-browser task space 21。

| 检查 | 观察结果 |
|---|---|
| 发布列表 → R-1042 | 在原有发布详情框架打开增量流程 |
| B 预发 → 生产确认 | A/B 证明区分；确认后模拟中断，保留 PR-1042 |
| 核对 → 继续 → 访问重验 | 先确认未执行才出现继续；部署完成后仍提示入口未通过；重验后交付完成 |
| 刷新再进入 | 完成状态及中断状态均成功读回；unknown 状态没有直接 resume 按钮 |
| 首批继续 | 第 2 台失败，第 3 台未执行；目标表呈现各版本 |
| 中止后续 | app-01 保留 1.4.0，其他主机保持 1.3.2，不假装全量回滚 |
| 恢复确认 | 保留原运行、追加恢复事件；原生产阶段明确“原运行未成功” |
| 操作对话框 | 焦点进入 dialog；取消/确认可操作 |
| 旧流程切换 | 原有“发布输入”与入口配置流程仍可达 |
| 390px 窄屏 | document scrollWidth=390，无横向溢出；关键操作可见 |
| 1440px 桌面 | 页面宽度无横向溢出，发布事实和目标表可读 |

## 截图

- [桌面发布](desktop.png)
- [窄屏分批](mobile.png)
- [恢复后保留原运行失败](recovered.png)
- [确认对话框](confirm.png)

本次已打开检查桌面、窄屏和恢复截图。没有真实并发、审批、SSH/Worker、SCM PR、DNS/TLS 或生产数据库验收；目标实现要求见技术方案。
