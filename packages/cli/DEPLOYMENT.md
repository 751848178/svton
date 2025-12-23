# create-svton-app 发布指南

## 📦 发布到 npm

### 1. 准备发布

确保所有代码都已提交并且测试通过：

```bash
# 构建项目
npm run build

# 运行测试（如果有）
npm test

# 检查代码质量
npm run lint
```

### 2. 版本管理

使用 Changesets 管理版本：

```bash
# 添加变更记录
npx changeset

# 应用变更并更新版本
npx changeset version

# 发布到 npm
npm run release
```

### 3. 手动发布（如果需要）

```bash
# 登录 npm（如果还没登录）
npm login

# 发布
npm publish
```

## 🔧 本地开发测试

### 测试 CLI 工具

```bash
# 在项目根目录，使用相对路径测试
node bin/create-svton-app.js my-test-app --skip-install

# 或者全局安装进行测试
npm install -g .
create-svton-app my-test-app --skip-install
```

### 清理测试项目

```bash
rm -rf my-test-app
```

## 🚀 使用方式

发布后，用户可以通过以下方式使用：

### 使用 npm

```bash
npm create svton-app my-app
```

### 使用 yarn

```bash
yarn create svton-app my-app  
```

### 使用 pnpm

```bash
pnpm create svton-app my-app
```

### 全局安装

```bash
npm install -g create-svton-app
create-svton-app my-app
```

## 📋 发布检查清单

发布前确保：

- [ ] 所有代码已提交到 Git
- [ ] 版本号已正确更新
- [ ] 构建成功无错误
- [ ] CLI 命令可以正常执行
- [ ] README.md 文档完整
- [ ] LICENSE 文件存在
- [ ] package.json 中的 files 字段正确
- [ ] .npmignore 配置正确

## 🔍 故障排查

### 常见问题

1. **发布权限问题**
   ```bash
   npm login
   npm whoami  # 确认登录状态
   ```

2. **版本冲突**
   ```bash
   npm version patch  # 更新补丁版本
   npm version minor  # 更新小版本
   npm version major  # 更新大版本
   ```

3. **构建错误**
   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```

### 验证发布

发布后验证：

```bash
# 检查包是否可以搜索到
npm search create-svton-app

# 测试安装
npm create svton-app test-project
```

## 📊 发布后续

### 监控使用情况

- 检查 npm 下载统计
- 收集用户反馈
- 监控 GitHub Issues

### 维护更新

- 定期更新依赖
- 修复发现的问题
- 添加新功能

## 🔗 相关链接

- [npm 发布文档](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Changesets 使用指南](https://github.com/changesets/changesets)
- [语义化版本规范](https://semver.org/)
