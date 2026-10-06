# Devpilot Guided Control Plane prototype

## 2026-09-20 发布流程增量

发布列表进入详情后，默认展示 Pipewright 参考改进的交互情景；可切回原有入口配置流程。新制品重验、生产中断续接、分批中止/恢复和访问验证均为本地模拟，保留原有页面结构。功能目标、字段映射与技术方案入口见 [PIPEWRIGHT_PLAN.md](./PIPEWRIGHT_PLAN.md)。这不代表生产应用已实现。

An isolated, clickable vertical slice for judging how the proposed Devpilot design system lands across the product. It does not call production APIs or modify the current Devpilot application. Its deterministic fixtures use the real response shapes and the visible fields follow [`FIELD_CONTRACT.md`](./FIELD_CONTRACT.md), so production wiring does not need a second information model.

## Main journey

1. 从「我的项目」进入目录，搜索、筛选项目并配置可选环境列。
2. 进入项目首页：基本信息 → 默认折叠的仓库详情 → 发布记录 / 环境 / 组件三个同页 Tab。
3. 从页头「项目配置」进入已有环境的版本、目标、资源、密钥、权限、监控和域名配置。
4. 从组件 Tab 进入仓库分析；从发布记录进入部署记录或独立发布详情。
5. R-1042 保留 Pipewright 改进情景：新制品重验、中断续接、分批确认、中止、恢复和入口验证；可切回原有流程。

布局依据当前应用源码；使用本地示例数据。Hash 路由支持刷新与浏览器前进后退，未接生产 API。
最新核验见 [布局 QA](./evidence/2026-09-20-project-layout/QA.md)。

All business operations are intentionally handled in a modal or drawer. Navigation remains page-level: the release list opens a standalone release detail page, while actions on that detail stay in context.

## Brand asset

- Source: `../../project-module-v2/assets/devpilot-cube-mark.png`
- Optimized prototype copy: `public/devpilot-cube-mark.png`

## Local preview

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4183 --strictPort
```

## Evidence

- `implementation-desktop.png`
- `implementation-mobile.png`
- `implementation-config.png`
- `implementation-release.png`
- `implementation-operation-drawer.png`
- `implementation-ai-drawer.png`
- `implementation-mobile-release.png`
- `audit-2026-08-27-detail-polish/01-before-detail-desktop.png`
- `audit-2026-08-27-detail-polish/02-after-detail-desktop.png`
- `audit-2026-08-27-detail-polish/03-after-detail-mobile.png`
- `audit-2026-08-27-detail-polish/04-after-staging-detail-desktop.png`
- `audit-2026-08-27-detail-polish/05-after-release-list-desktop.png`
- `audit-2026-08-27-step-details/03-project-warning-top.png`
- `audit-2026-08-27-step-details/04-production-mobile.png`
- `audit-2026-08-27-step-details/05-build-mobile.png`
- `audit-2026-08-27-step-details/06-production-desktop.png`
- `audit-2026-08-27-step-details/07-build-desktop.png`
- `audit-2026-08-27-four-stage-consistency/01-light-shell-desktop.png`
- `audit-2026-08-27-four-stage-consistency/02-four-stage-release-desktop.png`
- `audit-2026-08-27-four-stage-consistency/03-config-select-table-desktop.png`
- `audit-2026-08-27-four-stage-consistency/04-four-stage-release-mobile.png`
- `audit-2026-08-27-project-information/02-after-project-information-desktop.jpg`
- `audit-2026-08-27-project-information/03-environment-version-drawer.jpg`
- `audit-2026-08-27-project-information/04-after-project-information-mobile.png`
- `audit-2026-08-27-project-information/05-environment-versions-mobile.png`
- `audit-2026-08-27-field-contract/overview-desktop.png`
- `audit-2026-08-27-field-contract/release-detail-desktop.png`
- `audit-2026-08-27-field-contract/mobile-navigation.png`
- `audit-2026-08-27-field-contract/overview-mobile.png`
- `design-qa.md`
