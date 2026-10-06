# 当前应用布局对齐核验

- 依据当前应用源码完成目录、项目 Header、基本信息、折叠仓库、三个同页 Tab 和配置入口调整。
- 浏览器实测：目录搜索空态及清空、环境列勾选刷新保留、环境 Tab 刷新恢复、组件入口、配置和域名面板、R-1042 改进情景均可达。
- 1440px 桌面截图 directory.png / overview.png；390px 手机截图 mobile-directory.png / mobile-overview.png。
- 手机项目首页的 grid 最小宽度已修复；清除旧 CSS 缓存后页面无横向撑宽，宽表格在内部滚动。
- 构建通过；9 个现有情景/托管回归测试通过。日志 /tmp/codex-tool-runs/svton/prototype-layout-build.log 和 prototype-layout-tests.log。
- 仅修改交互原型与文档；真实服务未启动，布局对齐依据源码，不表示生产运行验收。缺少的基本信息以 — 呈现。
