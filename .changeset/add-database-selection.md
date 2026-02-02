---
'@svton/cli': minor
---

添加数据库类型选择功能

**新功能**：

- 在创建项目时可以选择数据库类型（MySQL、PostgreSQL、SQLite）
- 默认使用 MySQL 数据库
- 根据选择的数据库类型自动生成对应的 Prisma schema
- 根据数据库类型生成正确的 DATABASE_URL 配置

**数据库支持**：

- **MySQL**: `mysql://root:root123456@localhost:3306/project_name`
- **PostgreSQL**: `postgresql://postgres:postgres@localhost:5432/project_name`
- **SQLite**: `file:./dev.db`

**使用方式**：

交互式创建项目时，会提示选择数据库类型：
```bash
pnpm create svton-app my-project
# 选择模板后会提示选择数据库
```

非交互式模式默认使用 MySQL：
```bash
pnpm create svton-app my-project --yes
```
