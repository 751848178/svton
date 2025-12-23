# 数据库迁移指南

## 📋 概述

本文档记录项目中的重要数据库迁移，帮助团队理解数据模型变更的原因和影响。

---

## 🗑️ 迁移：删除短信验证码表 (2025-11-20)

### 迁移文件

```
apps/backend/prisma/migrations/20251120162127_remove_sms_code_table/migration.sql
```

### 变更内容

**删除表**：`sms_codes`

```sql
DROP TABLE `sms_codes`;
```

---

### 为什么删除？

#### 1. **数据存储方案已变更**

**之前的设计（废弃）**：

```
验证码 → MySQL 数据库 → sms_codes 表
```

**当前的设计（已实现）**：

```
验证码 → Redis → Key: sms:code:{phone}
```

#### 2. **代码中从未使用**

检查结果：

- ❌ 没有任何代码引用 `SmsCode` 模型
- ❌ 没有任何 CRUD 操作
- ✅ 所有验证码操作都通过 `RedisService`

#### 3. **Redis 方案的优势**

| 对比项       | MySQL            | Redis        | 结果           |
| ------------ | ---------------- | ------------ | -------------- |
| **性能**     | 磁盘I/O          | 内存操作     | Redis 快100倍+ |
| **自动过期** | 需要定时任务清理 | 原生支持 TTL | Redis 更简单   |
| **并发安全** | 需要事务         | 原子操作     | Redis 更可靠   |
| **适用场景** | 持久化数据       | 临时数据     | Redis 更合适   |

---

### 当前验证码实现

#### Redis 数据结构

```
Key: sms:code:{phone}
Value: "123456"  (6位验证码)
TTL: 300秒 (5分钟)

Key: sms:limit:{phone}
Value: "1700000000000"  (时间戳)
TTL: 60秒 (频率限制)

Key: sms:daily:{phone}
Value: "3"  (今日发送次数)
TTL: 86400秒 (24小时)
```

#### 代码实现

```typescript
// apps/backend/src/modules/sms/sms.service.ts

// 保存验证码
const codeKey = `sms:code:${phone}`;
await this.redisService.set(codeKey, code, this.codeExpireMinutes * 60);

// 验证验证码
const savedCode = await this.redisService.get(codeKey);
if (savedCode !== code) {
  throw new BadRequestException('验证码错误');
}

// 验证成功后删除
await this.redisService.del(codeKey);
```

---

### 执行迁移

#### ⚠️ 注意事项

1. **数据丢失风险**
   - 如果 `sms_codes` 表中有数据，执行迁移后会被删除
   - 但这些数据已经无用（代码不再使用）

2. **不可回滚**
   - 删除表后无法自动恢复
   - 确保团队已完全迁移到 Redis 方案

#### 执行步骤

**开发环境**：

```bash
cd apps/backend
npx prisma migrate dev
```

**生产环境**：

```bash
cd apps/backend
npx prisma migrate deploy
```

#### 验证迁移

```bash
# 查看迁移状态
npx prisma migrate status

# 连接数据库检查
mysql -u root -p community_helper
SHOW TABLES;  # 应该看不到 sms_codes 表
```

---

### 数据存储设计原则

#### Redis 适用场景

✅ **临时数据**：

- 短信验证码（5分钟过期）
- 会话数据（Session）
- 验证 Token（临时）
- 频率限制计数器

✅ **特点**：

- 生命周期短
- 读写频繁
- 不需要持久化
- 需要自动过期

#### MySQL 适用场景

✅ **持久化数据**：

- 用户信息
- 内容数据
- 订单记录
- 交易信息

✅ **特点**：

- 需要长期保存
- 需要关联查询
- 需要事务保证
- 数据重要性高

---

### 影响范围

#### ✅ 无影响（已验证）

- 用户登录功能 ✅
- 验证码发送 ✅
- 验证码验证 ✅
- 所有业务逻辑 ✅

#### ❌ 有影响（预期）

- 旧的数据库表不存在 ✅（这是目的）
- 旧的 Prisma 模型被删除 ✅（这是目的）

---

## 📊 迁移历史

| 日期       | 迁移名称                | 类型   | 说明                             |
| ---------- | ----------------------- | ------ | -------------------------------- |
| 2025-11-20 | `remove_sms_code_table` | 删除表 | 移除未使用的验证码表，改用 Redis |

---

## 🔍 常见问题

### Q1: 为什么不保留表作为备份？

**A**:

- 表从未被使用过，没有备份价值
- 保留会造成维护成本和混淆
- Redis 是唯一的数据源

### Q2: 如果 Redis 数据丢失怎么办？

**A**:

- 验证码本身就是临时数据（5分钟过期）
- 用户可以重新请求验证码
- 不会造成数据一致性问题

### Q3: 为什么不同时保存到 MySQL 和 Redis？

**A**:

- 双写会增加复杂度
- 可能造成数据不一致
- 验证码是临时数据，不需要双写保护

### Q4: 生产环境执行迁移需要停机吗？

**A**:

- 不需要
- 因为代码已经不使用这个表
- 删除表不会影响现有功能

---

## 📝 最佳实践

### 数据库迁移流程

1. **开发阶段**

   ```bash
   # 修改 schema.prisma
   npx prisma migrate dev --name <migration_name>
   ```

2. **代码审查**
   - 检查迁移 SQL 是否正确
   - 评估对现有数据的影响
   - 确认业务逻辑兼容性

3. **测试环境验证**

   ```bash
   npx prisma migrate deploy
   # 运行集成测试
   ```

4. **生产环境部署**

   ```bash
   # 备份数据库
   mysqldump -u root -p community_helper > backup.sql

   # 执行迁移
   npx prisma migrate deploy

   # 验证功能
   ```

---

## 🔗 相关资源

- [Prisma 迁移文档](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Redis 最佳实践](https://redis.io/docs/manual/patterns/)
- [短信服务实现](../apps/backend/src/modules/sms/sms.service.ts)

---

**最后更新**: 2025-11-20  
**维护者**: 开发团队
