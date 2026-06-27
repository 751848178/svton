# 消息队列示例

本示例展示如何使用 `@svton/nestjs-queue` 模块处理异步任务。

## 文件说明

- `email.processor.ts` - 队列处理器，定义任务执行逻辑
- `email.service.ts` - 服务层，添加任务到队列
- `email.controller.ts` - 控制器，提供 API 接口

## 核心概念

- **Queue（队列）**：任务的容器
- **Job（任务）**：具体的执行单元
- **Processor（处理器）**：任务的执行逻辑
- **Worker（工作进程）**：执行任务的进程

## 使用方式

### 1. 定义处理器

```typescript
@Processor({ name: 'email' })
export class EmailProcessor {
  @Process('send')
  async handleSend(job: Job<EmailData>) {
    // 处理任务
  }
}
```

### 2. 添加任务

```typescript
await this.queueService.addJob('email', 'send', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Welcome to our platform!',
});
```

## 任务选项

### 延迟执行

```typescript
await this.queueService.addJob('email', 'send', data, {
  delay: 60000, // 延迟 60 秒
});
```

### 重试策略

```typescript
await this.queueService.addJob('email', 'send', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
});
```

### 定时任务

```typescript
await this.queueService.addJob('email', 'send', data, {
  repeat: {
    cron: '0 9 * * *', // 每天 9 点执行
  },
});
```

### 优先级

```typescript
await this.queueService.addJob('email', 'send', data, {
  priority: 1, // 数字越小优先级越高
});
```

## 测试接口

```bash
# 发送邮件
curl -X POST http://localhost:3000/examples/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Test Email",
    "body": "This is a test email"
  }'

# 延迟发送
curl -X POST http://localhost:3000/examples/emails/send-delayed \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Delayed Email",
    "body": "This email will be sent after 10 seconds",
    "delayMs": 10000
  }'

# 批量发送
curl -X POST http://localhost:3000/examples/emails/send-batch \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {"to": "user1@example.com", "subject": "Test 1", "body": "Body 1"},
      {"to": "user2@example.com", "subject": "Test 2", "body": "Body 2"}
    ]
  }'

# 紧急邮件（高优先级）
curl -X POST http://localhost:3000/examples/emails/send-urgent \
  -H "Content-Type: application/json" \
  -d '{
    "to": "admin@example.com",
    "subject": "Urgent",
    "body": "This is urgent!"
  }'
```

## 最佳实践

1. **任务幂等性**：确保任务可以安全重试
2. **合理设置重试**：根据业务场景设置重试次数和策略
3. **任务拆分**：大任务拆分成小任务，提高并发度
4. **监控告警**：监听失败事件，及时处理异常
5. **资源限制**：控制并发数，避免资源耗尽

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-queue
