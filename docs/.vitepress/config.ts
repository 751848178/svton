import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Svton',
  description: '基于 NestJS + Next.js + Taro 的全栈 Monorepo 脚手架',
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
      { text: '快速开始', link: '/getting-started/quick-start' },
      { text: '架构设计', link: '/architecture/overview' },
      { text: '共享包', link: '/packages/types' },
    ],

    sidebar: {
      '/': [
        {
          text: '🚀 入门指南',
          collapsed: false,
          items: [
            { text: '快速开始', link: '/getting-started/quick-start' },
            { text: '项目概览', link: '/getting-started/overview' },
            { text: '环境准备', link: '/getting-started/prerequisites' },
            { text: '项目初始化', link: '/getting-started/initialization' },
          ],
        },
        {
          text: '🏗️ 架构设计',
          collapsed: false,
          items: [
            { text: '整体架构', link: '/architecture/overview' },
            { text: 'Monorepo 结构', link: '/architecture/monorepo' },
          ],
        },
        {
          text: '🔧 后端开发',
          collapsed: true,
          items: [
            { text: '模块开发', link: '/backend/modules' },
          ],
        },
        {
          text: '📦 共享包',
          collapsed: false,
          items: [
            { text: 'types', link: '/packages/types' },
            { text: 'api-client', link: '/packages/api-client' },
            { text: 'hooks', link: '/packages/hooks' },
            { text: 'logger', link: '/packages/logger' },
            { text: 'service', link: '/packages/service' },
            { text: 'ui', link: '/packages/ui' },
            { text: 'taro-ui', link: '/packages/taro-ui' },
            { text: 'dynamic-config', link: '/packages/dynamic-config' },
          ],
        },
        {
          text: '🔧 NestJS 模块',
          collapsed: false,
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
        {
          text: '🚢 部署运维',
          collapsed: true,
          items: [
            { text: '环境配置', link: '/deployment/environment' },
            { text: 'Docker 部署', link: '/deployment/docker' },
          ],
        },
        {
          text: '🛠️ 开发工具',
          collapsed: true,
          items: [
            { text: '编码规范', link: '/tools/coding-standards' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/751848178/svton' },
    ],

    footer: {
      message: 'Svton - 全栈 Monorepo 脚手架',
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
