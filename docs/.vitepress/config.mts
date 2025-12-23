import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Svton',
  description: '全栈应用框架 - CLI、共享包和项目模板',
  lang: 'zh-CN',
  base: '/svton/',
  ignoreDeadLinks: true,
  
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '包', link: '/packages/cli' },
      { text: '规范', link: '/standards/coding' },
      {
        text: '1.0.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'npm', link: 'https://www.npmjs.com/org/svton' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '项目结构', link: '/guide/project-structure' },
            { text: '配置说明', link: '/guide/configuration' },
          ]
        },
        {
          text: '进阶',
          items: [
            { text: '数据库迁移', link: '/guide/database-migration' },
            { text: '性能优化', link: '/guide/performance' },
            { text: '存储策略', link: '/guide/storage' },
          ]
        }
      ],
      '/packages/': [
        {
          text: '包',
          items: [
            { text: '@svton/cli', link: '/packages/cli' },
            { text: '@svton/api-client', link: '/packages/api-client' },
            { text: '@svton/hooks', link: '/packages/hooks' },
            { text: '@svton/taro-ui', link: '/packages/taro-ui' },
          ]
        }
      ],
      '/standards/': [
        {
          text: '开发规范',
          items: [
            { text: '编码规范', link: '/standards/coding' },
            { text: 'UI 设计系统', link: '/standards/ui-design' },
            { text: 'Taro 组件最佳实践', link: '/standards/taro-components' },
          ]
        },
        {
          text: '指南',
          items: [
            { text: 'Hooks 使用指南', link: '/standards/hooks-guide' },
            { text: '智能上传指南', link: '/standards/smart-upload' },
            { text: 'Miaoduo 设计稿指南', link: '/standards/miaoduo' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/751848178/svton' },
      { icon: 'npm', link: 'https://www.npmjs.com/org/svton' }
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2024 SVTON Team'
    },

    search: {
      provider: 'local'
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    lastUpdated: {
      text: '最后更新于',
    },

    editLink: {
      pattern: 'https://github.com/751848178/svton/edit/master/docs/:path',
      text: '在 GitHub 上编辑此页'
    }
  }
})
