# Taro 组件库最佳实践

## 📋 背景

在 Taro monorepo 项目中创建组件库时，有两种方式：

1. **编译后发布** - 使用 tsc/babel 编译 TypeScript → JavaScript
2. **源码直接使用** - 不编译，让宿主项目的 Webpack 处理

## ❌ 方式一：编译后发布（不推荐）

### 配置示例

```json
// packages/ui/package.json
{
  "name": "@svton/ui",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "peerDependencies": {
    "@tarojs/components": "^3.6.0",
    "react": "^18.0.0"
  }
}
```

### 问题

**编译后的代码仍然保留 import 语句：**

```javascript
// dist/components/Button/index.js
import { View, Text } from '@tarojs/components'; // ❌ 保留了 import
import React from 'react';
```

**Webpack 解析时的问题：**

```
resolve '@tarojs/components' in 'packages/ui/dist/components/Button'
  ❌ 尝试从 packages/ui/dist 解析依赖
  ❌ @tarojs/components 是 peerDependencies，不在这里
  ❌ 无法找到模块
```

**完整错误信息：**

```
✖ Webpack
  Compiled with some errors

resolve '@tarojs/components' in '/packages/ui/dist/components/Button'
  Parsed request is a module
  using description file: /packages/ui/package.json
    aliased with mapping '@tarojs/components': '@tarojs/plugin-platform-weapp/dist/components-react'
      resolve as module
        /packages/ui/dist/components/Button/node_modules doesn't exist
        /packages/ui/node_modules/@tarojs/plugin-platform-weapp doesn't exist
        /node_modules/@tarojs/plugin-platform-weapp doesn't exist
```

### 为什么会失败？

1. `tsc` 只做类型转换，保留所有 `import` 语句
2. `@tarojs/components` 声明为 `peerDependencies`
3. Webpack 从 `packages/ui/dist` 目录开始解析
4. `node_modules` 查找链无法找到 peer 依赖
5. **Webpack 无法跨包查找 peerDependencies**

---

## ✅ 方式二：源码直接使用（推荐）

### 配置示例

```json
// packages/ui/package.json
{
  "name": "@svton/ui",
  "main": "src/index.ts", // ✅ 指向源码
  "files": ["src"],
  "peerDependencies": {
    "@tarojs/components": "^3.6.0",
    "@tarojs/taro": "^3.6.0",
    "react": "^18.0.0"
  },
  "dependencies": {
    "@svton/hooks": "workspace:*"
  }
}
```

### 工作原理

**宿主项目（mobile）的 Webpack 配置：**

```javascript
// apps/mobile/config/index.js (Taro 自动配置)
{
  resolve: {
    alias: {
      '@svton/ui': path.resolve(__dirname, '../../packages/ui/src')
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, '../../packages/ui/src')  // ✅ 包含组件库源码
        ],
        use: ['babel-loader']
      }
    ]
  }
}
```

**解析流程：**

```
1. mobile 项目导入组件
   import { TabBar } from '@svton/ui'

2. Webpack 解析到 packages/ui/src/index.ts

3. 读取组件源码：
   import { View, Text } from '@tarojs/components'

4. Webpack 从 mobile 项目的 node_modules 解析
   ✅ mobile/node_modules/@tarojs/components 存在

5. 统一编译，正常工作 ✅
```

### 优势

1. **依赖解析正确** - Webpack 从宿主项目解析所有依赖
2. **无需编译步骤** - 修改源码后立即生效
3. **TypeScript 支持** - Webpack 自动处理 .ts/.tsx 文件
4. **开发体验好** - 热更新、调试方便
5. **符合 Taro 规范** - Taro 官方推荐方式

---

## 🎯 最佳实践总结

### 组件库结构

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── TabBar/
│   │   │   ├── index.tsx      # ✅ TypeScript 源码
│   │   │   └── index.scss     # ✅ SCSS 样式
│   │   └── Button/
│   │       ├── index.tsx
│   │       └── index.scss
│   └── index.ts               # 入口文件
└── package.json
```

### package.json 配置

```json
{
  "name": "@svton/ui",
  "version": "1.0.0",
  "description": "Svton UI Components Library for Taro",
  "main": "src/index.ts", // ✅ 指向源码入口
  "files": ["src"], // ✅ 只包含源码
  "peerDependencies": {
    // ✅ 宿主项目提供
    "@tarojs/components": "^3.6.0",
    "@tarojs/taro": "^3.6.0",
    "react": "^18.0.0"
  },
  "dependencies": {
    // ✅ 内部依赖
    "@svton/hooks": "workspace:*"
  }
}
```

### 宿主项目使用

```tsx
// apps/mobile/src/pages/index/index.tsx
import { TabBar, Button, List } from '@svton/ui'  // ✅ 直接导入

// TypeScript 类型自动推导
const tabs: TabBarItem[] = [...]  // ✅ 类型安全

// 正常使用
<TabBar items={tabs} activeKey={activeTab} onChange={setActiveTab} />
```

---

## 🔧 其他解决方案对比

### 方案A：使用 Rollup/Webpack 打包

**配置：**

```javascript
// rollup.config.js
export default {
  external: ['react', '@tarojs/components'], // 外部依赖
  output: {
    format: 'esm',
    preserveModules: true, // 保留模块结构
  },
};
```

**问题：**

- 配置复杂
- 需要维护打包配置
- 仍然有依赖解析问题

**评价：** ⚠️ 可行但不推荐

---

### 方案B：发布到 npm，宿主项目安装

**适用场景：**

- 独立发布的公共组件库
- 跨项目使用
- 需要版本管理

**配置：**

```json
{
  "name": "@svton/ui",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts"
}
```

**评价：** ✅ 适合公共库，但对于 monorepo 内部使用过度

---

### 方案C：直接使用源码（当前方案）

**配置：**

```json
{
  "main": "src/index.ts",
  "files": ["src"]
}
```

**评价：** ✅✅✅ 最佳方案

- 简单直接
- 开发体验好
- 符合 Taro 规范
- 无需额外配置

---

## 📚 Taro 官方示例

Taro 官方的 UI 组件库也采用类似方式：

**Taro UI：**

```json
{
  "name": "taro-ui",
  "main": "dist/index.js", // 编译后发布到 npm
  "module": "dist/index.esm.js",
  "types": "dist/types/index.d.ts"
}
```

但 Taro UI 是独立发布的公共库，不是 monorepo 内部使用。

**NutUI（京东）：**
类似的多端组件库，也提供编译后的版本供外部使用。

---

## 🎓 学习资源

- [Taro 官方文档 - 组件库开发](https://taro-docs.jd.com/docs/)
- [pnpm workspace](https://pnpm.io/workspaces)
- [Webpack Module Resolution](https://webpack.js.org/concepts/module-resolution/)

---

## 💡 总结

对于 **Taro monorepo 内部使用的组件库**：

✅ **直接使用源码**

- `main: "src/index.ts"`
- 让宿主项目的 Webpack 处理编译
- 简单、高效、开发体验好

❌ **不要编译**

- 不需要 `tsc`、`babel`、`rollup`
- 不需要 `dist` 目录
- 不需要复杂的打包配置

🎯 **核心原则**

- **Single Source of Truth** - 源码是唯一真实来源
- **Let Webpack Do Its Job** - 让 Webpack 处理所有编译
- **Keep It Simple** - 保持简单

---

**创建时间：** 2025-11-23  
**适用版本：** Taro 3.x + pnpm workspace  
**维护者：** Svton Team
