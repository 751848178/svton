# @svton/cli

> SVTON CLI脚手架工具 - 快速创建SVTON项目

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/cli` |
| **版本** | `1.0.0` |
| **命令** | `svton` |
| **入口** | `bin/index.js` |

---

## 🎯 设计原则

1. **简单易用** - `svton create [project-name]` 一键创建项目
2. **模板丰富** - 支持fullstack、admin、backend、mobile四种模板
3. **配置灵活** - 支持自定义组织名、跳过安装等选项
4. **即开即用** - 无需全局安装，使用npx直接运行

---

## 🛠️ 命令用法

### 基本命令

```bash
# 创建完整项目(默认)
npx @svton/cli create my-app

# 创建特定模板
npx @svton/cli create my-app --template admin
npx @svton/cli create my-app --template backend  
npx @svton/cli create my-app --template mobile

# 自定义配置
npx @svton/cli create my-app --org my-company --skip-install

# 查看帮助
npx @svton/cli create --help
```

### 支持的模板

| 模板 | 说明 | 包含内容 |
|------|------|---------|
| **fullstack** | 完整项目(默认) | Admin + Backend + Mobile + Types |
| **admin** | 管理后台 | Next.js + @svton/api-client + SWR |
| **backend** | 后端API | NestJS + Prisma + JWT Auth |
| **mobile** | 移动端 | Taro + @svton/taro-ui |

---

## 📁 目录结构

```
packages/cli/
├── bin/
│   └── svton.js              # CLI入口文件
├── src/
│   ├── commands/             # 命令实现
│   │   └── create.ts         # create 命令
│   ├── utils/                # 工具函数
│   └── index.ts              # 主入口
├── dist/                     # 构建输出
├── package.json              # CLI包配置
└── README.md                 # 使用文档
```

---

## ⚙️ 模板变量替换

CLI使用模板变量系统来自定义生成的项目：

| 变量 | 描述 | 示例 |
|------|------|------|
| `{{PROJECT_NAME}}` | 项目名称 | `my-app` |
| `{{ORG_NAME}}` | 组织名 | `my-org` |

### 共享包固定命名

共享包将发布到npm，使用固定的@svton组织名：

```json
{
  "dependencies": {
    "@svton/api-client": "^1.0.0",
    "@svton/types": "^1.0.0", 
    "@svton/hooks": "^1.0.0",
    "@svton/taro-ui": "^1.0.0"
  }
}
```

**不使用**组织名变量替换：
- ❌ `"{{ORG_NAME}}/api-client"`
- ✅ `"@svton/api-client"`

---

## 🔧 模板处理逻辑

### 1. 文件复制和重命名

```javascript
// 模板文件后缀处理
'file.tpl' → 'file'           // 移除.tpl后缀
'gitignore.tpl' → '.gitignore' // 特殊文件重命名
```

### 2. 变量替换

```javascript
const replaceVariables = (content, vars) => {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, vars.projectName)
    .replace(/\{\{ORG_NAME\}\}/g, vars.orgName);
};
```

### 3. 条件文件包含

根据模板类型决定包含哪些文件：

```javascript
const templateFiles = {
  fullstack: ['admin', 'backend', 'mobile', 'types'],
  admin: ['admin', 'types'],
  backend: ['backend', 'types'], 
  mobile: ['mobile', 'types']
};
```

---

## 🚀 开发工作流

### 本地开发测试

```bash
# 进入CLI包目录
cd packages/cli

# 构建
pnpm build

# 本地链接
npm link

# 测试命令  
svton create test-project

# 取消链接
npm unlink -g @svton/cli
```

### 发布测试

```bash
# 测试新版本
npx @svton/cli create test-app --template admin
```

---

## 📋 发布清单

发布前检查：

- [ ] 版本号已更新
- [ ] 所有模板文件完整
- [ ] 共享包使用固定@svton命名
- [ ] CLI命令测试通过
- [ ] README文档已更新

```bash
# 发布到npm
cd packages/cli
npm publish --access public
```

---

## 🔗 相关文档

- [快速开始](../getting-started/quick-start.md) - 使用CLI创建项目
- [项目模板](../architecture/monorepo.md) - 了解项目结构
- [包管理](./types.md) - 共享类型包

---

**最后更新**: 2024-12-23
**维护者**: SVTON CLI团队
