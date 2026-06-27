# 项目能力索引

本项目基于 Svton 全栈框架创建，这是一个企业级 Monorepo 架构。

## 项目结构

```
src/
├── config/          # 配置文件
├── examples/        # 功能示例代码
├── modules/         # 业务模块
└── main.ts          # 应用入口
```

## 核心能力

本项目已集成以下功能模块，每个模块都有对应的 skill 文档和示例代码。

### 查看功能文档

- 查看 `.kiro/skills/` 目录下的各个功能 skill 文档
- 查看 `src/examples/` 目录下的示例代码
- 查看 `src/config/` 目录下的配置文件

## 开发建议

当你需要使用某个功能时：

1. 查看对应的 skill 文档了解 API 和最佳实践
2. 参考 `src/examples/` 目录下的示例代码
3. 根据需要修改 `src/config/` 中的配置
4. 查看官方文档获取更多信息

## 环境配置

项目使用 `.env` 文件管理环境变量，请参考 `.env.example` 文件配置必要的环境变量。

## 文档资源

- Svton 官方文档：https://751848178.github.io/svton
- GitHub：https://github.com/751848178/svton

## 常用命令

```bash
# 开发模式
pnpm dev

# 构建
pnpm build

# 启动生产环境
pnpm start

# 运行测试
pnpm test
```
