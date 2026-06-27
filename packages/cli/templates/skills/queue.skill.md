# 消息队列使用指南

本项目已集成 `@svton/nestjs-queue` 消息队列模块，基于 BullMQ 实现。

## 已安装的包

- `@svton/nestjs-queue` - 队列模块
- `@svton/nestjs-redis` - Redis 连接模块

## 配置文件

- `src/config/queue.config.ts` - 队列配置
- `.env` - 环境变量配置（REDIS_HOST, REDIS_PORT）

## 示例代码位置

查看 `src/examples/queue/` 目录获取完整示例：
- `email.processor.ts` - 邮件队列处理器
- `email.service.ts` - 邮件发送服务
- `email.controller.ts` - API 接口
- `README.md` - 详细说明文档

## 核心概念

- **Queue（队列）**：任务的容器
- **Job（任务）**：具体的执行单元
- **Processor（处理器）**：任务的执行逻辑
- **Worker（工作进程）**：执行任务的进程

## 添加任务

```typescript
await this.queueService.addJob('email', 'send', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Welcome to our platform!',
});
```

## 定义处理器

```typescript
@Processor({ name: 'email' })
@Injectable()
export class EmailProcessor {
  @Process('send')
  async handleSend(job: Job<EmailData>) {
    const { to, subject, body } = job.data;
    await this.sendEmail(to, subject, body);
  }
}
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
await this.queueService.addJob('report', 'daily', data, {
  repeat: {
    cron: '0 0 * * *', // 每天 0 点执行
  },
});
```

## 任务优先级

```typescript
await this.queueService.addJob('email', 'send', data, {
  priority: 1, // 数字越小优先级越高
});
```

## 监听任务事件

```typescript
@OnQueueCompleted({ name: 'email' })
async onCompleted(job: Job) {
  console.log(`Job ${job.id} completed`);
}

@OnQueueFailed({ name: 'email' })
async onFailed(job: Job, error: Error) {
  console.error(`Job ${job.id} failed:`, error);
}
```

## 常见场景

### 发送邮件
```typescript
await this.queueService.addJob('email', 'send', emailData);
```

### 生成报表
```typescript
await this.queueService.addJob('report', 'generate', reportData);
```

### 数据同步
```typescript
await this.queueService.addJob('sync', 'user', userData, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
});
```

## 最佳实践

1. **任务幂等性**：确保任务可以安全重试
2. **合理设置重试**：根据业务场景设置重试次数和策略
3. **任务拆分**：大任务拆分成小任务，提高并发度
4. **监控告警**：监听失败事件，及时处理异常
5. **资源限制**：控制并发数，避免资源耗尽

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-queue
- 示例代码：`src/examples/queue/`
- BullMQ 文档：https://docs.bullmq.io/
