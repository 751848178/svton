import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Svton',
  description: '基于 NestJS + Next.js + Taro 的全栈 Monorepo 脚手架 + AI Agent 平台',
  lang: 'zh-CN',
  base: '/svton/',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Svton',

    nav: [
      { text: '首页', link: '/' },
      { text: '快速开始', link: '/start/' },
      { text: '框架', link: '/framework/' },
      { text: 'AI Agent', link: '/agent/' },
      { text: '包参考', link: '/packages/' },
    ],

    // 分区侧栏:每个区只显示自己的导航,避免全量信息过载。
    sidebar: {
      // 首页 / 兜底:四区导览
      '/': [
        {
          text: '🧭 文档导览',
          collapsed: false,
          items: [
            { text: '快速开始', link: '/start/' },
            { text: 'Svton 框架', link: '/framework/' },
            { text: 'AI Agent', link: '/agent/' },
            { text: '包参考', link: '/packages/' },
          ],
        },
      ],

      // ── 快速开始 ──
      '/start/': [
        {
          text: '🚀 快速开始',
          collapsed: false,
          items: [
            { text: '概览', link: '/start/' },
            { text: '快速开始', link: '/start/quick-start' },
            { text: '项目概览', link: '/start/overview' },
            { text: '环境准备', link: '/start/prerequisites' },
            { text: '项目初始化', link: '/start/initialization' },
          ],
        },
      ],

      // ── Svton 框架 ──
      '/framework/': [
        {
          text: '🏗️ 架构',
          collapsed: false,
          items: [
            { text: '框架概览', link: '/framework/' },
            { text: '整体架构', link: '/framework/architecture/overview' },
            { text: 'Monorepo 结构', link: '/framework/architecture/monorepo' },
          ],
        },
        {
          text: '🛠️ CLI (@svton/cli)',
          collapsed: false,
          items: [
            { text: 'CLI 命令行', link: '/framework/cli' },
          ],
        },
        {
          text: '🔧 后端开发',
          collapsed: true,
          items: [
            { text: '模块开发', link: '/framework/backend/modules' },
          ],
        },
        {
          text: '🚢 部署运维',
          collapsed: true,
          items: [
            { text: '环境配置', link: '/framework/deployment/environment' },
            { text: 'Docker 部署', link: '/framework/deployment/docker' },
          ],
        },
        {
          text: '📐 规范',
          collapsed: true,
          items: [
            { text: '编码规范', link: '/framework/coding-standards' },
          ],
        },
      ],

      // ── AI Agent ──
      '/agent/': [
        {
          text: '🤖 AI Agent',
          collapsed: false,
          items: [
            { text: '概览', link: '/agent/' },
            { text: '集成指南', link: '/agent/integration' },
          ],
        },
        {
          text: 'agent-sdk',
          collapsed: true,
          items: [
            { text: '总览', link: '/agent/sdk/' },
            { text: 'React SDK', link: '/agent/sdk/react' },
          ],
        },
        {
          text: 'agent-core',
          collapsed: true,
          items: [
            { text: '总览', link: '/agent/core/' },
            { text: 'Provider 提供商', link: '/agent/core/provider' },
            { text: '工具系统', link: '/agent/core/tools' },
            { text: 'AgentRuntime', link: '/agent/core/runtime' },
            { text: '记忆系统', link: '/agent/core/memory' },
            { text: '自动化任务', link: '/agent/core/automation' },
            { text: '子代理', link: '/agent/core/subagent' },
            { text: '多 Agent 开发架构', link: '/agent/core/multi-agent-architecture' },
            { text: 'MCP 协议', link: '/agent/core/mcp' },
            { text: '权限系统', link: '/agent/core/permission' },
            { text: '生命周期钩子', link: '/agent/core/hooks' },
            { text: '规划系统', link: '/agent/core/planning' },
            { text: '技能系统', link: '/agent/core/skills' },
            { text: '自定义 Agent', link: '/agent/core/agent-definition' },
            { text: '第三方集成', link: '/agent/core/integrations' },
          ],
        },
        {
          text: 'agent-client',
          collapsed: true,
          items: [
            { text: '总览', link: '/agent/client/' },
            { text: 'React Hooks', link: '/agent/client/hooks' },
            { text: 'Service 层', link: '/agent/client/services' },
          ],
        },
        {
          text: 'agent-ui 组件库',
          collapsed: false,
          items: [
            { text: '总览', link: '/agent/ui/' },
            { text: 'ChatPanel', link: '/agent/ui/chat-panel' },
            { text: 'ChatMessage', link: '/agent/ui/chat-message' },
            { text: 'ChatInput', link: '/agent/ui/chat-input' },
            { text: 'ToolCallCard', link: '/agent/ui/tool-call-card' },
            { text: 'SettingsView', link: '/agent/ui/settings' },
            {
              text: '消息块 Demo',
              collapsed: true,
              items: [
                { text: 'Plan 计划进度', link: '/agent/ui/blocks/plan' },
                { text: 'FileChange 文件变更', link: '/agent/ui/blocks/file-change' },
                { text: 'Subagent 子代理', link: '/agent/ui/blocks/subagent' },
                { text: 'Warning 警告', link: '/agent/ui/blocks/warning' },
                { text: 'Reference 引用', link: '/agent/ui/blocks/reference' },
                { text: 'WebSearch 搜索', link: '/agent/ui/blocks/web-search' },
                { text: 'Progress 进度', link: '/agent/ui/blocks/progress' },
                { text: 'TurnDiff 变更汇总', link: '/agent/ui/blocks/turn-diff' },
                { text: 'Command 操作按钮', link: '/agent/ui/blocks/command' },
                { text: 'FileTree 目录树', link: '/agent/ui/blocks/file-tree' },
                { text: 'RedactedThinking 隐藏思考', link: '/agent/ui/blocks/redacted-thinking' },
                { text: 'DiffView', link: '/agent/ui/blocks/diff-view' },
                { text: 'CodeBlock', link: '/agent/ui/blocks/code-block' },
              ],
            },
          ],
        },
        {
          text: 'agent-platform',
          collapsed: true,
          items: [
            { text: '总览', link: '/agent/platform/' },
            { text: 'Tauri 平台', link: '/agent/platform/tauri' },
          ],
        },
        {
          text: '应用',
          collapsed: false,
          items: [
            { text: 'agent-app(开箱即用)', link: '/agent/app/' },
            { text: 'agent-app 快速开始', link: '/agent/app/quick-start' },
            { text: 'agent-web 应用', link: '/agent/web/' },
          ],
        },
      ],

      // ── 包参考(A–Z 扁平索引)──
      '/packages/': [
        {
          text: '📦 包参考',
          collapsed: false,
          items: [
            { text: '索引', link: '/packages/' },
            { text: 'api-client', link: '/packages/api-client' },
            { text: 'authz', link: '/packages/authz' },
            { text: 'dynamic-config', link: '/packages/dynamic-config' },
            { text: 'hooks', link: '/packages/hooks' },
            { text: 'logger', link: '/packages/logger' },
            { text: 'service', link: '/packages/service' },
            { text: 'taro-ui', link: '/packages/taro-ui' },
            { text: 'types', link: '/packages/types' },
            { text: 'ui', link: '/packages/ui' },
          ],
        },
        {
          text: 'NestJS 模块',
          collapsed: true,
          items: [
            { text: 'nestjs-authz', link: '/packages/nestjs-authz' },
            { text: 'nestjs-cache', link: '/packages/nestjs-cache' },
            { text: 'nestjs-config-schema', link: '/packages/nestjs-config-schema' },
            { text: 'nestjs-http', link: '/packages/nestjs-http' },
            { text: 'nestjs-logger', link: '/packages/nestjs-logger' },
            { text: 'nestjs-oauth', link: '/packages/nestjs-oauth' },
            { text: 'nestjs-payment', link: '/packages/nestjs-payment' },
            { text: 'nestjs-queue', link: '/packages/nestjs-queue' },
            { text: 'nestjs-rate-limit', link: '/packages/nestjs-rate-limit' },
            { text: 'nestjs-redis', link: '/packages/nestjs-redis' },
            { text: 'nestjs-sms', link: '/packages/nestjs-sms' },
            { text: 'nestjs-object-storage', link: '/packages/nestjs-object-storage' },
            { text: 'nestjs-object-storage-qiniu-kodo', link: '/packages/nestjs-object-storage-qiniu-kodo' },
            { text: 'nestjs-object-storage-tencent-cos', link: '/packages/nestjs-object-storage-tencent-cos' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/751848178/svton' },
    ],

    footer: {
      message: 'Svton - 全栈 Monorepo 脚手架 + AI Agent 平台',
      copyright: 'MIT License',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },

    outline: {
      label: '页面导航',
      level: [2, 3],
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    lastUpdated: {
      text: '最后更新于',
    },

    editLink: {
      pattern: 'https://github.com/751848178/svton/edit/master/docs/:path',
      text: '在 GitHub 上编辑此页',
    },
  },

  markdown: {
    lineNumbers: true,
  },
});
